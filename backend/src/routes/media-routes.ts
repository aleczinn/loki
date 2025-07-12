import { Router, Request, Response } from 'express';
import { MediaFile } from "../types/media-file";
import { scanMediaDirectory } from "../utils/utils";
import { MEDIA_PATH } from "../app";

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

export default router;