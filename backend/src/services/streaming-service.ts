import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';
import { EventEmitter } from 'events';

const mkdir = promisify(fs.mkdir);
const access = promisify(fs.access);
const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);

export interface StreamSession {
    id: string;
    filePath: string;
    outputPath: string;
    playlist: string;
    createdAt: Date;
    duration?: number;
    isTranscoding: boolean;
    isReady: boolean;
    segmentCount: number;
}

export class StreamingService extends EventEmitter {
    private readonly transcodePath: string;
    private readonly cacheDuration: number;
    private sessions: Map<string, StreamSession> = new Map();
    private hwAccel: string;

    constructor(transcodePath: string = '/loki/transcode', cacheDuration: number = 24) {
        super();
        this.transcodePath = transcodePath;
        this.cacheDuration = cacheDuration;
        this.hwAccel = process.env.FFMPEG_HWACCEL || 'auto';

        this.logAvailableEncoders();

        // Auto-detect wenn 'auto' gesetzt ist
        if (this.hwAccel === 'auto') {
            this.detectHardwareAcceleration().then(detected => {
                this.hwAccel = detected;
                console.log(`Auto-detected hardware acceleration: ${detected}`);
            });
        }
    }

    private async logAvailableEncoders(): Promise<void> {
        ffmpeg.getAvailableEncoders((err, encoders) => {
            if (!err) {
                console.log('Available H264 encoders:');
                Object.keys(encoders).filter(e => e.includes('h264')).forEach(encoder => {
                    console.log(`  - ${encoder}`);
                });
            }
        });
    }

    private async detectHardwareAcceleration(): Promise<string> {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        // Test NVIDIA
        try {
            await execAsync('ffmpeg -f lavfi -i testsrc=duration=1:size=320x240 -c:v h264_nvenc -f null - 2>&1');
            console.log('NVIDIA NVENC detected and working');
            return 'nvenc';
        } catch (error) {
            console.log('NVIDIA NVENC not available');
        }

        // Test Intel QSV
        try {
            await execAsync('ffmpeg -init_hw_device qsv=hw -filter_hw_device hw -f lavfi -i testsrc=duration=1:size=320x240 -vf hwupload=extra_hw_frames=64,format=qsv -c:v h264_qsv -f null - 2>&1');
            console.log('Intel QSV detected and working');
            return 'qsv';
        } catch (error) {
            console.log('Intel QSV not available');
        }

        // Test VAAPI
        try {
            await execAsync('ffmpeg -vaapi_device /dev/dri/renderD128 -f lavfi -i testsrc=duration=1:size=320x240 -vf format=nv12,hwupload -c:v h264_vaapi -f null - 2>&1');
            console.log('VAAPI detected and working');
            return 'vaapi';
        } catch (error) {
            console.log('VAAPI not available');
        }

        console.log('No hardware acceleration available, using CPU');
        return 'none';
    }

    private getFFmpegCommand(inputPath: string, outputPath: string): ffmpeg.FfmpegCommand {
        const command = ffmpeg(inputPath);
        const playlistPath = path.join(outputPath, 'playlist.m3u8');
        const segmentPath = path.join(outputPath, 'segment_%03d.ts');

        // Input options for better seeking
        command.inputOptions([
            '-analyzeduration', '100000000',
            '-probesize', '100000000'
        ]);

        // Try hardware acceleration
        let videoCodec = 'libx264';
        let videoOptions = ['-preset', 'medium'];

        if (this.hwAccel === 'nvenc' || this.hwAccel === 'auto') {
            try {
                command.inputOptions([
                    '-hwaccel', 'cuda',
                    '-hwaccel_output_format', 'cuda'
                ]);
                videoCodec = 'h264_nvenc';
                videoOptions = [
                    '-preset', 'p4',
                    '-tune', 'll',
                    '-rc', 'vbr'
                ];
                console.log('Using NVIDIA hardware acceleration');
            } catch (error) {
                console.log('NVIDIA not available, using software encoding');
            }
        } else if (this.hwAccel === 'qsv') {
            try {
                command.inputOptions([
                    '-hwaccel', 'qsv',
                    '-hwaccel_device', '/dev/dri/renderD128'
                ]);
                videoCodec = 'h264_qsv';
                videoOptions = ['-preset', 'faster'];
                console.log('Using Intel QuickSync');
            } catch (error) {
                console.log('QuickSync not available, using software encoding');
            }
        }

        command
            .videoCodec(videoCodec)
            .audioCodec('aac')
            .outputOptions([
                ...videoOptions,
                '-b:v', '6000k',
                '-maxrate', '10000k',
                '-bufsize', '20000k',
                '-b:a', '128k',
                '-ac', '2',
                '-pix_fmt', 'yuv420p',
                '-profile:v', 'baseline',
                '-level', '3.0',
                '-start_number', '0',
                '-hls_time', '10',
                '-hls_list_size', '0',
                '-hls_segment_filename', segmentPath,
                '-hls_playlist_type', 'vod',
                '-f', 'hls'
            ])
            .output(playlistPath);

        return command;
    }

    async getVideoDuration(filePath: string): Promise<number> {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(metadata.format.duration || 0);
            });
        });
    }

    async createStreamSession(filePath: string): Promise<StreamSession> {
        // Check if we already have a session for this file
        const existingSession = Array.from(this.sessions.values())
            .find(s => s.filePath === filePath && s.isReady);

        if (existingSession) {
            console.log('Reusing existing session:', existingSession.id);
            return existingSession;
        }

        const sessionId = crypto.createHash('md5').update(filePath + Date.now()).digest('hex');
        const outputPath = path.join(this.transcodePath, sessionId);
        const playlistPath = path.join(outputPath, 'playlist.m3u8');

        await mkdir(outputPath, { recursive: true });

        const duration = await this.getVideoDuration(filePath);

        const session: StreamSession = {
            id: sessionId,
            filePath,
            outputPath,
            playlist: playlistPath,
            createdAt: new Date(),
            duration,
            isTranscoding: false,
            isReady: false,
            segmentCount: 0
        };

        this.sessions.set(sessionId, session);

        // Start transcoding in background
        this.startTranscoding(session);

        return session;
    }

    private async startTranscoding(session: StreamSession): Promise<void> {
        if (session.isTranscoding) return;

        session.isTranscoding = true;
        console.log(`Starting full transcoding for session ${session.id}`);

        const command = this.getFFmpegCommand(session.filePath, session.outputPath);

        command
            .on('start', (cmd) => {
                console.log('FFmpeg started with command:', cmd);
            })
            .on('progress', (progress) => {
                if (progress.percent) {
                    console.log(`Transcoding progress: ${progress.percent.toFixed(1)}%`);

                    // Check for new segments
                    this.updateSegmentCount(session);
                }
            })
            .on('error', (err) => {
                console.error('FFmpeg error:', err.message);
                session.isTranscoding = false;
                session.isReady = false;
            })
            .on('end', async () => {
                console.log('Transcoding completed');
                session.isTranscoding = false;
                session.isReady = true;

                // Final segment count update
                await this.updateSegmentCount(session);
            });

        command.run();
    }

    private async updateSegmentCount(session: StreamSession): Promise<void> {
        try {
            const files = await readdir(session.outputPath);
            const segments = files.filter(f => f.match(/segment_\d+\.ts/));
            const newCount = segments.length;

            if (newCount > session.segmentCount) {
                session.segmentCount = newCount;
                console.log(`Session ${session.id}: ${newCount} segments available`);
                this.emit('segmentsReady', session.id, newCount);
            }
        } catch (error) {
            // Directory might not exist yet
        }
    }

    async getPlaylist(sessionId: string): Promise<string | null> {
        const session = this.sessions.get(sessionId);
        if (!session) return null;

        // Wait a bit for initial segments to be ready
        if (!session.isReady && session.segmentCount < 3) {
            console.log('Waiting for initial segments...');
            let attempts = 0;
            while (session.segmentCount < 3 && attempts < 30) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                await this.updateSegmentCount(session);
                attempts++;
            }
        }

        try {
            const playlist = await readFile(session.playlist, 'utf8');

            // If playlist exists but is incomplete, generate a partial one
            if (!playlist.includes('#EXT-X-ENDLIST') && session.segmentCount > 0) {
                return this.generatePartialPlaylist(session);
            }

            return playlist;
        } catch (error) {
            // If no playlist yet, generate one based on available segments
            if (session.segmentCount > 0) {
                return this.generatePartialPlaylist(session);
            }
            return null;
        }
    }

    private async generatePartialPlaylist(session: StreamSession): Promise<string> {
        let playlist = '#EXTM3U\n';
        playlist += '#EXT-X-VERSION:3\n';
        playlist += '#EXT-X-TARGETDURATION:10\n';
        playlist += '#EXT-X-MEDIA-SEQUENCE:0\n';

        for (let i = 0; i < session.segmentCount; i++) {
            playlist += `#EXTINF:10.0,\n`;
            playlist += `segment_${i.toString().padStart(3, '0')}.ts\n`;
        }

        // Only add ENDLIST if transcoding is complete
        if (session.isReady && !session.isTranscoding) {
            playlist += '#EXT-X-ENDLIST\n';
        }

        return playlist;
    }

    async getSegment(sessionId: string, segmentName: string): Promise<Buffer | null> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            console.error(`Session ${sessionId} not found`);
            return null;
        }

        const segmentPath = path.join(session.outputPath, segmentName);

        try {
            const buffer = await readFile(segmentPath);
            console.log(`Serving segment ${segmentName} (${buffer.length} bytes)`);
            return buffer;
        } catch (error) {
            console.error(`Segment ${segmentName} not found`);

            // Wait a bit if segment is being transcoded
            if (session.isTranscoding) {
                console.log('Waiting for segment to be transcoded...');
                await new Promise(resolve => setTimeout(resolve, 2000));

                try {
                    return await readFile(segmentPath);
                } catch (error) {
                    return null;
                }
            }

            return null;
        }
    }

    cleanupOldSessions(): void {
        const now = new Date();
        const maxAge = this.cacheDuration * 60 * 60 * 1000;

        this.sessions.forEach((session, id) => {
            if (now.getTime() - session.createdAt.getTime() > maxAge) {
                fs.rmSync(session.outputPath, { recursive: true, force: true });
                this.sessions.delete(id);
                console.log(`Cleaned up session ${id}`);
            }
        });
    }
}