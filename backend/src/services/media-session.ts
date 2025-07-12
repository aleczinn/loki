import * as path from 'path';
import * as fs from 'fs-extra';
import * as crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import { MediaFile, SessionInfo, StreamSegment } from "../types/types";

const MEDIA_PATH = process.env.MEDIA_PATH || '/media';
const TRANSCODE_PATH = process.env.TRANSCODE_PATH || './transcode';
const FFMPEG_HWACCEL = process.env.FFMPEG_HWACCEL || 'auto';

export class MediaSession implements SessionInfo {
    public id: string;
    public filePath: string;
    public transcodeDir: string;
    public playlistPath: string;
    public duration: number | null = null;
    public currentPosition: number = 0;
    public bufferSize: number = 6;
    public segmentDuration: number = 10;
    public lastAccessed: number = Date.now();
    public metadata: any = null;
    public isActive: boolean = false;
    public totalSegments: number = 0;

    private segments: Map<number, StreamSegment> = new Map();
    private transcodeProcess: any = null;

    constructor(filePath: string, sessionId: string) {
        this.id = sessionId;
        this.filePath = filePath;
        this.transcodeDir = path.join(TRANSCODE_PATH, sessionId);
        this.playlistPath = path.join(this.transcodeDir, 'playlist.m3u8');
    }

    async initialize(): Promise<boolean> {
        try {
            await fs.ensureDir(this.transcodeDir);
            await this.extractMetadata();
            await this.generateInitialPlaylist();
            this.isActive = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize session:', error);
            return false;
        }
    }

    async extractMetadata(): Promise<void> {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(this.filePath, (err, metadata) => {
                if (err) {
                    reject(err);
                    return;
                }

                this.metadata = metadata;
                const videoStream = metadata.streams.find(s => s.codec_type === 'video');
                if (videoStream) {
                    // @ts-ignore
                    this.duration = parseFloat(metadata.format.duration);
                    this.totalSegments = Math.ceil(this.duration / this.segmentDuration);
                }
                resolve();
            });
        });
    }

    async generateInitialPlaylist(): Promise<void> {
        const playlistContent = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:${this.segmentDuration}
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
`;
        await fs.writeFile(this.playlistPath, playlistContent);
    }

    async updatePlaylist(fromSegment: number, toSegment: number): Promise<void> {
        let playlistContent = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:${this.segmentDuration}
#EXT-X-MEDIA-SEQUENCE:${fromSegment}
#EXT-X-PLAYLIST-TYPE:VOD
`;

        for (let i = fromSegment; i <= toSegment && i < this.totalSegments; i++) {
            const segment = this.segments.get(i);
            if (segment && segment.ready) {
                playlistContent += `#EXTINF:${segment.duration.toFixed(6)},\n`;
                playlistContent += `segment_${i}.ts\n`;
            }
        }

        if (toSegment >= this.totalSegments - 1) {
            playlistContent += '#EXT-X-ENDLIST\n';
        }

        await fs.writeFile(this.playlistPath, playlistContent);
    }

    async transcodeSegment(segmentNumber: number, startTime: number): Promise<string> {
        const segmentPath = path.join(this.transcodeDir, `segment_${segmentNumber}.ts`);

        if (await fs.pathExists(segmentPath)) {
            this.segments.set(segmentNumber, {
                path: segmentPath,
                duration: this.segmentDuration,
                ready: true
            });
            return segmentPath;
        }

        return new Promise((resolve, reject) => {
            const command = ffmpeg(this.filePath)
                .inputOptions([
                    '-ss', startTime.toString(),
                    '-t', this.segmentDuration.toString()
                ])
                .outputOptions([
                    '-c:v', this.getVideoCodec(),
                    '-c:a', 'aac',
                    '-ac', '2',
                    '-b:a', '128k',
                    '-b:v', '2M',
                    '-maxrate', '2.5M',
                    '-bufsize', '5M',
                    '-preset', 'fast',
                    '-profile:v', 'main',
                    '-level', '3.1',
                    '-sc_threshold', '0',
                    '-g', '30',
                    '-keyint_min', '30',
                    '-hls_time', this.segmentDuration.toString(),
                    '-hls_list_size', '0',
                    '-hls_segment_type', 'mpegts',
                    '-f', 'mpegts'
                ]);

            if (FFMPEG_HWACCEL !== 'none') {
                command.inputOptions(['-hwaccel', FFMPEG_HWACCEL]);
            }

            command
                .output(segmentPath)
                .on('end', () => {
                    this.segments.set(segmentNumber, {
                        path: segmentPath,
                        duration: this.segmentDuration,
                        ready: true
                    });
                    resolve(segmentPath);
                })
                .on('error', reject)
                .run();
        });
    }

    getVideoCodec(): string {
        if (FFMPEG_HWACCEL === 'nvenc' || FFMPEG_HWACCEL === 'cuda') {
            return 'h264_nvenc';
        } else if (FFMPEG_HWACCEL === 'vaapi') {
            return 'h264_vaapi';
        } else if (FFMPEG_HWACCEL === 'qsv') {
            return 'h264_qsv';
        }
        return 'libx264';
    }

    async seek(timeInSeconds: number): Promise<{ fromSegment: number; toSegment: number }> {
        this.currentPosition = timeInSeconds;
        const segmentNumber = Math.floor(timeInSeconds / this.segmentDuration);
        return await this.ensureSegmentsAvailable(segmentNumber);
    }

    async ensureSegmentsAvailable(fromSegment: number): Promise<{ fromSegment: number; toSegment: number }> {
        const promises: Promise<string>[] = [];
        const toSegment = Math.min(fromSegment + this.bufferSize - 1, this.totalSegments - 1);

        for (let i = fromSegment; i <= toSegment; i++) {
            if (!this.segments.has(i) || !this.segments.get(i)?.ready) {
                const startTime = i * this.segmentDuration;
                promises.push(this.transcodeSegment(i, startTime));
            }
        }

        if (promises.length > 0) {
            await Promise.all(promises);
            await this.updatePlaylist(fromSegment, toSegment);
        }

        return { fromSegment, toSegment };
    }

    getSegmentPath(segmentNumber: number): string {
        return path.join(this.transcodeDir, `segment_${segmentNumber}.ts`);
    }

    async hasSegment(segmentNumber: number): Promise<boolean> {
        const segment = this.segments.get(segmentNumber);
        if (!segment?.ready) return false;
        return await fs.pathExists(segment.path);
    }

    getStatus() {
        return {
            sessionId: this.id,
            duration: this.duration || 0,
            currentPosition: this.currentPosition,
            totalSegments: this.totalSegments,
            availableSegments: Array.from(this.segments.keys()).filter(k => this.segments.get(k)?.ready),
            isActive: this.isActive,
            lastAccessed: this.lastAccessed
        };
    }

    cleanup(): void {
        if (this.transcodeProcess) {
            this.transcodeProcess.kill();
        }
        this.isActive = false;
    }
}

export function generateSessionId(filePath: string): string {
    return crypto.createHash('md5').update(filePath).digest('hex');
}

export async function scanMediaDirectory(dir: string): Promise<MediaFile[]> {
    const files: MediaFile[] = [];
    const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'];

    async function scanRecursive(currentDir: string, relativePath: string = ''): Promise<void> {
        const items = await fs.readdir(currentDir);

        for (const item of items) {
            const fullPath = path.join(currentDir, item);
            const itemRelativePath = path.join(relativePath, item);
            const stats = await fs.stat(fullPath);

            if (stats.isDirectory()) {
                await scanRecursive(fullPath, itemRelativePath);
            } else if (stats.isFile()) {
                const ext = path.extname(item).toLowerCase();
                if (videoExtensions.includes(ext)) {
                    files.push({
                        name: item,
                        path: itemRelativePath,
                        size: stats.size,
                        modified: stats.mtime
                    });
                }
            }
        }
    }

    await scanRecursive(dir);
    return files;
}