import { Router, Request, Response } from 'express';
import { logger } from "../logger";
import { findMediaFileById } from "../utils/media-utils";
import clientManager from "../services/client-manager";
import { pathExists, stat } from "../utils/file-utils";
import streamingService from "../services/streaming-service";
import fs from "fs";
import { spawn } from "child_process";

const router = Router();

router.get('/api/videos/:id/master.m3u8', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const profile = (req.query.profile as string) ?? 'auto';
        const audio = Number(req.query.audio ?? 0);
        const subtitle = req.query.subtitle as string | undefined;

        const token = req.headers['x-client-token'] as string || req.query.token as string || undefined;

        if (!token) {
            return res.status(401).json({ error: 'No client token provided' });
        }

        // Get media file
        const file = await findMediaFileById(id);
        if (!file) {
            return res.status(404).json({ error: 'Media file not found' });
        }

        if (!await pathExists(file.path)) {
            return res.status(404).json({ error: 'Media file does not exist on disk' });
        }

        // Get client capabilities
        const client = clientManager.getClient(token);
        if (!client) {
            return res.status(401).json({ error: 'Invalid client token' });
        }

        const session = streamingService.getOrCreateSession(client, file, profile);

        switch (session.decision.mode) {
            case 'direct_play':
                console.log("use direct play");
                const range = req.headers.range;
                return await handleDirectPlay(req, res, file, range);
            case 'direct_remux':
                console.log("use direct remux");
                return await handleDirectRemux(req, res, file);
            case 'transcode':
                console.log("use transcode");
                break;
        }
    } catch (error) {
        logger.ERROR(`Error getting active sessions: ${error}`);
        res.status(500).json({ error: 'Failed to get active sessions' });
    }
});

router.get('/videos/:id/hls/:sessionId/index.m3u8', async (req, res) => {
    const { id, sessionId } = req.params;

    // const session = streamingService.getSession(sessionId);
    // if (!session) return res.sendStatus(404);

    // const { playlist } =
    //     await streamingService.generatePlaylist(
    //         session.file,
    //         session.profile,
    //         session.token
    //     );
    //
    // res.type('application/vnd.apple.mpegurl');
    // res.send(playlist);
});

router.get('/videos/:id/hls/:sessionId/:segment', async (req, res) => {
        const { sessionId, segment } = req.params;

        const match = segment.match(/segment(\d+)\.ts/);
        if (!match) return res.sendStatus(400);

        const segmentIndex = Number(match[1]);

        // const session = streamingService.getSession(sessionId);
        // if (!session) return res.sendStatus(404);

        // const result =
            // await streamingService.handleSegment(
            //     session.file,
            //     segmentIndex,
            //     session.profile,
            //     session.token
            // );

        // if (!result.path) return res.sendStatus(404);

        // res.sendFile(result.path);
    }
);

/**
 * Handle Direct Play - serve file as-is with Range support
 */
async function handleDirectPlay(req: Request, res: Response, file: any, range?: string): Promise<void> {
    const stats = await stat(file.path);
    const fileSize = stats.size;

    // Set MIME type
    const mimeType = getMimeType(file.extension);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Accept-Ranges', 'bytes');

    // Handle Range request (for seeking)
    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;

        // Validate range
        if (start >= fileSize || end >= fileSize) {
            res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
            res.end();
            return; // ← Kein Wert zurückgeben
        }

        logger.DEBUG(`Direct Play: Range ${start}-${end}/${fileSize} for ${file.name}`);

        res.status(206); // Partial Content
        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        res.setHeader('Content-Length', chunkSize);

        const stream = fs.createReadStream(file.path, { start, end });
        stream.pipe(res);

        stream.on('error', (error) => {
            logger.ERROR(`Stream error: ${error}`);
            if (!res.headersSent) {
                res.status(500).end();
            }
        });
    } else {
        // Full file
        logger.DEBUG(`Direct Play: Full file for ${file.name}`);

        res.setHeader('Content-Length', fileSize);

        const stream = fs.createReadStream(file.path);
        stream.pipe(res);

        stream.on('error', (error) => {
            logger.ERROR(`Stream error: ${error}`);
            if (!res.headersSent) {
                res.status(500).end();
            }
        });
    }
}

/**
 * Handle Direct Remux - remux container on-the-fly using FFmpeg
 * No video/audio transcoding, just container conversion (e.g., MKV → MP4)
 */
async function handleDirectRemux(req: Request, res: Response, file: any): Promise<void> {
    // Set headers for streaming
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');

    // FFmpeg command for remuxing (no transcoding)
    const ffmpeg = spawn('ffmpeg', [
        '-i', file.path,

        // Copy streams without re-encoding
        '-c:v', 'copy',
        '-c:a', 'copy',
        '-c:s', 'copy',

        // Output format
        '-f', 'mp4',
        '-movflags', 'frag_keyframe+empty_moov+faststart',

        // Pipe to stdout
        'pipe:1'
    ]);

    // Pipe FFmpeg output to response
    ffmpeg.stdout.pipe(res);

    // Handle errors
    ffmpeg.stderr.on('data', (data: any) => {
        logger.DEBUG(`FFmpeg remux: ${data.toString()}`);
    });

    ffmpeg.on('error', (error: any) => {
        logger.ERROR(`FFmpeg remux error: ${error}`);
        if (!res.headersSent) {
            res.status(500).end();
        }
    });

    ffmpeg.on('close', (code: any) => {
        if (code !== 0) {
            logger.ERROR(`FFmpeg remux exited with code ${code}`);
        } else {
            logger.DEBUG(`Direct Remux completed for ${file.name}`);
        }
    });

    // Handle client disconnect
    req.on('close', () => {
        logger.DEBUG('Client disconnected, killing FFmpeg remux');
        ffmpeg.kill('SIGKILL');
    });
}

/**
 * Get MIME type based on file extension
 */
function getMimeType(extension: string): string {
    const ext = extension.toLowerCase();

    const mimeTypes: Record<string, string> = {
        '.mp4': 'video/mp4',
        '.m4v': 'video/mp4',
        '.mkv': 'video/x-matroska',
        '.webm': 'video/webm',
        '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime',
        '.wmv': 'video/x-ms-wmv',
        '.flv': 'video/x-flv',
        '.mpg': 'video/mpeg',
        '.mpeg': 'video/mpeg'
    };

    return mimeTypes[ext] || 'video/mp4';
}

export default router;