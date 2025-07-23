import * as path from 'path';
import * as fs from 'fs-extra';
import * as crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import { TRANSCODE_PATH } from "../app";
import { getCombinedMetadata } from "../utils/media-utils";
import { MediaFile } from "../types/media-file";

const SEGMENT_DURATION = 10; // seconds per segment
const BUFFER_SEGMENTS = 3; // x times segment_duration for extra buffer

interface StreamingSession {
    id: string;
    lastAccessed: number;
}

class MediaService {
    // private sessions: Map<string, StreamingSession> = new Map();
    //
    // async startSession(file: MediaFile): Promise<StreamingSession> {
    //     const sessionId = file.id;
    //
    //     const existingSession = this.sessions.get(sessionId);
    //     if (existingSession) {
    //         existingSession.lastAccessed = Date.now();
    //         return existingSession;
    //     }
    //
    //     const session = await this.createSession(file);
    //     this.sessions.set(file.id, session);
    //     return session;
    // }
    //
    // private async createSession(file: MediaFile): Promise<StreamingSession> {
    //     const sessionId = file.id;
    //
    //     const transcodingDir = path.join(TRANSCODE_PATH, file.id);
    //     await fs.ensureDir(transcodingDir);
    //
    //     return {
    //         id: sessionId,
    //         lastAccessed: Date.now()
    //     }
    // }

    async generatePlaylist(file: MediaFile, time?: number): Promise<{ id: string; playlistPath: string }> {
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

        console.log(`TOTAL SEGMENTS: ${totalSegments}`);

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

    async transcodeSegment(file: MediaFile, segmentIndex: number): Promise<string> {
        const id = file.id;
        const dir = path.join(TRANSCODE_PATH, id);
        const segmentPath  = path.join(dir, `segment${segmentIndex}.ts`);

        if (await fs.pathExists(segmentPath)) {
            return segmentPath;
        }

        const sourcePath = file.path;
        if (!sourcePath) {
            throw new Error('Source file not found');
        }

        const startTime = segmentIndex * SEGMENT_DURATION;

        await this.performTranscode(sourcePath, segmentPath, startTime);

        // Transcode next 3 segments in background
        this.transcodeBufferSegments(file, segmentIndex).catch(console.error);

        return segmentPath;
    }

    private performTranscode(inputPath: string, outputPath: string, startTime: number): Promise<void> {
        return new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .seekInput(startTime)
                .duration(SEGMENT_DURATION)
                .videoCodec('libx264')
                .audioCodec('aac')
                .outputOptions([
                    // PERFORMANCE OPTIMIZATIONS
                    '-preset', 'veryfast',  // Changed from 'medium' to 'veryfast'
                    '-crf', '26',          // Slightly higher CRF for faster encoding
                    '-tune', 'fastdecode', // Optimize for fast decoding

                    // Threading
                    '-threads', '0',       // Use all available threads

                    // Video settings
                    '-vf', 'scale=-2:1080:flags=fast_bilinear', // Faster scaling algorithm
                    '-pix_fmt', 'yuv420p',

                    // Audio settings (simple and fast)
                    '-b:a', '128k',
                    '-ac', '2',
                    '-ar', '44100',

                    // Format settings
                    '-f', 'mpegts',
                    '-muxdelay', '0',
                    '-muxpreload', '0',
                    '-movflags', '+faststart',
                    '-avoid_negative_ts', 'make_zero',
                ])
                .on('start', (cmd) => {
                    console.log(`Transcoding segment ${outputPath}`);
                })
                .on('progress', (progress) => {
                    // console.log(`>>> process ${progress.percent}% [${outputPath}]`);
                })
                .on('error', reject)
                .on('end', () => {
                    resolve()
                })
                .save(outputPath);
        });
    }

    private async transcodeBufferSegments(file: MediaFile, currentIndex: number): Promise<void> {
        const id = file.id;
        const streamDir = path.join(TRANSCODE_PATH, id);
        const sourcePath = file.path;
        const duration = file.metadata?.general.Duration || -1;

        if (duration === -1) {
            throw new Error('duration must be greater than 0');
        }

        const totalSegments = Math.ceil(duration / SEGMENT_DURATION);

        // @ts-ignore
        if (BUFFER_SEGMENTS === -1) {
            return;
        }

        for (let i = 1; i <= BUFFER_SEGMENTS; i++) {
            const nextIndex = currentIndex + i;
            if (nextIndex >= totalSegments) break;

            const segmentPath = path.join(streamDir, `segment${nextIndex}.ts`);

            if (await fs.pathExists(segmentPath)) continue;

            const startTime = nextIndex * SEGMENT_DURATION;
            this.performTranscode(sourcePath, segmentPath, startTime).catch(console.error);
        }
    }


    getSession(sessionId: string): StreamingSession | null {
        // const session = this.sessions.get(sessionId);
        // if (session) {
        //     session.lastAccessed = Date.now();
        //     return session;
        // }
        return null;
    }

    getSessions(): StreamingSession[] {
        // return Array.from(this.sessions.entries()).map(([_, session]) => session)
        return [];
    }

    /**
     * Shutdown media service
     */
    async shutdown(): Promise<void> {
        console.log('Shutting down MediaService...');
        console.log('MediaService shutdown complete');
    }
}

const mediaService = new MediaService();

export default mediaService;
export { MediaService, StreamingSession };