import * as path from 'path';
import * as fs from 'fs-extra';
import * as crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import { TRANSCODE_PATH } from "../app";
import { getCombinedMetadata } from "../utils/media-utils";
import { MediaFile } from "../types/media-file";
import * as console from "node:console";
import { logger } from "../logger";

export const SEGMENT_DURATION = 4; // seconds per segment

interface StreamSession {
    process: ffmpeg.FfmpegCommand;
    startSegment: number;
    latestSegment: number;
    file: MediaFile;
    outputDir: string;
    cleanupTimer: NodeJS.Timeout | null;
}

class MediaService {
    private sessions: Map<string, StreamSession> = new Map();

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

    async startTranscode(file: MediaFile, segment: number): Promise<void> {
        return new Promise((resolve) => {
            const id = file.id;
            const dir = path.join(TRANSCODE_PATH, id);
            const playlistPath = path.join(dir, 'playlist.m3u8');
            const segmentPath = path.join(dir, 'segment%d.ts');
            const seekTime = segment * SEGMENT_DURATION;

            fs.ensureDirSync(dir);

            const framerate = file.metadata?.video[0]?.FrameRate || -1;
            const gopSize = framerate === -1 ? 250 : Math.round(framerate * SEGMENT_DURATION);

            const command = ffmpeg(file.path)
                .inputOptions([
                    '-copyts',
                    '-ss', `${seekTime}`,
                    '-threads 0',
                ])
                .videoCodec('libx264')
                .audioCodec('aac')
                .outputOptions([
                    '-copyts',
                    '-pix_fmt', 'yuv420p',
                    '-map', '0',
                    `-g ${gopSize}`,
                    '-sc_threshold', '0',
                    '-force_key_frames', `expr:gte(t,n_forced*${SEGMENT_DURATION})`,
                    '-preset veryfast',
                    '-crf', '24',
                    '-f', 'hls',
                    `-hls_time ${SEGMENT_DURATION}`,
                    '-hls_list_size 0',
                    '-hls_playlist_type vod',
                    '-hls_flags', 'independent_segments',
                    `-start_number ${segment}`,
                    `-hls_segment_filename ${segmentPath}`,
                    '-b:a', '128k'
                ])
                .output(playlistPath)
                .on('progress', (progress) => {
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

            command.run();

            const session: StreamSession = {
                process: command,
                startSegment: segment,
                latestSegment: segment,
                file: file,
                outputDir: dir,
                cleanupTimer: null
            };

            this.sessions.set(id, session);
            resolve();
        });
    }

    getSessions(): Map<string, StreamSession> {
        return this.sessions;
    }

    getSessionsFlat(): StreamSession[] {
        return Array.from(this.sessions.entries()).map(([_, session]) => session)
    }

    /**
     * Shutdown media service
     */
    async shutdown(): Promise<void> {
        logger.INFO('Shutting down MediaService...');
        logger.INFO('MediaService shutdown complete');
    }
}

const mediaService = new MediaService();

export default mediaService;
export { MediaService, StreamSession };