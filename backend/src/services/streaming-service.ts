import * as path from 'path';
import * as crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import { MediaFile } from "../types/media-file";
import { logger } from "../logger";
import AsyncLock from "async-lock";
import { clearDir, deleteFile, ensureDir, ensureDirSync, pathExists, readFile, writeFile } from "../utils/file-utils";
import { BLUE, CYAN, GREEN, MAGENTA, RED, RESET, sleep, YELLOW } from "../utils/utils";
import { spawn, ChildProcess } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';

export const TRANSCODE_PATH = process.env.TRANSCODE_PATH || path.join(__dirname, '../../../loki/transcode');
export const METADATA_PATH = process.env.METADATA_PATH || path.join(__dirname, '../../../loki/metadata');
export const FFMPEG_HWACCEL = process.env.FFMPEG_HWACCEL || 'auto';

export const SEGMENT_DURATION = 4; // seconds per segment
export const SEGMENT_PUFFER_COUNT = 10; // is the number how many segments could technically be created in one transcoding call
export const SEGMENT_PUFFER_LOOK_AHEAD = 3; // defined the number where to check for future segments. (current segment + PUFFER_COUNT - x)
export const SEGMENT_OVERLAP_THRESHOLD = 3; // segments distance to consider reusing a job
export const SEEK_THRESHOLD = 3; // is the number in segments when to cancel a transcode while seeking

let GLOBAL_INDEX = 0;

interface TranscodeJob {
    id: string;
    sessionId: string;
    process?: ChildProcess;
    status: 'running' | 'stopped' | 'completed';
    startSegment: number;
    createdAt: Date;
    index: number;
}

interface StreamSession {
    id: string;
    token: string;
    file: MediaFile;
    quality: string;
    createdAt: Date;
    lastAccessed: Date;
    transcode?: TranscodeJob;
}

interface QualityOptions {
    videoOptions: string[]
    audioOptions: string[]
}

class StreamingService {

    private sessions: Map<string, StreamSession> = new Map();
    private activeJobs: Map<string, TranscodeJob> = new Map();

    private lock = new AsyncLock();

    constructor() {
        logger.INFO(`Transcode path: ${TRANSCODE_PATH}`);
        logger.INFO(`Metadata path: ${METADATA_PATH}`);

        ensureDirSync(TRANSCODE_PATH);
        ensureDirSync(METADATA_PATH);

        // TODO : Temp to clear transcode folder
        clearDir(TRANSCODE_PATH);
    }

    /**
     * Generate or retrieve token for a client
     */
    private generateToken(): string {
        // Generate hash-based token
        const timestamp = Date.now().toString();
        const random = crypto.randomBytes(16).toString('hex');
        return crypto
            .createHash('sha256')
            .update(`${timestamp}-${random}`)
            .digest('hex')
            .substring(0, 32); // Use first 32 chars for shorter tokens
    }

    async getOrCreateSession(file: MediaFile, quality: string, token?: string): Promise<StreamSession> {
        const sessionToken = token || this.generateToken();
        const sessionId = `${sessionToken}-${file.id}-${quality}`;

        return await this.lock.acquire(sessionId, async () => {
            if (this.sessions.has(sessionId)) {
                const session = this.sessions.get(sessionId)!;
                session.lastAccessed = new Date();
                return session;
            }

            // Create new session
            const session: StreamSession = {
                id: sessionId,
                token: sessionToken,
                file,
                quality,
                createdAt: new Date(),
                lastAccessed: new Date()
            };

            this.sessions.set(sessionId, session);
            logger.INFO(`Created new session: ${sessionId}`);

            return session;
        });
    }

    async generatePlaylist(file: MediaFile, quality: string, token?: string): Promise<{ playlist: string; token: string }> {
        const session = await this.getOrCreateSession(file, quality, token);

        const dir = path.join(TRANSCODE_PATH, session.token, file.id, quality);
        const playlistPath = path.join(dir, 'playlist.m3u8');

        await ensureDir(dir);

        if (await pathExists(playlistPath)) {
            const playlist = await readFile(playlistPath, "utf-8");

            return {
                playlist,
                token: session.token
            };
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
            playlist += `segment${i}.ts\n`;
        }

        playlist += '#EXT-X-ENDLIST\n';

        await writeFile(playlistPath, playlist);
        logger.INFO(`Generated playlist for session ${session.id}`);

        return {
            playlist,
            token: session.token
        };
    }

    async handleSegment(file: MediaFile, segmentIndex: number, quality: string, token?: string): Promise<{ path: string | null; token: string }> {
        const session = await this.getOrCreateSession(file, quality, token);

        const dir = path.join(TRANSCODE_PATH, session.token, file.id, quality);
        const segmentPath = path.join(dir, `segment${segmentIndex}.ts`);

        // Check if segment already exists
        if (await pathExists(segmentPath)) {
            logger.DEBUG(`Serving existing segment ${segmentIndex} for session ${session.id}`);

            return {
                path: segmentPath,
                token: session.token
            };
        }

        await this.handleTranscode(session, segmentIndex);

        // Check again after short delay (segment might be ready now)
        await sleep(100);

        if (await pathExists(segmentPath)) {
            return {
                path: segmentPath,
                token: session.token
            };
        }

        return {
            path: null,
            token: session.token
        };
    }

    private async handleTranscode(session: StreamSession, requestedSegment: number): Promise<void> {
        return await this.lock.acquire(`transcode-${session.id}`, async () => {
            const currentJob = this.activeJobs.get(session.id);

            if (currentJob && currentJob.status === 'running') {
                const seekDistance = Math.abs(requestedSegment - currentJob.startSegment);

                if (seekDistance > SEEK_THRESHOLD) {
                    // User seeked, restart transcoding from new position
                    logger.DEBUG(`${YELLOW}Seek detected: segment ${currentJob.startSegment} → ${requestedSegment} (distance: ${seekDistance})${RESET}`);
                    await this.stopTranscode(session);
                    await this.startTranscode(session, requestedSegment);
                } else {
                    // Update current segment tracking
                    currentJob.startSegment = Math.max(currentJob.startSegment, requestedSegment);
                    logger.DEBUG(`Segment ${requestedSegment} within threshold, continuing transcode`);
                }
            } else {
                // No active job or job completed, start new one
                await this.startTranscode(session, requestedSegment);
            }
        });
    }

    private async startTranscode(session: StreamSession, startSegment: number): Promise<void> {
        // Type-Check für ffmpegPath
        if (!ffmpegStatic) {
            throw new Error('FFmpeg binary not found. Please ensure ffmpeg-static is properly installed.');
        }

        const ffmpegPath: string = ffmpegStatic;

        const file = session.file;
        const jobId = crypto.randomBytes(8).toString('hex');

        const duration = file.metadata?.general.Duration || -1;
        if (duration === -1) {
            throw new Error('Invalid media duration. Something is wrong with the metadata!');
        }

        const totalSegments = Math.ceil(duration / SEGMENT_DURATION);
        const dir = path.join(TRANSCODE_PATH, session.token, file.id, session.quality);

        await ensureDir(dir);

        const seekTime = startSegment * SEGMENT_DURATION;

        const tempPlaylistPath = path.join(dir, `temp_${jobId}.m3u8`);
        const segmentPath = path.join(dir, 'segment%d.ts');

        const qualityOptions = this.getQualityOptions(session.quality);

        const framerate = file.metadata?.video[0]?.FrameRate || -1;
        const gopSize = framerate === -1 ? 250 : Math.round(framerate * SEGMENT_DURATION);

        // FFmpeg Arguments als Array
        const args = [
            // Input
            '-copyts',
            '-ss', String(seekTime),
            '-i', file.path,
            '-threads', '0',

            // Video
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-preset', 'veryfast',
            '-crf', '24',
            '-g', String(gopSize),
            '-sc_threshold', '0',
            '-force_key_frames', `expr:gte(t,n_forced*${SEGMENT_DURATION})`,

            // Audio
            '-c:a', 'aac',
            '-b:a', '192k',
            '-ac', '2',
            '-ar', '48000',

            // Mapping
            '-map', '0:v:0',  // Erster Video Stream
            '-map', '0:a',    // Alle Audio Streams

            // HLS
            '-f', 'hls',
            '-hls_time', String(SEGMENT_DURATION),
            '-hls_list_size', '0',
            '-hls_playlist_type', 'vod',
            '-hls_flags', 'independent_segments',
            '-start_number', String(startSegment),
            '-hls_segment_filename', segmentPath,

            // Progress reporting
            '-progress', 'pipe:1',  // Progress to stdout
            '-nostats',              // Keine Stats im stderr

            // Output
            tempPlaylistPath
        ];

        const job: TranscodeJob = {
            id: jobId,
            sessionId: session.id,
            startSegment: startSegment,
            status: 'running',
            createdAt: new Date(),
            index: GLOBAL_INDEX++
        };

        // FFmpeg spawnen
        const ffmpegProcess: ChildProcess = spawn(ffmpegPath, args);
        job.process = ffmpegProcess;

        logger.INFO(`${GREEN}Transcode started [${session.id}]: segment ${startSegment} [Index: ${job.index}]${RESET}`);

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

                        logger.INFO(`${BLUE}Progress: ${percent.toFixed(1)}% [Index: ${job.index}]${RESET}`);
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
                logger.DEBUG(`Process stopped by user [Index: ${job.index}]`);
                return;
            }

            if (code === 0) {
                logger.INFO(`${MAGENTA}Transcode completed [${session.id}] [Index: ${job.index}]${RESET}`);
                job.status = 'completed';

                // Cleanup temp playlist nach erfolgreichem Transcoding
                try {
                    await deleteFile(tempPlaylistPath);
                } catch (e) {}
            } else if (signal === 'SIGKILL') {
                logger.DEBUG(`Process killed [Index: ${job.index}]`);
            } else {
                logger.ERROR(`FFmpeg exited with code ${code} [Index: ${job.index}]`);
                job.status = 'stopped';
            }

            this.activeJobs.delete(session.id);
        });

        this.activeJobs.set(session.id, job);
        session.transcode = job;
    }

    async stopTranscode(session: StreamSession): Promise<void> {
        const job = this.activeJobs.get(session.id);

        if (!job || job.status !== 'running') return;

        logger.INFO(`Stopping transcode [${session.id}] [Index: ${job.index}]`);

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

        // Sofort aus Map entfernen
        this.activeJobs.delete(session.id);
        session.transcode = undefined;
    }

    /**
     * Get quality settings based on preset
     */
    private getQualityOptions(quality: string): QualityOptions {
        const settings: Record<string, QualityOptions> = {
            '1080p_20mbps': {
                videoOptions: [
                    '-vf', '-1:1080',
                    '-preset veryfast',
                    '-crf', '24',
                    '-b:v', '20000k'
                ],
                audioOptions: [
                    '-b:a', '192k',
                    '-ac', '2',
                    '-ar', '48000',
                ]
            },
            '720p_6mbps': {
                videoOptions: [
                    '-vf', '-1:720',
                    '-preset veryfast',
                    '-crf', '24',
                    '-b:v', '6000k'
                ],
                audioOptions: [
                    '-b:a', '128k',
                    '-ac', '2',
                    '-ar', '48000',
                ]
            },
            '480p_3mbps': {
                videoOptions: [
                    '-vf', '-1:480',
                    '-preset veryfast',
                    '-crf', '24',
                    '-b:v', '3000k'
                ],
                audioOptions: [
                    '-b:a', '128k',
                    '-ac', '2',
                    '-ar', '48000',
                ]
            },
            '360p_1mbps': {
                videoOptions: [
                    '-vf', '-1:360',
                    '-preset veryfast',
                    '-crf', '24',
                    '-b:v', '1000k'
                ],
                audioOptions: [
                    '-b:a', '128k',
                    '-ac', '2',
                    '-ar', '48000',
                ]
            }
        };

        return settings[quality] || settings['720p_6mbps'];
    }

    getSessionInfo() {
        return {
            activeSessions: this.sessions.size,
            activeTranscodes: this.activeJobs.size,
            sessions: Array.from(this.sessions.values()).map(session => ({
                token: session.token,
                id: session.id,
                file: session.file,
                quality: session.quality,
                createdAt: session.createdAt,
                lastAccessed: session.lastAccessed,
                hasActiveTranscode: this.activeJobs.has(session.id)
            }))
        }
    }

    getSessions(): Map<string, StreamSession> {
        return this.sessions;
    }

    /**
     * Generate a thumbnail at the specified timestamp.
     * @param file the media file
     * @param outputPath the specified output path
     * @param atSecond timestamp where to take a screenshot. -1 means at the half of the video.
     */
    async generateThumbnail(file: MediaFile, outputPath: string, atSecond: number = -1): Promise<void> {
        return new Promise((resolve, reject) => {
            const folder = path.dirname(outputPath);
            const filename = path.basename(outputPath);

            let timestamp: number;
            const duration = file.metadata?.video[0]?.Duration || 0;

            if (atSecond === -1) {
                if (!duration || isNaN(duration)) {
                    return reject(new Error('No valid duration in metadata to calculate midpoint.'));
                }
                timestamp = duration / 2;
            } else {
                timestamp = atSecond;
            }

            ffmpeg(file.path)
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .screenshot({
                    timestamps: [timestamp],
                    filename: filename,
                    folder: folder
                })
        });
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
        this.activeJobs.clear();

        logger.INFO('StreamingService shutdown complete');
    }
}

const streamingService = new StreamingService();

export default streamingService;
export { StreamingService, StreamSession };