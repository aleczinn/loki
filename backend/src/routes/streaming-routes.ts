import { Router, Request, Response } from 'express';
import * as fs from 'fs-extra';
import { MediaFile } from "../types/media-file";
import { MEDIA_PATH } from "../app";
import { scanMediaDirectory } from "../utils/utils";
import mediaService from "../services/media-service";

const router = Router();

router.get('/api/media/:id/stream', async (req: Request, res: Response) => {
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

        const session = await mediaService.startSession(file);

        const playlist = await mediaService.generatePlaylist(session, seekTime);

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(playlist);
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
        // const activeSessions = getActiveSessions();
        res.status(200).json({});
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