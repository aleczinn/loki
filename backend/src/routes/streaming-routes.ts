import { Router, Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as crypto from 'crypto';
import { MediaFile } from "../types/media-file";
import { MEDIA_PATH, TRANSCODE_PATH } from "../app";
import { scanMediaDirectory } from "../utils/utils";
import mediaService from "../services/media-service";

const router = Router();

/**
 * Get HLS playlist
 * GET /api/media/:id/playlist.m3u8
 */
router.get('/api/media/:id/playlist.m3u8', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { t } = req.query; // timestamp for seek position

        const seekTime = t ? parseFloat(t as string) : 0;

        const file = await findMediaFileById(id)
        if (!file) {
            return res.status(404).json({ error: 'Media file not found' });
        }

        if (!await fs.pathExists(file.path)) {
            return res.status(404).json({ error: 'Media file does not exist on disk' });
        }

        const streamDir = path.join(TRANSCODE_PATH, id);
        const playlistPath = path.join(streamDir, 'playlist.m3u8');

        // Generate playlist if it doesn't exist
        if (!await fs.pathExists(playlistPath)) {
            await mediaService.generatePlaylist(file);
        }

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache');

        const playlist = await fs.readFile(playlistPath);
        res.send(playlist);
    } catch (error) {
        console.error('Error creating stream:', error);
        res.status(500).json({ error: 'Failed to create stream' });
    }
})

/**
 * Get/generate HLS segment
 * GET /api/media/:id/segment:index.ts
 */
router.get('/api/media/:id/segment:index.ts', async (req: Request, res: Response) => {
    try {
        const { id, index } = req.params;
        const segmentIndex = parseInt(index);

        if (isNaN(segmentIndex) || segmentIndex < 0) {
            return res.status(400).json({ error: 'Invalid segment index' });
        }

        const file = await findMediaFileById(id)
        if (!file) {
            return res.status(404).json({ error: 'Media file not found' });
        }

        if (!await fs.pathExists(file.path)) {
            return res.status(404).json({ error: 'Media file does not exist on disk' });
        }

        // Generate the segment if needed (mediaService needs the filePath stored)
        const segmentPath = await mediaService.transcodeSegment(file, segmentIndex);

        // Stream the segment
        res.setHeader('Content-Type', 'video/mp2t');
        res.setHeader('Cache-Control', 'public, max-age=3600');

        const stream = fs.createReadStream(segmentPath);
        stream.pipe(res);

        stream.on('error', (error) => {
            console.error('Segment streaming error:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to stream segment' });
            }
        });
    } catch (error) {
        console.error('Error creating stream:', error);
        res.status(500).json({ error: 'Failed to create stream' });
    }
})

/**
 * Return all active sessions
 */
router.get('/api/stream/sessions', async (req: Request, res: Response) => {
    try {
        const sessions = mediaService.getSessions();
        res.status(200).json(sessions);
    } catch (error) {
        console.error('Error getting active sessions:', error);
        res.status(500).json({ error: 'Failed to get active sessions' });
    }
});

async function findMediaFileById(id: string): Promise<MediaFile | null> {
    try {
        const mediaFiles = await scanMediaDirectory(MEDIA_PATH);
        return mediaFiles.find(file => file.id === id) || null;
    } catch (error) {
        console.error('Error finding media file:', error);
        return null;
    }
}

export default router;