import { Router, Request, Response } from 'express';
import { MediaFile } from "../types/media-file";
import { scanMediaDirectory } from "../utils/utils";
import { MEDIA_PATH } from "../app";
import { findMediaFileById } from "../utils/media-utils";
import { pathExists } from "../utils/file-utils";
import transcodeDecisionService from "../services/transcode-decision";
import clientManager from "../services/client-manager";

const router = Router();

router.get('/api/media', async (req: Request, res: Response) => {
    try {
        const files: MediaFile[] = await scanMediaDirectory(MEDIA_PATH);

        res.status(200).json(files);
    } catch (error) {
        console.error('Error scanning media files: ', error);
        res.status(500).json({ error: 'Failed to scan media directory' });
    }
});

router.get('/api/media/:id/qualities', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const token = req.headers['x-client-token'] as string || req.query.token as string || undefined;

        if (!token) {
            return res.status(401).json({ error: 'No client token provided' });
        }

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

        const qualities = transcodeDecisionService.getQualities(file, client.capabilities);

        res.status(200).json(qualities);
    } catch (error) {
        console.error('Error scanning media files: ', error);
        res.status(500).json({ error: 'Failed to scan media directory' });
    }
});

export default router;