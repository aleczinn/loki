import { Router, Request, Response } from 'express';
import streamingService from "../services/streaming-service";
import { logger } from "../logger";
import { findMediaFileById } from "../utils/media-utils";
import { pathExists, stat } from "../utils/file-utils";
import fs from "fs";

const router = Router();

/**
 * Get HLS playlist
 * GET /api/media/:id/playlist.m3u8
 */
router.get('/api/streaming/:id/:quality/playlist.m3u8', async (req: Request, res: Response) => {
    try {
        const { id, quality } = req.params;
        const token = req.headers['x-client-token'] as string || req.query.token as string || undefined;

        const file = await findMediaFileById(id);
        if (!file) {
            return res.status(404).json({ error: 'Media file not found' });
        }

        if (!await pathExists(file.path)) {
            return res.status(404).json({ error: 'Media file does not exist on disk' });
        }

        const { playlist, token: sessionToken } = await streamingService.generatePlaylist(file, quality, token);

        res.setHeader('X-Stream-Token', sessionToken);
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache');

        res.send(playlist);
    } catch (error) {
        logger.ERROR(`Error creating stream: ${error}`);
        res.status(500).json({ error: 'Failed to create stream' });
    }
});


/**
 * Get/generate HLS segment
 * GET /api/media/:id/segment:index.ts
 */
router.get('/api/streaming/:id/:quality/segment:index.ts', async (req: Request, res: Response) => {
    try {
        const { id, quality, index } = req.params;
        const segment = parseInt(index);
        const token = req.headers['x-client-token'] as string
            || req.query.token as string
            || undefined;

        if (isNaN(segment) || segment < 0) {
            return res.status(400).json({ error: 'Invalid segment index' });
        }

        const file = await findMediaFileById(id);
        if (!file) {
            return res.status(404).json({ error: 'Media file not found' });
        }

        if (!await pathExists(file.path)) {
            return res.status(404).json({ error: 'Media file does not exist on disk' });
        }

        const { path: segmentPath, token: sessionToken } = await streamingService.handleSegment(file, segment, quality, token);

        res.setHeader('X-Client-Token', sessionToken);

        if (segmentPath) {
            res.setHeader('Content-Type', 'video/mp2t');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.sendFile(segmentPath);
        }

        // Segment not ready, ask client to retry
        res.setHeader('Retry-After', '2');
        res.status(503).json({
            error: 'Segment not ready',
            message: 'Transcoding in progress, please retry'
        });
    } catch (error) {
        logger.ERROR(`Error serving segment: ${error}`);
        res.status(500).json({ error: 'Failed to serve segment' });
    }
});

router.get('/api/streaming/:id/kill', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const token = req.headers['x-client-token'] as string
            || req.query.token as string
            || undefined;

        // streamingService.get

    } catch (error) {
        logger.ERROR(`Error killing session: ${error}`);
        res.status(500).json({ error: 'Failed to kill session' });
    }
});

/**
 * Direct Play endpoint with Range Request support
 * GET /api/streaming/:id/direct
 */
router.get('/api/streaming/:id/direct', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const range = req.headers.range;

        const file = await findMediaFileById(id);
        if (!file) {
            return res.status(404).json({ error: 'Media file not found' });
        }

        if (!await pathExists(file.path)) {
            return res.status(404).json({ error: 'Media file does not exist on disk' });
        }

        const stats = await stat(file.path);
        const fileSize = stats.size;

        // Set appropriate content type
        const mimeType = getMimeType(file.extension);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Accept-Ranges', 'bytes');

        // Handle range request (for seeking)
        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunkSize = (end - start) + 1;

            // Validate range
            if (start >= fileSize || end >= fileSize) {
                res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
                return res.end();
            }

            logger.DEBUG(`Direct Play: Range request ${start}-${end}/${fileSize} for ${file.name}`);

            res.status(206); // Partial Content
            res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
            res.setHeader('Content-Length', chunkSize);

            // Create read stream for the range
            const stream = fs.createReadStream(file.path, { start, end });
            stream.pipe(res);

            stream.on('error', (error) => {
                logger.ERROR(`Stream error: ${error}`);
                if (!res.headersSent) {
                    res.status(500).end();
                }
            });
        } else {
            // No range request -> Send entire file
            logger.DEBUG(`Direct Play: Full file request for ${file.name}`);

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
    } catch (error) {
        logger.ERROR(`Error in direct play: ${error}`);
        res.status(500).json({ error: 'Failed to stream media' });
    }
});

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