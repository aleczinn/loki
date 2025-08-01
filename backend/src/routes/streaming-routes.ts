import { Router, Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as crypto from 'crypto';
import { MediaFile } from "../types/media-file";
import { MEDIA_PATH } from "../app";
import { scanMediaDirectory } from "../utils/utils";
import streamingService, { SEGMENT_DURATION, TRANSCODE_PATH } from "../services/streaming-service";
import { logger } from "../logger";
import { findMediaFileById } from "../utils/media-utils";

const router = Router();

/**
 * Get HLS playlist
 * GET /api/media/:id/playlist.m3u8
 */
router.get('/api/streaming/:id/playlist.m3u8', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const file = await findMediaFileById(id);
        if (!file) {
            return res.status(404).json({ error: 'Media file not found' });
        }

        if (!await fs.pathExists(file.path)) {
            return res.status(404).json({ error: 'Media file does not exist on disk' });
        }

        // Generate playlist if it doesn't exist
        const { playlistPath } = await streamingService.generatePlaylist(file);

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache');

        res.sendFile(playlistPath);
    } catch (error) {
        logger.ERROR(`Error creating stream: ${error}`);
        res.status(500).json({ error: 'Failed to create stream' });
    }
});


/**
 * Get/generate HLS segment
 * GET /api/media/:id/segment:index.ts
 */
router.get('/api/streaming/:id/segment:index.ts', async (req: Request, res: Response) => {
    try {
        const { id, index } = req.params;
        const segment = parseInt(index);

        if (isNaN(segment) || segment < 0) {
            return res.status(400).json({ error: 'Invalid segment index' });
        }

        const file = await findMediaFileById(id);
        if (!file) {
            return res.status(404).json({ error: 'Media file not found' });
        }

        if (!await fs.pathExists(file.path)) {
            return res.status(404).json({ error: 'Media file does not exist on disk' });
        }

        const segmentPath = path.join(TRANSCODE_PATH, id, `segment${segment}.ts`);

        // First check if segment already exists
        if (await fs.pathExists(segmentPath)) {
            res.setHeader('Content-Type', 'video/mp2t');
            return res.sendFile(segmentPath);
        }

        // Create segment here / start transcode?

        // If still not ready, ask client to retry
        res.setHeader('Retry-After', '1');
        res.status(503).json({ error: 'Segment not ready, please retry' });

    } catch (error) {
        logger.ERROR(`Error serving segment: ${error}`);
        res.status(500).json({ error: 'Failed to serve segment' });
    }
});

export default router;