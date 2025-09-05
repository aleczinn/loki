import * as path from 'path';
import * as fs from 'fs-extra';
import * as crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import { MediaFile } from "../types/media-file";
import * as console from "node:console";
import { logger } from "../logger";
import AsyncLock from "async-lock";
import { ClientInfo } from "../types/client-info";

export const TRANSCODE_PATH = process.env.TRANSCODE_PATH || path.join(__dirname, '../../../loki/transcode');
export const METADATA_PATH = process.env.METADATA_PATH || path.join(__dirname, '../../../loki/metadata');
export const FFMPEG_HWACCEL = process.env.FFMPEG_HWACCEL || 'auto';

export const SEGMENT_DURATION = 4; // seconds per segment
export const SEGMENT_FAST_START_SEGMENTS = 30;

export const THROTTLE_TRANSCODE = false;

interface TranscodeJob {
    id: string;
    process: ffmpeg.FfmpegCommand;
    startSegment: number;
    targetSegment: number;
    latestSegment: number;
    createdAt: Date;
}

interface StreamSession {
    token: string;
    file: MediaFile;
    process: ffmpeg.FfmpegCommand | null;
    completedSegments: Set<number>;
    clientInfo: ClientInfo;
}

class StreamingService {
    private sessions: Map<string, StreamSession> = new Map();
    private lock = new AsyncLock();

    constructor() {
        logger.INFO(`Transcode path: ${TRANSCODE_PATH}`);
        logger.INFO(`Metadata path: ${METADATA_PATH}`);

        fs.ensureDirSync(TRANSCODE_PATH);
        fs.ensureDirSync(METADATA_PATH);

        // Load existing sessions on startup
        // this.loadExistingSessions();
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

    async generatePlaylist(file: MediaFile): Promise<{ id: string; playlistPath: string }> {
        const id = file.id;
        const dir = path.join(TRANSCODE_PATH, id);
        const playlistPath = path.join(dir, 'playlist.m3u8');

        await fs.ensureDir(dir);

        if (await fs.pathExists(playlistPath)) {
            return { id, playlistPath };
        }

        const duration = file.metadata?.general.Duration || -1;
        if (duration === -1) {
            throw new Error('duration must be greater than 0');
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

        await fs.writeFile(playlistPath, playlist);

        return { id, playlistPath };
    }


    private async startTranscode(session: StreamSession, startSegment: number): Promise<void> {

    }

    private async killSession(id: string): Promise<void> {
        return this.lock.acquire(`media-${id}`, async () => {
            const session = this.sessions.get(id);
            if (!session) return;

            // Kill all jobs in the session
            const killPromises = Array.from(session.jobs.values()).map(job => {
                return new Promise<void>((resolve) => {
                    const timeout = setTimeout(() => {
                        logger.WARNING(`Force killing job ${job.id}`);
                        try {
                            job.process.kill('SIGKILL');
                        } catch (e) {
                            // Process might already be dead
                        }
                        resolve();
                    }, 2000);

                    job.process.on('error', () => {
                        clearTimeout(timeout);
                        resolve();
                    });

                    job.process.on('end', () => {
                        clearTimeout(timeout);
                        resolve();
                    });

                    try {
                        job.process.kill('SIGTERM');
                    } catch (e) {
                        clearTimeout(timeout);
                        resolve();
                    }
                });
            });

            await Promise.all(killPromises);

            // Clear all jobs
            session.jobs.clear();

            // Notify all waiting clients
            session.waitingClients.forEach((callbacks) => {
                callbacks.forEach(callback => callback(false));
            });
            session.waitingClients.clear();
            session.pendingSegments.clear();
        });
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
        for (const [id, session] of this.sessions) {
            if (session.jobs.size > 0) {
                await this.killSession(id);
            }
        }

        logger.INFO('StreamingService shutdown complete');
    }
}

const streamingService = new StreamingService();

export default streamingService;
export { StreamingService, StreamSession };