import { Router, Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as crypto from 'crypto';
import { MediaFile } from "../types/media-file";
import { MEDIA_PATH, TRANSCODE_PATH } from "../app";
import { scanMediaDirectory } from "../utils/utils";
import mediaService, { SEGMENT_DURATION } from "../services/media-service";

const router = Router();

/**
 * Get HLS playlist
 * GET /api/media/:id/playlist.m3u8
 */
router.get('/api/media/:id/playlist.m3u8', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const t = parseFloat(req.query.t as string) || 0;
        const seekSegment = Math.floor(t / SEGMENT_DURATION);

        const file = await findMediaFileById(id)
        if (!file) {
            return res.status(404).json({ error: 'Media file not found' });
        }

        if (!await fs.pathExists(file.path)) {
            return res.status(404).json({ error: 'Media file does not exist on disk' });
        }

        if (!mediaService.getSessions().has(id)) {
            console.log(`Start transcode at segment ${seekSegment} due to ?t=${t}`);
            await mediaService.startTranscode(file, seekSegment);
        }

        // Generate playlist if it doesn't exist
        const { playlistPath } = await mediaService.generatePlaylist(file)

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache');

        res.sendFile(playlistPath);
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
        const segment = parseInt(index);

        if (isNaN(segment) || segment < 0) {
            return res.status(400).json({ error: 'Invalid segment index' });
        }

        const file = await findMediaFileById(id)
        if (!file) {
            return res.status(404).json({ error: 'Media file not found' });
        }

        if (!await fs.pathExists(file.path)) {
            return res.status(404).json({ error: 'Media file does not exist on disk' });
        }

        const segmentPath = path.join(TRANSCODE_PATH, id, `segment${segment}.ts`);

        if (!fs.existsSync(segmentPath)) {
            if (!mediaService.getSessions().has(id)) {
                console.log(`Starting transcode for ${id} at segment ${segment}`);
                await mediaService.startTranscode(file, segment);
            } else {
                const session = mediaService.getSessions().get(id);
                if (session) {
                    if (segment < session.latestSegment + 3) {
                        // Wait and check again
                        return setTimeout(() => res.redirect(req.originalUrl), 1000);
                    } else {
                        console.log(`Killing current transcode for seek to ${segment}`);
                        session.process.kill('SIGKILL');
                        await mediaService.startTranscode(file, segment);
                    }
                }
            }
        }

        if (fs.existsSync(segmentPath)) {
            res.setHeader('Content-Type', 'video/mp2t');
            res.sendFile(segmentPath);
        } else {
            res.status(404).json({ error: 'Segment not ready' });
        }
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
        const sessions = mediaService.getSessionsFlat();
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