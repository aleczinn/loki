import * as path from 'path';
import * as fs from 'fs-extra';
import * as crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import { findMediaFileById, getCombinedMetadata } from "../utils/media-utils";
import { MediaFile } from "../types/media-file";
import * as console from "node:console";
import { logger } from "../logger";

export const TRANSCODE_PATH = process.env.TRANSCODE_PATH || path.join(__dirname, '../../../loki/transcode');
export const METADATA_PATH = process.env.METADATA_PATH || path.join(__dirname, '../../../loki/metadata');
export const FFMPEG_HWACCEL = process.env.FFMPEG_HWACCEL || 'auto';

export const SEGMENT_DURATION = 4; // seconds per segment
export const FAST_START_SEGMENTS = 10; // segments to create quickly
export const SLOW_BUFFER_SEGMENTS = 5; // additional segments for slow transcoding

interface StreamSession {
    id: string;
    file: MediaFile;
    process: ffmpeg.FfmpegCommand | null;
    startSegment: number;
    latestSegment: number;
    targetSegment: number;
    mode: 'fast' | 'slow';
}

class StreamingService {

    private sessions: Map<string, StreamSession> = new Map();

    constructor() {
        logger.DEBUG(`Transcode path: ${TRANSCODE_PATH}`);
        logger.DEBUG(`Metadata path: ${METADATA_PATH}`);

        fs.ensureDirSync(TRANSCODE_PATH);
        fs.ensureDirSync(METADATA_PATH);

        // Load existing sessions on startup
        this.loadExistingSessions();
    }

    private async loadExistingSessions(): Promise<void> {
        try {
            if (!await fs.pathExists(TRANSCODE_PATH)) return;

            const dirs = await fs.readdir(TRANSCODE_PATH);
            for (const dir of dirs) {
                const sessionPath = path.join(TRANSCODE_PATH, dir);
                const stats = await fs.stat(sessionPath);

                console.log(sessionPath);

                if (stats.isDirectory()) {
                    // Check if segments exist
                    const files = await fs.readdir(sessionPath);
                    const segments = files.filter(f => f.match(/^segment\d+\.ts$/));

                    if (segments.length > 0) {
                        logger.DEBUG(`Found existing session ${dir} with ${segments.length} segments`);
                    }

                    const id = dir;
                    const file = await findMediaFileById(id);

                    if (!file) return;

                    const session: StreamSession = {
                        id: id,
                        file: file,
                        process: null,
                        startSegment: -1,
                        latestSegment: -1,
                        targetSegment: -1,
                        mode: 'fast'
                    }

                    this.sessions.set(id, session);
                }
            }
        } catch (error) {
            logger.ERROR(`Error loading existing sessions: ${error}`);
        }
    }

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

    async startTranscode(file: MediaFile, segment: number, mode: 'fast' | 'slow' = 'fast'): Promise<void> {
        const id = file.id;

        // Kill existing session if exists
        const existingSession = this.sessions.get(id);
        if (existingSession) {
            await this.killSession(id);
        }

        return new Promise((resolve) => {
            const dir = path.join(TRANSCODE_PATH, id);
            const playlistPath = path.join(dir, 'playlist.m3u8');
            const segmentPath = path.join(dir, 'segment%d.ts');
            const seekTime = segment * SEGMENT_DURATION;

            fs.ensureDirSync(dir);

            const framerate = file.metadata?.video[0]?.FrameRate || -1;
            const gopSize = framerate === -1 ? 250 : Math.round(framerate * SEGMENT_DURATION);

            // Calculate target duration based on mode
            let targetDuration: number = 0;
            let inputOptions = [
                '-copyts',
                '-ss', `${seekTime}`,
                '-threads 0',
            ];

            if (mode === 'fast') {
                targetDuration = FAST_START_SEGMENTS * SEGMENT_DURATION;
                logger.DEBUG(`Fast start: Creating ${FAST_START_SEGMENTS} segments from ${segment}`);
            } else {
                inputOptions.push('-re'); // Read at native frame rate to save CPU
                logger.DEBUG(`Slow transcode: Creating ${SLOW_BUFFER_SEGMENTS} segments from ${segment} with CPU saving`);
            }

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
                    `-start_number ${segment}`,
                    `-hls_segment_filename ${segmentPath}`,

                    // '-to', String(targetDuration) // Limit duration
                ])
                .output(playlistPath);

            const targetSegments = mode === 'fast' ? FAST_START_SEGMENTS : SLOW_BUFFER_SEGMENTS;
            const session: StreamSession = {
                id: file.id,
                file: file,
                process: command,
                startSegment: segment,
                latestSegment: segment,
                targetSegment: segment + targetSegments - 1,
                mode: mode
            };

            command.on('progress', (progress) => {
                const time = parseFloat(String(progress.timemark.split(':').reduce((acc, val, i) => acc + parseFloat(val) * Math.pow(60, 2 - i), 0)));
                const currentSegment = segment + Math.floor(time / SEGMENT_DURATION);

                const transcode = this.sessions.get(id);
                if (transcode) transcode.latestSegment = currentSegment;
            })
                .on('end', () => {
                    logger.DEBUG(`Transcoding for ${id} finished.`);
                    this.sessions.delete(id);
                })
                .on('error', (err) => {
                    logger.ERROR(`FFmpeg error for ${id}: ${err.message}`);
                    this.sessions.delete(id);
                });

            this.sessions.set(id, session);
            command.run();
            resolve();
        });
    }

    async killSession(id: string): Promise<void> {
        const session = this.sessions.get(id);
        if (!session) return;

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                logger.WARNING(`Force killing session ${id}`);
                try {
                    // session.process.kill('SIGKILL');
                } catch (e) {
                    // Process might already be dead
                }
                this.sessions.delete(id);
                resolve();
            }, 2000);

            // session.process.on('error', () => {
            //     clearTimeout(timeout);
            //     this.sessions.delete(id);
            //     resolve();
            // });

            // session.process.on('end', () => {
            //     clearTimeout(timeout);
            //     this.sessions.delete(id);
            //     resolve();
            // });

            // try {
            //     session.process.kill('SIGTERM');
            // } catch (e) {
            //     clearTimeout(timeout);
            //     this.sessions.delete(id);
            //     resolve();
            // }
        });
    }

    getSessions(): Map<string, StreamSession> {
        return this.sessions;
    }

    getSessionsFlat(): any[] {
        return Array.from(this.sessions.entries()).map(([id, session]) => ({
            id,
            file: session.file
        }));
    }

    async generateThumbnail(file: MediaFile, outputPath: string): Promise<void> {

    }

    /**
     * Shutdown media service
     */
    async shutdown(): Promise<void> {
        logger.INFO('Shutting down StreamingService...');
        logger.INFO('StreamingService shutdown complete');
    }
}

const mediaService = new StreamingService();

export default mediaService;
export { StreamingService, StreamSession };