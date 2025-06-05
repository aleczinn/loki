import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';

const mkdir = promisify(fs.mkdir);
const access = promisify(fs.access);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

export interface StreamSession {
    id: string;
    filePath: string;
    outputPath: string;
    playlist: string;
    createdAt: Date;
    duration?: number;
    segmentDuration: number;
    isTranscoding: Map<number, boolean>;
}

export class StreamingService {
    private readonly transcodePath: string;
    private readonly cacheDuration: number;
    private sessions: Map<string, StreamSession> = new Map();
    private readonly hwAccel: string;

    constructor(transcodePath: string = '/loki/transcode', cacheDuration: number = 24) {
        this.transcodePath = transcodePath;
        this.cacheDuration = cacheDuration;
        this.hwAccel = process.env.FFMPEG_HWACCEL || 'auto';

        // Log available encoders on startup
        this.logAvailableEncoders();
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

    private getFFmpegCommand(inputPath: string): ffmpeg.FfmpegCommand {
        const command = ffmpeg(inputPath);

        // Hardware acceleration based on environment
        if (this.hwAccel === 'nvenc' || this.hwAccel === 'auto') {
            // Try NVIDIA first
            command
                .inputOptions([
                    '-hwaccel', 'cuda',
                    '-hwaccel_output_format', 'cuda'
                ])
                .videoCodec('h264_nvenc')
                .outputOptions([
                    '-preset', 'p4',
                    '-tune', 'll',
                    '-rc', 'vbr',
                    '-b:v', '2M',
                    '-maxrate', '3M',
                    '-bufsize', '6M'
                ]);
        } else if (this.hwAccel === 'qsv') {
            // Intel QuickSync
            command
                .inputOptions([
                    '-hwaccel', 'qsv',
                    '-hwaccel_device', '/dev/dri/renderD128',
                    '-hwaccel_output_format', 'qsv'
                ])
                .videoCodec('h264_qsv')
                .outputOptions([
                    '-preset', 'faster',
                    '-b:v', '2M',
                    '-maxrate', '3M',
                    '-bufsize', '6M'
                ]);
        } else {
            // Software encoding
            command
                .videoCodec('libx264')
                .outputOptions([
                    '-preset', 'veryfast',
                    '-b:v', '2M',
                    '-maxrate', '3M',
                    '-bufsize', '6M'
                ]);
        }

        // Common options
        command
            .audioCodec('aac')
            .audioBitrate('128k')
            .audioChannels(2)
            .outputOptions([
                '-pix_fmt', 'yuv420p',
                '-profile:v', 'baseline',
                '-level', '3.0',
                '-movflags', '+faststart',
                '-g', '30',
                '-sc_threshold', '0'
            ]);

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
        const sessionId = crypto.createHash('md5').update(filePath + Date.now()).digest('hex');
        const outputPath = path.join(this.transcodePath, sessionId);
        const playlistPath = path.join(outputPath, 'playlist.m3u8');

        await mkdir(outputPath, { recursive: true });

        const duration = await this.getVideoDuration(filePath);
        console.log(`Video duration: ${duration} seconds`);

        const session: StreamSession = {
            id: sessionId,
            filePath,
            outputPath,
            playlist: playlistPath,
            createdAt: new Date(),
            duration,
            segmentDuration: 10,
            isTranscoding: new Map()
        };

        this.sessions.set(sessionId, session);

        // Generate master playlist
        await this.generatePlaylist(session);

        // Start transcoding first few segments
        this.preTranscodeSegments(session, 3);

        return session;
    }

    private async generatePlaylist(session: StreamSession): Promise<void> {
        if (!session.duration) return;

        const segmentCount = Math.ceil(session.duration / session.segmentDuration);
        let playlist = '#EXTM3U\n';
        playlist += '#EXT-X-VERSION:3\n';
        playlist += '#EXT-X-TARGETDURATION:' + session.segmentDuration + '\n';
        playlist += '#EXT-X-MEDIA-SEQUENCE:0\n';

        for (let i = 0; i < segmentCount; i++) {
            const segmentDuration = Math.min(
                session.segmentDuration,
                session.duration - (i * session.segmentDuration)
            );
            playlist += `#EXTINF:${segmentDuration.toFixed(6)},\n`;
            playlist += `segment_${i.toString().padStart(3, '0')}.ts\n`;
        }

        playlist += '#EXT-X-ENDLIST\n';

        await writeFile(session.playlist, playlist);
        console.log(`Playlist generated with ${segmentCount} segments`);
    }

    private async preTranscodeSegments(session: StreamSession, count: number): Promise<void> {
        for (let i = 0; i < count; i++) {
            this.transcodeSegment(session.id, i).catch(err => {
                console.error(`Failed to pre-transcode segment ${i}:`, err);
            });
        }
    }

    async transcodeSegment(sessionId: string, segmentIndex: number): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error('Session not found');

        const segmentPath = path.join(session.outputPath, `segment_${segmentIndex.toString().padStart(3, '0')}.ts`);

        // Check if already transcoding
        if (session.isTranscoding.get(segmentIndex)) {
            console.log(`Segment ${segmentIndex} is already being transcoded`);
            return;
        }

        // Check if segment already exists
        try {
            await access(segmentPath);
            console.log(`Segment ${segmentIndex} already exists`);
            return;
        } catch (error) {
            // Segment doesn't exist, transcode it
        }

        session.isTranscoding.set(segmentIndex, true);

        const startTime = segmentIndex * session.segmentDuration;
        const duration = Math.min(session.segmentDuration, (session.duration || 0) - startTime);

        console.log(`Transcoding segment ${segmentIndex} (start: ${startTime}s, duration: ${duration}s)`);

        return new Promise((resolve, reject) => {
            const command = this.getFFmpegCommand(session.filePath);

            command
                .seekInput(startTime)
                .duration(duration)
                .format('mpegts')
                .on('start', (cmd) => {
                    console.log('Started ffmpeg:', cmd);
                })
                .on('progress', (progress) => {
                    console.log(`Segment ${segmentIndex}: ${progress.percent?.toFixed(1)}%`);
                })
                .on('error', (err) => {
                    session.isTranscoding.set(segmentIndex, false);
                    console.error(`Error transcoding segment ${segmentIndex}:`, err);
                    reject(err);
                })
                .on('end', () => {
                    session.isTranscoding.set(segmentIndex, false);
                    console.log(`Segment ${segmentIndex} transcoded successfully`);

                    // Pre-transcode next segment
                    const nextIndex = segmentIndex + 3;
                    if (session.duration && nextIndex * session.segmentDuration < session.duration) {
                        this.transcodeSegment(sessionId, nextIndex).catch(console.error);
                    }

                    resolve();
                })
                .save(segmentPath);
        });
    }

    async getPlaylist(sessionId: string): Promise<string | null> {
        const session = this.sessions.get(sessionId);
        if (!session) return null;

        try {
            return await readFile(session.playlist, 'utf8');
        } catch (error) {
            console.error('Error reading playlist:', error);
            return null;
        }
    }

    async getSegment(sessionId: string, segmentName: string): Promise<Buffer | null> {
        const session = this.sessions.get(sessionId);
        if (!session) return null;

        const match = segmentName.match(/segment_(\d+)\.ts/);
        if (!match) return null;

        const segmentIndex = parseInt(match[1], 10);
        const segmentPath = path.join(session.outputPath, segmentName);

        // Wait for segment if it's being transcoded
        let attempts = 0;
        while (session.isTranscoding.get(segmentIndex) && attempts < 30) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
        }

        // Try to transcode if not exists
        try {
            await access(segmentPath);
        } catch (error) {
            console.log(`Segment ${segmentIndex} not found, transcoding on demand`);
            await this.transcodeSegment(sessionId, segmentIndex);
        }

        try {
            return await readFile(segmentPath);
        } catch (error) {
            console.error('Error reading segment:', error);
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
            }
        });
    }
}