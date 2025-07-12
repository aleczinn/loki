import { Router, Request, Response } from 'express';
import { MediaFile } from "../types/media-file";
import { scanMediaDirectory } from "../utils/utils";
import { MEDIA_PATH } from "../app";

const router = Router();

// Stream starten
router.get('/api/stream', async (req: Request, res: Response) => {
    try {

    } catch (error) {
        console.error('Error starting stream:', error);
        res.status(500).json({ error: 'Failed to start streaming session' });
    }
});

// Playlist abrufen
router.get('/api/stream/:sessionId/playlist.m3u8', async (req: Request, res: Response) => {
    try {

    } catch (error) {
        console.error('Error generating playlist:', error);
        res.status(500).json({ error: 'Failed to generate playlist' });
    }
});

// Segment abrufen
router.get('/api/stream/:sessionId/segment_:segmentIndex.ts', async (req: Request, res: Response) => {
    try {

    } catch (error) {
        console.error('Error serving segment:', error);
        res.status(500).json({ error: 'Failed to serve segment' });
    }
});

// Seek-Funktion
router.post('/api/stream/:sessionId/seek', async (req, res) => {
    try {

    } catch (error) {
        console.error('Error seeking:', error);
        res.status(500).json({ error: 'Failed to seek' });
    }
});

// Session beenden
router.delete('/api/stream/:sessionId', async (req, res) => {
    try {

    } catch (error) {
        console.error('Error stopping session:', error);
        res.status(500).json({ error: 'Failed to stop session' });
    }
});

export default router;