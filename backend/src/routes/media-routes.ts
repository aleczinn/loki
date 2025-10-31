import { Router, Request, Response } from 'express';
import { MediaFile } from "../types/media-file";
import { scanMediaDirectory } from "../utils/utils";
import { MEDIA_PATH } from "../app";
import { findMediaFileById } from "../utils/media-utils";
import { pathExists } from "../utils/file-utils";

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

        const file = await findMediaFileById(id);
        if (!file) {
            return res.status(404).json({ error: 'Media file not found' });
        }

        if (!await pathExists(file.path)) {
            return res.status(404).json({ error: 'Media file does not exist on disk' });
        }

        res.status(200).json({});
    } catch (error) {
        console.error('Error scanning media files: ', error);
        res.status(500).json({ error: 'Failed to scan media directory' });
    }
});

export default router;