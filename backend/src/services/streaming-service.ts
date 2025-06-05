import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';

const mkdir = promisify(fs.mkdir);
const access = promisify(fs.access);
const readFile = promisify(fs.readFile);

export interface StreamSession {
    id: string;
    filePath: string;
    outputPath: string;
    playlist: string;
    createdAt: Date;
}

export class StreamingService {
    private readonly transcodePath: string;
    private readonly cacheDuration: number; // in hours
    private sessions: Map<string, StreamSession> = new Map();

    constructor(transcodePath: string = '/loki/transcode', cacheDuration: number = 24) {
        this.transcodePath = transcodePath;
        this.cacheDuration = cacheDuration;
    }

    async createStreamSession(filePath: string): Promise<StreamSession> {
        const sessionId = crypto.createHash('md5').update(filePath + Date.now()).digest('hex');
        const outputPath = path.join(this.transcodePath, sessionId);
        const playlistPath = path.join(outputPath, 'playlist.m3u8');

        // Create output directory
        await mkdir(outputPath, { recursive: true });

        const session: StreamSession = {
            id: sessionId,
            filePath,
            outputPath,
            playlist: playlistPath,
            createdAt: new Date()
        };

        this.sessions.set(sessionId, session);
        return session;
    }

    async startTranscoding(session: StreamSession): Promise<void> {
        return new Promise((resolve, reject) => {
            const outputPath = path.join(session.outputPath, 'playlist.m3u8');

            ffmpeg(session.filePath)
                .outputOptions([
                    '-codec:v h264',
                    '-codec:a aac',
                    '-hls_time 10',
                    '-hls_list_size 0',
                    '-hls_segment_filename', path.join(session.outputPath, 'segment_%03d.ts'),
                    '-f hls',
                    '-preset veryfast',
                    '-movflags +faststart',
                    '-pix_fmt yuv420p',
                    '-sc_threshold 0',
                    '-profile:v baseline',
                    '-level 3.0',
                    '-start_number 0'
                ])
                .output(outputPath)
                .on('start', (command) => {
                    console.log('FFmpeg started:', command);
                })
                .on('progress', (progress) => {
                    console.log(`Processing: ${progress.percent}% done`);
                })
                .on('end', () => {
                    console.log('Transcoding finished');
                    resolve();
                })
                .on('error', (err) => {
                    console.error('FFmpeg error:', err);
                    reject(err);
                })
                .run();
        });
    }

    async getPlaylist(sessionId: string): Promise<string | null> {
        const session = this.sessions.get(sessionId);
        if (!session) return null;

        try {
            await access(session.playlist);
            return await readFile(session.playlist, 'utf8');
        } catch (error) {
            return null;
        }
    }

    async getSegment(sessionId: string, segmentName: string): Promise<Buffer | null> {
        const session = this.sessions.get(sessionId);
        if (!session) return null;

        const segmentPath = path.join(session.outputPath, segmentName);
        try {
            await access(segmentPath);
            return await readFile(segmentPath);
        } catch (error) {
            return null;
        }
    }

    cleanupOldSessions(): void {
        const now = new Date();
        const maxAge = this.cacheDuration * 60 * 60 * 1000; // Convert hours to milliseconds

        this.sessions.forEach((session, id) => {
            if (now.getTime() - session.createdAt.getTime() > maxAge) {
                // Clean up files
                fs.rmSync(session.outputPath, { recursive: true, force: true });
                this.sessions.delete(id);
            }
        });
    }
}