import * as path from 'path';
import { MediaFile } from "../types/media-file";
import { logger } from "../logger";
import AsyncLock from "async-lock";
import { ensureDir, pathExists, readFile, stat } from "../utils/file-utils";
import { ChildProcess, spawn } from 'child_process';
import { TRANSCODE_PATH } from "../app";
import transcodeDecisionService, { QualityProfile, TranscodeDecision } from "./transcode-decision";
import { ClientInfo } from "../types/client-info";
import { FFMPEG_PATH } from "../utils/ffmpeg";
import { BLUE, GREEN, MAGENTA, RESET, WHITE } from "../utils/utils";
import { getTranscodingArgs } from "./transcoding-profiles";
import { Request, Response } from 'express';
import { getMimeType } from "../utils/media-utils";
import fs from "fs";

export const SEGMENT_DURATION = 4; // seconds per segment
export const PAUSE_TRANSCODE_AFTER = 30000; // pause transcode after x milliseconds. -1 means no pausing.

interface TranscodeJob {
    id: string;
    process?: ChildProcess;
    status: 'running' | 'stopped' | 'completed';
    startSegment: number;
    startTime: number;
    lastGeneratedSegment?: number;
}

export interface PlaySession {
    id: string;
    client: ClientInfo;
    file: MediaFile;
    decision: TranscodeDecision;

    audioIndex: number;
    subtitleIndex: number;

    createdAt: Date;
    lastAccessed: Date;

    currentTime: number;
    isPaused: boolean;
    pauseStartedAt?: number;

    transcode?: TranscodeJob;
}

export class StreamingService {

    private sessions: Map<string, PlaySession> = new Map();
    private lock = new AsyncLock();

    getOrCreateSession(client: ClientInfo, file: MediaFile, profile: QualityProfile): PlaySession {
        const decision = transcodeDecisionService.decide(file, client.capabilities, profile);
        const sessionId: string = `${client.token}-${file.id}`;

        // Return session if already exists
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId)!;
            session.lastAccessed = new Date();

            // WICHTIG: Decision könnte sich geändert haben (anderes Profile)
            // Wenn Profile gewechselt wird, brauchen wir möglicherweise neuen Transcode
            if (session.decision.profile !== decision.profile) {
                logger.INFO(`Profile changed from ${session.decision.profile} to ${decision.profile}, updating session`);
                session.decision = decision;
                // Transcode läuft weiter, wird beim nächsten Segment-Request neu gestartet
            }

            logger.DEBUG(`Reusing session: ${sessionId}`);
            return session;
        }

        const session: PlaySession = {
            id: sessionId,
            client: client,
            file: file,
            decision: decision,
            audioIndex: 0,
            subtitleIndex: -1,
            createdAt: new Date(),
            lastAccessed: new Date(),
            currentTime: 0,
            isPaused: false,
            pauseStartedAt: -1
        };

        this.sessions.set(sessionId, session);
        logger.INFO(`Created new session: ${sessionId}`);
        return session;
    }

    async getPlaylist(session: PlaySession): Promise<string> {
        session.lastAccessed = new Date();

        await this.lock.acquire(`playlist-${session.id}`, async () => {
            if (!session.transcode || session.transcode.status !== 'running') {
                const startSegment =
                    Math.floor(session.currentTime / SEGMENT_DURATION);
                await this.startTranscode(session, startSegment);
            }
        });

        const job = session.transcode!;
        const playlistPath = path.join(
            TRANSCODE_PATH,
            session.id,
            job.id,
            'playlist.m3u8'
        );

        await this.waitForFile(playlistPath);
        return readFile(playlistPath, 'utf-8');
    }

    async getSegment(session: PlaySession, segmentIndex: number): Promise<string | null> {
        session.lastAccessed = new Date();

        const job = session.transcode;
        if (!job || job.status !== 'running') {
            throw new Error('No active transcode');
        }

        const dir = path.join(TRANSCODE_PATH, session.id, job.id);
        const segmentPath = path.join(dir, `segment${segmentIndex}.ts`);

        // Falls Segment existiert → sofort liefern
        if (await pathExists(segmentPath)) {
            logger.DEBUG(`${WHITE}Serving existing segment ${segmentIndex} for session ${session.id}${RESET}`);
            return segmentPath;
        }

        // Warten bis ffmpeg Segment erzeugt
        const timeoutMs = 8000;
        const start = Date.now();

        while (Date.now() - start < timeoutMs) {
            if (await pathExists(segmentPath)) {
                return segmentPath;
            }
            await new Promise(r => setTimeout(r, 30));
        }

        throw new Error(`Segment ${segmentIndex} not available`);

        // await this.ensureTranscodeRunning(session, segmentIndex);
        // return null;
    }

    // private async ensureTranscodeRunning(session: PlaySession, requestedSegment: number): Promise<void> {
    //     return this.lock.acquire(`transcode-${session.id}`, async () => {
    //         if (!session.transcode || session.transcode.status !== 'running') {
    //             const startSegment = Math.floor(session.currentTime / SEGMENT_DURATION);
    //             await this.startTranscode(session, startSegment);
    //         }
    //     });
    // }

    private async startTranscode(session: PlaySession, startSegment: number): Promise<void> {
        await this.stopTranscode(session);

        const jobId = crypto.randomUUID();
        const startTime = startSegment * SEGMENT_DURATION;

        const outputDir = path.join(TRANSCODE_PATH, session.id, jobId);
        await ensureDir(outputDir);

        const playlistPath = path.join(outputDir, 'playlist.m3u8');
        const segmentPath = path.join(outputDir, 'segment%d.ts');

        const job: TranscodeJob = {
            id: jobId,
            status: 'running',
            startSegment,
            startTime,
            lastGeneratedSegment: undefined
        };
        session.transcode = job;

        const file = session.file;
        const duration = file.metadata.general.Duration;
        const totalSegments = Math.ceil(duration / SEGMENT_DURATION);

        const framerate = session.file.metadata?.video[0]?.FrameRate ?? 25;
        const gopSize = Math.round(framerate * SEGMENT_DURATION);

        const transcodingArgs = getTranscodingArgs(session);

        const args = [
            // Input
            '-ss', String(startTime),
            '-i', file.path,
            '-threads', '0',

            // Video
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-g', String(gopSize),
            '-sc_threshold', '0',
            '-force_key_frames', `expr:gte(t,n_forced*${SEGMENT_DURATION})`,

            // Audio
            '-c:a', 'aac',
            '-b:a', '192k',
            '-ac', '2',
            '-ar', '48000',

            // Mapping
            '-map', '0:v:0',  // Erster Video stream
            '-map', '0:a:0',  // Erster Audio stream

            // HLS
            '-f', 'hls',
            '-hls_time', String(SEGMENT_DURATION),
            '-hls_list_size', '0',
            '-hls_playlist_type', 'event',
            '-hls_flags', 'independent_segments+temp_file',
            '-start_number', String(startSegment),
            '-hls_segment_filename', segmentPath,

            '-progress', 'pipe:1',
            '-nostats',
            '-loglevel', 'error',

            // Output
            playlistPath
        ];

        // FFmpeg spawnen
        const ffmpegProcess: ChildProcess = spawn(FFMPEG_PATH, args);
        job.process = ffmpegProcess;

        logger.INFO(`${GREEN}Transcode started - start segment ${startSegment} [${session.id}]${RESET}`);

        // Progress parsing
        let progressBuffer = '';

        ffmpegProcess.stdout?.on('data', (data) => {
            if (job.status !== 'running') return; // Ignoriere wenn gestoppt

            progressBuffer += data.toString();
            const lines = progressBuffer.split('\n');
            progressBuffer = lines.pop() || '';

            for (const line of lines) {
                if (line.includes('out_time_ms=')) {
                    const match = line.match(/out_time_ms=(\d+)/);

                    if (match) {
                        const timeMs = parseInt(match[1], 10);
                        const transcodedSeconds = timeMs / 1_000_000; // Microseconds to seconds
                        const absoluteTime = startTime + transcodedSeconds;
                        const percent = (timeMs  / duration) * 100;

                        job.lastGeneratedSegment = Math.floor(absoluteTime / SEGMENT_DURATION);

                        logger.INFO(`${BLUE}Transcode-Progress: ${percent.toFixed(1)}% Segments: [${job.startSegment}/${job.lastGeneratedSegment}/${totalSegments}] [${session.id}]${RESET}`);


                    }
                }
            }
        });

        // Error handling
        ffmpegProcess.stderr?.on('data', (data) => {
            if (job.status === 'stopped') return;
            // Nur wichtige Errors loggen, nicht alle stderr Ausgaben
            const msg = data.toString();
            if (msg.includes('error') || msg.includes('Error')) {
                logger.ERROR(`FFmpeg stderr: ${msg}`);
            }
        });

        // Process Ende
        ffmpegProcess.on('exit', async (code, signal) => {
            if (job.status === 'stopped') {
                logger.DEBUG(`Process stopped by user [${session.id}]`);
                return;
            }

            if (code === 0) {
                logger.INFO(`${MAGENTA}Transcode completed [${session.id}]${RESET}`);
                job.status = 'completed';
            } else if (signal === 'SIGKILL') {
                logger.DEBUG(`Process killed [${session.id}]`);
            } else {
                logger.ERROR(`FFmpeg exited with code ${code} [${session.id}]`);
                job.status = 'stopped';
            }
        });
    }

    async stopTranscode(session: PlaySession): Promise<void> {
        const job = session.transcode;

        if (!job || job.status !== 'running') return;

        logger.INFO(`Stopping transcode [${session.id}]`);

        // Status sofort setzen
        job.status = 'stopped';

        // Prozess killen
        if (job.process && !job.process.killed) {
            job.process.kill('SIGKILL');

            // Auf Windows zusätzlich taskkill
            if (process.platform === 'win32' && job.process.pid) {
                try {
                    require('child_process').execSync(`taskkill /PID ${job.process.pid} /T /F`, { stdio: 'ignore' });
                } catch (e) {}
            }
        }

        session.transcode = undefined;
    }

    /**
     * Direct Play - serve file as-is with Range support
     */
    async streamDirectPlay(req: Request, res: Response, session: PlaySession, range?: string): Promise<void> {
        const file = session.file;
        const stats = await stat(file.path);
        const fileSize = stats.size;

        // Set MIME type
        const mimeType = getMimeType(file.extension);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Accept-Ranges', 'bytes');

        // Handle Range request (for seeking)
        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunkSize = (end - start) + 1;

            // Validate range
            if (start >= fileSize || end >= fileSize) {
                res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
                res.end();
                return; // ← Kein Wert zurückgeben
            }

            logger.DEBUG(`Direct Play: Range ${start}-${end}/${fileSize} for ${file.name}`);

            res.status(206); // Partial Content
            res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
            res.setHeader('Content-Length', chunkSize);

            const stream = fs.createReadStream(file.path, { start, end });
            stream.pipe(res);

            stream.on('error', (error) => {
                logger.ERROR(`Stream error: ${error}`);
                if (!res.headersSent) {
                    res.status(500).end();
                }
            });
        } else {
            // Full file
            logger.DEBUG(`Direct Play: Full file for ${file.name}`);

            res.setHeader('Content-Length', fileSize);

            const stream = fs.createReadStream(file.path);
            stream.pipe(res);

            stream.on('error', (error) => {
                logger.ERROR(`Stream error: ${error}`);
                if (!res.headersSent) {
                    res.status(500).end();
                }
            });
        }
    }

    /**
     * Direct remux - Stream file via fragmented mp4.
     * No video transcoding. Optional audio transcoding.
     */
    async streamDirectRemux(req: Request, res: Response, session: PlaySession): Promise<void> {
        const file = session.file;
        const decision = session.decision;

        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Accept-Ranges', 'bytes');
        // res.setHeader('Cache-Control', 'no-cache');

        const args: string[] = [
            '-i', file.path,

            '-map', '0:v:0',
            '-map', '0:a:0',

            // Video copy
            '-c:v', 'copy',
            '-c:a', 'copy',
        ];

        // SUBTITLE
        // if (decision.subtitle.action === 'copy') {
        //     // args.push('-c:s', 'copy');
        //     args.push('-c:s', 'mov_text');
        // } else {
        //     args.push('-sn');
        // }

        // args.push('-sn');

        args.push(
            '-f', 'mp4',
            '-movflags', 'frag_keyframe+empty_moov+faststart',
            'pipe:1'
        )

        logger.DEBUG(`${MAGENTA}DIRECT REMUX ARGS: ${args}${RESET}`);

        const ffmpegProcess = spawn(FFMPEG_PATH, args);

        const job: TranscodeJob = {
            id: crypto.randomUUID(),
            status: 'running',
            process: ffmpegProcess,
            startSegment: -1,
            startTime: -1
        };
        session.transcode = job;

        ffmpegProcess.stdout.pipe(res);

        ffmpegProcess.stderr.on('data', (data: any) => {
            logger.DEBUG(`[remux ${session.id}] ${data}`);
        });

        ffmpegProcess.on('error', (error: any) => {
            logger.ERROR(`FFmpeg remux error: ${error}`);
            if (!res.headersSent) {
                res.status(500).end();
            }
        });

        ffmpegProcess.on('close', (code: any) => {
            if (code !== 0) {
                logger.ERROR(`FFmpeg remux exited with code ${code}`);
            } else {
                logger.DEBUG(`Direct Remux completed for ${file.name}`);
            }
        });

        req.on('close', () => {
            logger.DEBUG('Client disconnected, killing FFmpeg remux');
            ffmpegProcess.kill('SIGKILL');
        });
    }

    async waitForFile(filePath: string, timeoutMs = 5000, intervalMs = 50): Promise<void> {
        const start = Date.now();

        while (Date.now() - start < timeoutMs) {
            if (await pathExists(filePath)) return;
            await new Promise(r => setTimeout(r, intervalMs));
        }

        throw new Error(`Timeout waiting for ${filePath}`);
    }

    async reportStatistics(sessionId: string, currentTime: number, isPaused: boolean): Promise<void> {
        const session = this.sessions.get(sessionId);

        if (!session) {
            throw new Error(`No session with id ${sessionId} found`);
        }

        const now = Date.now();

        const wasPaused = session.isPaused;
        session.isPaused = isPaused;
        session.currentTime = currentTime;
        session.lastAccessed = new Date(now);

        // Pause-Start merken
        if (isPaused && !wasPaused) {
            session.pauseStartedAt = now;
        }

        // Pause beendet → reset
        if (!isPaused && wasPaused) {
            session.pauseStartedAt = undefined;
        }

        const pauseStartedAt = session.pauseStartedAt;

        if (
            isPaused &&
            typeof pauseStartedAt === 'number' &&
            session.transcode?.status === 'running' &&
            PAUSE_TRANSCODE_AFTER > 0 &&
            now - pauseStartedAt > PAUSE_TRANSCODE_AFTER
        ) {
            logger.INFO(`Pausing transcode due to long pause [${sessionId}]`);
            await this.stopTranscode(session);
        }

        logger.DEBUG(`${BLUE}Session Heartbeat: ${sessionId} @ ${currentTime}s (${isPaused ? 'paused' : 'playing'})${RESET}`);
    }

    async handleSeek(sessionId: string, time: number): Promise<void> {
        return this.lock.acquire(`seek-${sessionId}`, async () => {
            const session = this.sessions.get(sessionId);
            if (!session) throw new Error(`No session ${sessionId}`);

            session.currentTime = time;
            session.lastAccessed = new Date();

            const targetSegment = Math.floor(time / SEGMENT_DURATION);
            const job = session.transcode;

            logger.INFO(`Seek ${sessionId} → ${time}s (segment ${targetSegment})`);

            if (session.decision.mode !== 'transcode') {
                return;
            }

            // Kein laufender Job → neu starten
            if (
                !job ||
                job.status !== 'running' ||
                !job.process ||
                job.process.killed
            ) {
                logger.DEBUG(`No active job → starting new transcode`);
                await this.startTranscode(session, targetSegment);
                return;
            }

            // Liegt der Seek im bereits generierten Fenster?
            if (
                job.lastGeneratedSegment !== undefined &&
                targetSegment >= job.startSegment &&
                targetSegment <= job.lastGeneratedSegment
            ) {
                logger.DEBUG(`Seek inside window (${job.startSegment}–${job.lastGeneratedSegment})`);
                return;
            }

            // Außerhalb → ffmpeg neu starten
            logger.INFO(`Seek outside window → restarting transcode`);
            await this.stopTranscode(session);
            await this.startTranscode(session, targetSegment);
        });
    }

    // async handleSeek(sessionId: string, time: number): Promise<void> {
    //     const session = this.sessions.get(sessionId);
    //     if (!session) {
    //         throw new Error(`No session with id ${sessionId} found`);
    //     }
    //
    //     session.currentTime = time;
    //     session.lastAccessed = new Date();
    //
    //     const targetSegment = Math.floor(time / SEGMENT_DURATION);
    //     logger.INFO(`${BLUE}Seek requested: ${sessionId} to ${time}s (segment ${targetSegment})${RESET}`);
    //
    //     if (session.decision.mode === 'transcode') {
    //         if (session.transcode?.status === 'running') {
    //             await this.stopTranscode(session);
    //         }
    //
    //         await this.startTranscode(session, targetSegment);
    //     }
    // }

    async handlePlaybackStop(sessionId: string, time?: number): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`No session with id ${sessionId} found`);
        }

        logger.INFO(`Stopping playback session: ${sessionId}`);

        this.saveResumeTime(session.file, session.currentTime);

        await this.stopTranscode(session);

        this.sessions.delete(sessionId);
    }

    saveResumeTime(file: MediaFile, time: number): void {
        // TODO : save "time" to implement the watch later feature
    }

    getSession(sessionId: string): PlaySession | undefined {
        return this.sessions.get(sessionId);
    }

    /**
     * Shutdown media service
     */
    async shutdown(): Promise<void> {
        logger.INFO('Shutting down StreamingService...');

        // Stop all active transcoding jobs
        for (const session of this.sessions.values()) {
            await this.stopTranscode(session);
        }

        this.sessions.clear();

        logger.INFO('StreamingService shutdown complete');
    }
}

const streamingService = new StreamingService();
export default streamingService;