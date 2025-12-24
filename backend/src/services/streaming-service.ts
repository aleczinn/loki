import * as path from 'path';
import { MediaFile } from "../types/media-file";
import { logger } from "../logger";
import AsyncLock from "async-lock";
import { deleteFile, ensureDir, pathExists, readdir, readFile, writeFile } from "../utils/file-utils";
import { ChildProcess, spawn } from 'child_process';
import { TRANSCODE_PATH } from "../app";
import transcodeDecisionService, { QualityProfile, TranscodeDecision } from "./transcode-decision";
import { ClientInfo } from "../types/client-info";
import { FFMPEG_PATH } from "../utils/ffmpeg";
import { BLUE, GREEN, MAGENTA, RESET, WHITE, YELLOW } from "../utils/utils";
import { getTranscodingArgs } from "./transcoding-profiles";

export const SEGMENT_DURATION = 4; // seconds per segment
export const PAUSE_TRANSCODE_AFTER = 30000; // pause transcode after x milliseconds. -1 means no pausing.

interface TranscodeJob {
    id: string;
    process?: ChildProcess;
    status: 'running' | 'stopped' | 'completed';
    startSegment: number;
}

interface SegmentRange {
    start: number;
    end: number;
}

export interface PlaySession {
    id: string;
    client: ClientInfo;
    file: MediaFile;

    decision: TranscodeDecision;

    audioIndex: number;
    subtitleIndex?: number;

    createdAt: Date;
    lastAccessed: Date;

    currentTime: number;
    isPaused: boolean;
    pauseStartedAt?: number;

    transcode?: TranscodeJob;
    availableSegments: SegmentRange[];
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
            pauseStartedAt: -1,
            availableSegments: []
        };

        this.sessions.set(sessionId, session);
        logger.INFO(`Created new session: ${sessionId}`);
        return session;
    }

    async getPlaylist(session: PlaySession): Promise<string> {
        const file = session.file;
        const dir = path.join(TRANSCODE_PATH, session.id, session.decision.profile);
        const playlistPath = path.join(dir, 'playlist.m3u8');

        await ensureDir(dir);

        if (await pathExists(playlistPath)) {
            return await readFile(playlistPath, "utf-8");
        }

        const duration = file.metadata?.general.Duration || -1;
        if (duration === -1) {
            throw new Error('Invalid media duration. Something is wrong with the metadata!');
        }
        const totalSegments = Math.ceil(duration / SEGMENT_DURATION);

        let playlist = '#EXTM3U\n';
        playlist += '#EXT-X-VERSION:3\n';
        playlist += `#EXT-X-TARGETDURATION:${SEGMENT_DURATION}\n`;
        playlist += '#EXT-X-MEDIA-SEQUENCE:0\n';
        playlist += '#EXT-X-PLAYLIST-TYPE:VOD\n\n';

        for (let i = 0; i < totalSegments; i++) {
            const segmentDuration = Math.min(
                SEGMENT_DURATION,
                duration - (i * SEGMENT_DURATION)
            );
            playlist += `#EXTINF:${segmentDuration.toFixed(6)},\n`;
            playlist += `/api/videos/hls/${session.id}/segment${i}.ts\n`;
        }

        playlist += '#EXT-X-ENDLIST\n';

        await writeFile(playlistPath, playlist);
        logger.INFO(`Generated playlist for session ${session.id}`);

        return playlist;
    }

    async getSegment(session: PlaySession, segmentIndex: number): Promise<string | null> {
        const dir = path.join(TRANSCODE_PATH, session.id, session.decision.profile);
        const segmentPath = path.join(dir, `segment${segmentIndex}.ts`);

        session.lastAccessed = new Date();

        if (await pathExists(segmentPath)) {
            logger.DEBUG(`${WHITE}Serving existing segment ${segmentIndex} for session ${session.id}${RESET}`);
            return segmentPath;
        }

        await this.ensureTranscodeRunning(session, segmentIndex);
        return null;
    }

    private async ensureTranscodeRunning(session: PlaySession, requestedSegment: number): Promise<void> {
        return this.lock.acquire(`transcode-${session.id}`, async () => {
            if (!session.transcode || session.transcode.status !== 'running') {
                const startSegment = Math.floor(session.currentTime / SEGMENT_DURATION);
                await this.startTranscode(session, startSegment);
            }
        });
    }

    private async startTranscode(session: PlaySession, startSegment: number): Promise<void> {
        const dir = path.join(TRANSCODE_PATH, session.id, session.decision.profile);
        await ensureDir(dir);

        const jobId = crypto.randomUUID();

        const job: TranscodeJob = {
            id: jobId,
            status: 'running',
            startSegment,
        };

        session.transcode = job;

        const file = session.file;
        const duration = file.metadata?.general.Duration || -1;
        if (duration === -1) {
            throw new Error('Invalid media duration. Something is wrong with the metadata!');
        }

        const seekTime = startSegment * SEGMENT_DURATION;
        const tempPlaylistPath = path.join(dir, `temp_${jobId}.m3u8`);
        const segmentPath = path.join(dir, 'segment%d.ts');
        const framerate = file.metadata?.video[0]?.FrameRate || -1;
        const gopSize = framerate === -1 ? 250 : Math.round(framerate * SEGMENT_DURATION);

        const transcodingArgs = getTranscodingArgs(session.decision.profile, session.client.capabilities);

        const tempVideoOptions = [
            '-vf', 'scale=-2:1080',
            '-preset', 'veryfast',
            '-b:v', '20000k',
            '-maxrate', '22000k',
            '-bufsize', '40000k',
        ];

        const tempAudioOptions = [
            '-c:a', 'aac',
            '-b:a', '192k',
            '-ac', '2',
            '-ar', '48000',
        ]

        const args = [
            // Input
            '-copyts',
            '-ss', String(seekTime),
            '-i', file.path,

            '-threads', '0',

            // Hardware Acceleration Method
            '-c:v', 'libx264',

            // Video
            '-pix_fmt', 'yuv420p',
            ...tempVideoOptions,
            '-g', String(gopSize),
            '-sc_threshold', '0',
            '-force_key_frames', `expr:gte(t,n_forced*${SEGMENT_DURATION})`,

            // Audio
            ...tempAudioOptions,

            // Mapping
            '-map', '0:v:0',  // Erster Video stream
            '-map', '0:a:0',  // Erster Audio stream

            // HLS
            '-f', 'hls',
            '-hls_time', String(SEGMENT_DURATION),
            '-hls_list_size', '0',
            '-hls_playlist_type', 'vod',
            '-hls_flags', 'independent_segments+temp_file',
            '-start_number', String(startSegment),
            '-hls_segment_filename', segmentPath,

            '-progress', 'pipe:1',
            '-nostats',
            '-loglevel', 'error',

            // Output
            tempPlaylistPath
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
                        const timeMs = parseInt(match[1]);
                        const timeSec = timeMs / 1000000;  // Microseconds to seconds
                        const percent = (timeSec / duration) * 100;

                        logger.INFO(`${BLUE}Progress: ${percent.toFixed(1)}% [${session.id}]${RESET}`);
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

                // Cleanup temp playlist nach erfolgreichem Transcoding
                try {
                    await deleteFile(tempPlaylistPath);
                } catch (e) {}
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
                } catch (e) {
                    // Ignorieren
                }
            }
        }

        session.transcode = undefined;
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

        logger.DEBUG(`${MAGENTA}Progress: ${sessionId} @ ${currentTime}s (${isPaused ? 'paused' : 'playing'})${RESET}`);
    }

    async handleSeek(sessionId: string, time: number): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`No session with id ${sessionId} found`);
        }

        session.currentTime = time;
        session.lastAccessed = new Date();

        const targetSegment = Math.floor(time / SEGMENT_DURATION);
        logger.INFO(`Seek requested: ${sessionId} to ${time}s (segment ${targetSegment})`);

        if (session.decision.mode === 'transcode') {
            if (session.transcode?.status === 'running') {
                await this.stopTranscode(session);
            }

            await this.startTranscode(session, targetSegment);
        }
    }

    async handlePlaybackStop(sessionId: string, time?: number): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`No session with id ${sessionId} found`);
        }

        logger.INFO(`Stopping playback session: ${sessionId}`);

        // TODO : save "time" to implement the watch later feature

        await this.stopTranscode(session);

        this.sessions.delete(sessionId);
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