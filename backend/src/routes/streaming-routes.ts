import { Router, Request, Response } from 'express';
import streamingService from "../services/streaming-service";
import { logger } from "../logger";
import { findMediaFileById } from "../utils/media-utils";
import { pathExists } from "../utils/file-utils";

const router = Router();

/**
 * Get HLS playlist
 * GET /api/media/:id/playlist.m3u8
 */
router.get('/api/streaming/:id/:quality/playlist.m3u8', async (req: Request, res: Response) => {
    try {
        const { id, quality } = req.params;
        const token = req.headers['x-client-token'] as string
            || req.query.token as string
            || undefined;

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

    } catch (error) {
        logger.ERROR(`Error killing session: ${error}`);
        res.status(500).json({ error: 'Failed to kill session' });
    }
});

export default router;