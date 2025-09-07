import * as path from 'path';
import * as crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import { MediaFile } from "../types/media-file";
import { logger } from "../logger";
import AsyncLock from "async-lock";
import { ensureDir, ensureDirSync, pathExists, readFile, writeFile } from "../utils/file-utils";
import fs from "fs";

export const TRANSCODE_PATH = process.env.TRANSCODE_PATH || path.join(__dirname, '../../../loki/transcode');
export const METADATA_PATH = process.env.METADATA_PATH || path.join(__dirname, '../../../loki/metadata');
export const FFMPEG_HWACCEL = process.env.FFMPEG_HWACCEL || 'auto';

export const SEGMENT_DURATION = 4; // seconds per segment
export const SEGMENT_PUFFER_COUNT = 10; // is the number how many segments could technically be created in one transcoding call
export const SEGMENT_PUFFER_LOOK_AHEAD = 3; // defined the number where to check for future segments. (current segment + PUFFER_COUNT - x)
export const SEGMENT_OVERLAP_THRESHOLD = 3; // segments distance to consider reusing a job

interface TranscodeJob {
    id: string;
    process: ffmpeg.FfmpegCommand;
    startSegment: number;
    latestSegment: number;
    createdAt: Date;
}

interface StreamSession {
    id: string;
    token: string;
    file: MediaFile;
    quality: string;
    createdAt: Date;
    lastAccessed: Date;
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
            console.log("FILE ALREADY EXISTS");

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

        // Add session token as custom tag for client
        // playlist += `#EXT-X-SESSION-TOKEN:${session.token}\n\n`;

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


    // private async loadExistingSessions(): Promise<void> {
    //     try {
    //         if (!await fs.pathExists(TRANSCODE_PATH)) return;
    //
    //         const dirs = await fs.readdir(TRANSCODE_PATH);
    //         for (const dir of dirs) {
    //             const sessionPath = path.join(TRANSCODE_PATH, dir);
    //             const stats = await fs.stat(sessionPath);
    //
    //             if (stats.isDirectory()) {
    //                 // Check if segments exist
    //                 const files = await fs.readdir(sessionPath);
    //                 const segments = files.filter(f => f.match(/^segment\d+\.ts$/));
    //
    //                 if (segments.length > 0) {
    //                     const id = dir;
    //                     const file = await findMediaFileById(id);
    //                     if (!file) continue;
    //
    //                     // Extract segment numbers from existing files
    //                     const completedSegments = new Set<number>();
    //                     segments.forEach(seg => {
    //                         const match = seg.match(/segment(\d+)\.ts/);
    //                         if (match) {
    //                             completedSegments.add(parseInt(match[1]));
    //                         }
    //                     });
    //
    //                     logger.DEBUG(`Found existing session ${dir} with ${completedSegments.values()} segments`);
    //
    //                     const session: StreamSession = {
    //                         id: id,
    //                         file: file,
    //                         jobs: new Map(),
    //                         pendingSegments: new Set(),
    //                         completedSegments: completedSegments,
    //                         waitingClients: new Map()
    //                     };
    //
    //                     this.sessions.set(id, session);
    //                 }
    //             }
    //         }
    //     } catch (error) {
    //         logger.ERROR(`Error loading existing sessions: ${error}`);
    //     }
    // }


    private async startTranscode(session: StreamSession, startSegment: number): Promise<void> {
        const file = session.file;
        const jobId = `${session.id}-${startSegment}-${Date.now()}`;

        const dir = path.join(TRANSCODE_PATH, session.id);
        const playlistPath = path.join(dir, `playlist-${jobId}.m3u8`);
        const segmentPath = path.join(dir, 'segment%d.ts');
        const seekTime = startSegment * SEGMENT_DURATION;

        await ensureDir(dir);

        const framerate = file.metadata?.video[0]?.FrameRate || -1;
        const gopSize = framerate === -1 ? 250 : Math.round(framerate * SEGMENT_DURATION);

        // Calculate target segments based on mode
        let inputOptions = [
            '-copyts',
            '-ss', `${seekTime}`,
            '-threads 0',
        ];

        const command = ffmpeg(file.path)
            .inputOptions(inputOptions)
            .videoCodec('libx264')
            .audioCodec('aac')
            .outputOptions([
                // GENERAL
                '-copyts',
                '-map', '0',
                '-force_key_frames', `expr:gte(t,n_forced*${SEGMENT_DURATION})`,

                // VIDEO
                '-pix_fmt', 'yuv420p',
                '-preset veryfast',
                '-crf', '24',
                `-g ${gopSize}`,
                '-sc_threshold', '0',

                // AUDIO
                '-b:a', '192k',
                '-ac', '2',

                // HLS
                '-f', 'hls',
                `-hls_time ${SEGMENT_DURATION}`,
                '-hls_list_size 0',
                '-hls_playlist_type vod',
                '-hls_flags', 'independent_segments',
                `-start_number ${startSegment}`,
                `-hls_segment_filename ${segmentPath}`,
            ])
            .output(playlistPath);

        // const job: TranscodeJob = {
        //     id: jobId,
        //     process: command,
        //     startSegment: startSegment,
        //     latestSegment: startSegment - 1,
        //     targetSegment: startSegment + targetSegments - 1,
        //     mode: mode,
        //     createdAt: new Date()
        // };

        // Mark target segments as pending
        // for (let i = startSegment; i <= job.targetSegment; i++) {
        //     session.pendingSegments.add(i);
        // }

        // command.on('progress', (progress) => {
        //     const time = parseFloat(String(progress.timemark.split(':').reduce((acc, val, i) => acc + parseFloat(val) * Math.pow(60, 2 - i), 0)));
        //     const currentSegment = startSegment + Math.floor(time / SEGMENT_DURATION);
        //
        //     // Update completed segments
        //     for (let i = job.latestSegment + 1; i <= currentSegment; i++) {
        //         session.pendingSegments.delete(i);
        //         session.completedSegments.add(i);
        //
        //         // Notify waiting clients
        //         const waiting = session.waitingClients.get(i);
        //         if (waiting) {
        //             waiting.forEach(callback => callback(true));
        //             session.waitingClients.delete(i);
        //         }
        //     }
        //
        //     job.latestSegment = currentSegment;
        // })
        //     .on('end', () => {
        //         logger.DEBUG(`Job ${jobId} finished (mode: ${mode})`);
        //
        //         // Mark all remaining segments as completed
        //         for (let i = job.startSegment; i <= job.targetSegment; i++) {
        //             if (session.pendingSegments.has(i)) {
        //                 session.pendingSegments.delete(i);
        //                 session.completedSegments.add(i);
        //                 const waiting = session.waitingClients.get(i);
        //                 if (waiting) {
        //                     waiting.forEach(callback => callback(true));
        //                     session.waitingClients.delete(i);
        //                 }
        //             }
        //         }
        //
        //         // Remove job from session
        //         session.jobs.delete(jobId);
        //
        //         // Clean up temporary playlist
        //         fs.unlink(playlistPath);
        //
        //         // Start slow transcode if this was fast mode and we need more segments
        //         const duration = file.metadata?.video[0].Duration || 0;
        //         if (mode === 'fast' && job.targetSegment < Math.ceil(duration / SEGMENT_DURATION) - 1) {
        //             const nextSegment = job.targetSegment + 1;
        //             // Check if another job is already handling these segments
        //             const existingJob = this.findSuitableJob(session, nextSegment);
        //             if (!existingJob) {
        //                 logger.DEBUG(`Starting follow-up slow transcode from segment ${nextSegment}`);
        //                 this.startTranscodeJob(session, nextSegment, 'slow');
        //             }
        //         }
        //     })
        //     .on('error', (err) => {
        //         logger.ERROR(`Job ${jobId} error: ${err.message}`);
        //
        //         // Clean up pending segments
        //         for (let i = job.startSegment; i <= job.targetSegment; i++) {
        //             if (session.pendingSegments.has(i)) {
        //                 session.pendingSegments.delete(i);
        //             }
        //         }
        //
        //         // Notify waiting clients
        //         for (let i = job.startSegment; i <= job.targetSegment; i++) {
        //             const waiting = session.waitingClients.get(i);
        //             if (waiting) {
        //                 waiting.forEach(callback => callback(false));
        //                 session.waitingClients.delete(i);
        //             }
        //         }
        //
        //         // Remove job
        //         session.jobs.delete(jobId);
        //
        //         // Clean up temporary playlist
        //         fs.unlink(playlistPath);
        //     });

        // session.jobs.set(jobId, job);
        // command.run();
    }

    async killSession(id: string): Promise<void> {
        // return this.lock.acquire(`media-${id}`, async () => {
        //     const session = this.sessions.get(id);
        //     if (!session) return;
        //
        //     // Kill all jobs in the session
        //     const killPromises = Array.from(session.jobs.values()).map(job => {
        //         return new Promise<void>((resolve) => {
        //             const timeout = setTimeout(() => {
        //                 logger.WARNING(`Force killing job ${job.id}`);
        //                 try {
        //                     job.process.kill('SIGKILL');
        //                 } catch (e) {
        //                     // Process might already be dead
        //                 }
        //                 resolve();
        //             }, 2000);
        //
        //             job.process.on('error', () => {
        //                 clearTimeout(timeout);
        //                 resolve();
        //             });
        //
        //             job.process.on('end', () => {
        //                 clearTimeout(timeout);
        //                 resolve();
        //             });
        //
        //             try {
        //                 job.process.kill('SIGTERM');
        //             } catch (e) {
        //                 clearTimeout(timeout);
        //                 resolve();
        //             }
        //         });
        //     });
        //
        //     await Promise.all(killPromises);
        //
        //     // Clear all jobs
        //     session.jobs.clear();
        //
        //     // Notify all waiting clients
        //     session.waitingClients.forEach((callbacks) => {
        //         callbacks.forEach(callback => callback(false));
        //     });
        //     session.waitingClients.clear();
        //     session.pendingSegments.clear();
        // });
    }

    getSessionInfo() {
        // return Array.from(this.sessions.entries()).map(([id, session]) => ({
        //     id,
        //     fileName: session.file.name,
        //     filePath: session.file.path,
        //     isTranscoding: session.jobs.size > 0,
        //     activeJobs: session.jobs.size,
        //     // jobs: Array.from(session.jobs.values()).map(job => ({
        //     //     id: job.id,
        //     //     mode: job.mode,
        //     //     startSegment: job.startSegment,
        //     //     latestSegment: job.latestSegment,
        //     //     targetSegment: job.targetSegment,
        //     //     age: Math.floor((Date.now() - job.createdAt.getTime()) / 1000)
        //     // })),
        //     completedSegments: session.completedSegments.size,
        //     pendingSegments: session.pendingSegments.size,
        //     waitingClients: session.waitingClients.size
        // }));
        return '';
    }

    getSessions(): Map<string, StreamSession> {
        return this.sessions;
    }

    getSessionsFlat(): StreamSession[] {
        return Array.from(this.sessions.values());
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
                    filename,
                    folder
                })
        });
    }

    /**
     * Shutdown media service
     */
    async shutdown(): Promise<void> {
        logger.INFO('Shutting down StreamingService...');

        // Kill all active sessions
        // for (const [id, session] of this.sessions) {
        //     if (session.jobs.size > 0) {
        //         await this.killSession(id);
        //     }
        // }

        logger.INFO('StreamingService shutdown complete');
    }
}

const streamingService = new StreamingService();

export default streamingService;
export { StreamingService, StreamSession };