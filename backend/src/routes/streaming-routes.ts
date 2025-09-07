import { Router, Request, Response } from 'express';
import * as path from 'path';
import * as crypto from 'crypto';
import { MediaFile } from "../types/media-file";
import { MEDIA_PATH } from "../app";
import { scanMediaDirectory } from "../utils/utils";
import streamingService, { SEGMENT_DURATION, TRANSCODE_PATH } from "../services/streaming-service";
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
        const token = req.headers['x-stream-token'] as string
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

        // Modify playlist URLs to include token for Safari if needed
        // let modifiedPlaylist = playlist;
        // if (req.query.token) {
        //     // Add token to segment URLs for Safari
        //     modifiedPlaylist = playlist.replace(
        //         /segment(\d+)\.ts/g,
        //         `segment$1.ts?token=${sessionToken}`
        //     );
        // }

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

        const segmentPath = path.join(TRANSCODE_PATH, id, `segment${segment}.ts`);

        // First check if segment already exists
        if (await pathExists(segmentPath)) {
            res.setHeader('Content-Type', 'video/mp2t');
            return res.sendFile(segmentPath);
        }

        // Create segment here / start transcode?
        // TODO : start transcoding here

        // If still not ready, ask client to retry
        res.setHeader('Retry-After', '1');
        res.status(503).json({ error: 'Segment not ready, please retry' });
    } catch (error) {
        logger.ERROR(`Error serving segment: ${error}`);
        res.status(500).json({ error: 'Failed to serve segment' });
    }
});

export default router;