import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';
import { exec } from 'child_process';
import process from "node:process";

const execAsync = promisify(exec);
const fsAsync = {
    access: promisify(fs.access),
    mkdir: promisify(fs.mkdir),
    readdir: promisify(fs.readdir),
    stat: promisify(fs.stat),
    writeFile: promisify(fs.writeFile),
    unlink: promisify(fs.unlink)
};

const MEDIA_PATH = process.env.MEDIA_PATH || '/media';
const TRANSCODE_PATH = process.env.TRANSCODE_PATH || '/loki/transcode';
const SUPPORTED_FORMATS = ['.mkv', '.mp4', '.avi', '.mov', '.webm'];
const SEGMENT_DURATION = 10; // seconds per segment
const SEGMENTS_TO_PREPARE = 3; // number of segments to prepare ahead

interface MediaFile {
    id: string;
    name: string;
    path: string;
    size: number;
    duration?: number;
    format?: string;
}

interface TranscodeSession {
    id: string;
    mediaPath: string;
    outputPath: string;
    duration: number;
    totalSegments: number;
    transcodedSegments: Set<number>;
    lastAccessed: Date;
}

const transcodeSessions = new Map<string, TranscodeSession>();

export class MediaController {
    // Get all media files
    static async getMediaFiles(req: Request, res: Response) {
        try {
            const mediaFiles: MediaFile[] = [];
            await scanDirectory(MEDIA_PATH, mediaFiles);
            res.json(mediaFiles);
        } catch (error) {
            console.error('Error scanning media files:', error);
            res.status(500).json({ error: 'Failed to scan media files' });
        }
    }

    // Get media file info
    static async getMediaInfo(req: Request, res: Response) {
        const { id } = req.params;

        try {
            const mediaPath = await getMediaPathById(id);
            if (!mediaPath) {
                return res.status(404).json({ error: 'Media file not found' });
            }

            const mediaInfo = await getMediaFileInfo(mediaPath);
            res.json(mediaInfo);
        } catch (error) {
            console.error('Error getting media info:', error);
            res.status(500).json({ error: 'Failed to get media info' });
        }
    }

    // Stream media file with HLS
    static async streamMedia(req: Request, res: Response) {
        const { id } = req.params;

        try {
            const mediaPath = await getMediaPathById(id);
            if (!mediaPath) {
                return res.status(404).json({ error: 'Media file not found' });
            }

            // Create or get transcode session
            let session = transcodeSessions.get(id);
            if (!session) {
                session = await createTranscodeSession(id, mediaPath);
                transcodeSessions.set(id, session);
            }

            // Generate master playlist
            const masterPlaylist = generateMasterPlaylist(session);
            res.header('Content-Type', 'application/vnd.apple.mpegurl');
            res.send(masterPlaylist);
        } catch (error) {
            console.error('Error streaming media:', error);
            res.status(500).json({ error: 'Failed to stream media' });
        }
    }

    // Get HLS playlist
    static async getPlaylist(req: Request, res: Response) {
        const { id } = req.params;

        try {
            const session = transcodeSessions.get(id);
            if (!session) {
                return res.status(404).json({ error: 'Session not found' });
            }

            // Update last accessed time
            session.lastAccessed = new Date();

            // Generate playlist with available segments
            const playlist = await generatePlaylist(session);
            res.header('Content-Type', 'application/vnd.apple.mpegurl');
            res.send(playlist);
        } catch (error) {
            console.error('Error getting playlist:', error);
            res.status(500).json({ error: 'Failed to get playlist' });
        }
    }

    // Get HLS segment
    static async getSegment(req: Request, res: Response) {
        const { id, segment } = req.params;
        const segmentNumber = parseInt(segment);

        try {
            const session = transcodeSessions.get(id);
            if (!session) {
                return res.status(404).json({ error: 'Session not found' });
            }

            // Update last accessed time
            session.lastAccessed = new Date();

            const segmentPath = path.join(session.outputPath, `segment${segmentNumber}.ts`);

            // Check if segment exists
            try {
                await fsAsync.access(segmentPath);
            } catch {
                // Transcode segment on demand
                await transcodeSegment(session, segmentNumber);
            }

            // Prepare next segments in background
            prepareNextSegments(session, segmentNumber);

            // Stream segment
            res.header('Content-Type', 'video/mp2t');
            fs.createReadStream(segmentPath).pipe(res);
        } catch (error) {
            console.error('Error getting segment:', error);
            res.status(500).json({ error: 'Failed to get segment' });
        }
    }
}

// Helper functions
async function scanDirectory(dir: string, mediaFiles: MediaFile[], basePath = '') {
    const files = await fsAsync.readdir(dir);

    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = await fsAsync.stat(fullPath);

        if (stat.isDirectory()) {
            await scanDirectory(fullPath, mediaFiles, path.join(basePath, file));
        } else if (SUPPORTED_FORMATS.includes(path.extname(file).toLowerCase())) {
            const id = crypto.createHash('md5').update(fullPath).digest('hex');
            mediaFiles.push({
                id,
                name: file,
                path: path.join(basePath, file),
                size: stat.size
            });
        }
    }
}

async function getMediaPathById(id: string): Promise<string | null> {
    const mediaFiles: MediaFile[] = [];
    await scanDirectory(MEDIA_PATH, mediaFiles);
    const media = mediaFiles.find(m => m.id === id);
    return media ? path.join(MEDIA_PATH, media.path) : null;
}

async function getMediaFileInfo(mediaPath: string) {
    const { stdout } = await execAsync(
        `ffprobe -v quiet -print_format json -show_format -show_streams "${mediaPath}"`
    );

    const info = JSON.parse(stdout);
    const videoStream = info.streams.find((s: any) => s.codec_type === 'video');
    const audioStream = info.streams.find((s: any) => s.codec_type === 'audio');

    return {
        duration: parseFloat(info.format.duration),
        format: info.format.format_name,
        size: parseInt(info.format.size),
        bitrate: parseInt(info.format.bit_rate),
        video: videoStream ? {
            codec: videoStream.codec_name,
            width: videoStream.width,
            height: videoStream.height,
            fps: eval(videoStream.r_frame_rate)
        } : null,
        audio: audioStream ? {
            codec: audioStream.codec_name,
            channels: audioStream.channels,
            sampleRate: parseInt(audioStream.sample_rate)
        } : null
    };
}

async function createTranscodeSession(id: string, mediaPath: string): Promise<TranscodeSession> {
    const mediaInfo = await getMediaFileInfo(mediaPath);
    const outputPath = path.join(TRANSCODE_PATH, id);

    // Create output directory
    await fsAsync.mkdir(outputPath, { recursive: true });

    const totalSegments = Math.ceil(mediaInfo.duration / SEGMENT_DURATION);

    return {
        id,
        mediaPath,
        outputPath,
        duration: mediaInfo.duration,
        totalSegments,
        transcodedSegments: new Set(),
        lastAccessed: new Date()
    };
}

function generateMasterPlaylist(session: TranscodeSession): string {
    return `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
/api/media/${session.id}/playlist.m3u8`;
}

async function generatePlaylist(session: TranscodeSession): Promise<string> {
    let playlist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:${SEGMENT_DURATION}
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
`;

    for (let i = 0; i < session.totalSegments; i++) {
        const segmentDuration = Math.min(SEGMENT_DURATION, session.duration - (i * SEGMENT_DURATION));
        playlist += `#EXTINF:${segmentDuration.toFixed(6)},\n`;
        playlist += `/api/media/${session.id}/segment${i}.ts\n`;
    }

    playlist += '#EXT-X-ENDLIST\n';
    return playlist;
}

async function transcodeSegment(session: TranscodeSession, segmentNumber: number) {
    const startTime = segmentNumber * SEGMENT_DURATION;
    const segmentPath = path.join(session.outputPath, `segment${segmentNumber}.ts`);

    // Check if already transcoding
    if (session.transcodedSegments.has(segmentNumber)) {
        return;
    }

    session.transcodedSegments.add(segmentNumber);

    const command = `ffmpeg -i "${session.mediaPath}" \
        -ss ${startTime} \
        -t ${SEGMENT_DURATION} \
        -c:v libx264 \
        -preset veryfast \
        -crf 23 \
        -c:a aac \
        -b:a 128k \
        -f mpegts \
        -muxdelay 0 \
        -muxpreload 0 \
        "${segmentPath}"`;

    try {
        await execAsync(command);
    } catch (error) {
        console.error(`Error transcoding segment ${segmentNumber}:`, error);
        session.transcodedSegments.delete(segmentNumber);
        throw error;
    }
}

function prepareNextSegments(session: TranscodeSession, currentSegment: number) {
    // Transcode next segments in background
    for (let i = 1; i <= SEGMENTS_TO_PREPARE; i++) {
        const nextSegment = currentSegment + i;
        if (nextSegment < session.totalSegments && !session.transcodedSegments.has(nextSegment)) {
            transcodeSegment(session, nextSegment).catch(console.error);
        }
    }
}

// Cleanup old sessions
// setInterval(() => {
//     const now = new Date();
//     const maxAge = 24 * 60 * 60 * 1000; // 24 hours
//
//     for (const [id, session] of transcodeSessions.entries()) {
//         if (now.getTime() - session.lastAccessed.getTime() > maxAge) {
//             // Remove session and files
//             transcodeSessions.delete(id);
//             fs.rm(session.outputPath, { recursive: true }, (err) => {
//                 if (err) console.error('Error removing transcode directory:', err);
//             });
//         }
//     }
// }, 60 * 60 * 1000); // Run every hour