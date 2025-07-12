import { Router, Request, Response } from 'express';
import mediaService from "../services/media-service";

const router = Router();

// Stream starten
router.get('/api/stream', async (req: Request, res: Response) => {
    try {
        const { filePath } = req.body;

        if (!filePath) {
            return res.status(400).json({ error: 'File path is required' });
        }

        // const session = await mediaService.startSession(filePath);

        // res.json({
        //     sessionId: session.id,
        //     duration: session.duration,
        //     playlistUrl: `/api/stream/${session.id}/playlist.m3u8`,
        //     metadata: session.metadata
        // });
        res.status(200).json({ filePath });
    } catch (error) {
        console.error('Error starting stream:', error);
        res.status(500).json({ error: 'Failed to start streaming session' });
    }
});

// Playlist abrufen
router.get('/api/stream/:sessionId/playlist.m3u8', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const { t } = req.query;

        const requestedTime = parseFloat(t as string) || 0;
        await mediaService.ensureSegmentsAvailable(sessionId, requestedTime);

        const playlist = await mediaService.generatePlaylist(sessionId, requestedTime);

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(playlist);
    } catch (error) {
        console.error('Error generating playlist:', error);
        res.status(500).json({ error: 'Failed to generate playlist' });
    }
});

// Segment abrufen
router.get('/api/stream/:sessionId/segment_:segmentIndex.ts', async (req: Request, res: Response) => {
    try {
        const { sessionId, segmentIndex } = req.params;
        const segmentIdx = parseInt(segmentIndex);

        const segmentPath = mediaService.getSegmentPath(sessionId, segmentIdx);

        if (!segmentPath) {
            // Segment on-demand generieren
            await mediaService.requestSegment(sessionId, segmentIdx);
            const updatedPath = mediaService.getSegmentPath(sessionId, segmentIdx);

            if (!updatedPath) {
                return res.status(404).json({ error: 'Segment not available' });
            }
        }

        res.setHeader('Content-Type', 'video/mp2t');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        // res.sendFile(segmentPath);
    } catch (error) {
        console.error('Error serving segment:', error);
        res.status(500).json({ error: 'Failed to serve segment' });
    }
});

// Seek-Funktion
router.post('/api/stream/:sessionId/seek', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { time } = req.body;

        const seekTime = parseFloat(time) || 0;
        await mediaService.ensureSegmentsAvailable(sessionId, seekTime);

        res.json({
            success: true,
            seekTime,
            playlistUrl: `/api/stream/${sessionId}/playlist.m3u8?t=${seekTime}`
        });
    } catch (error) {
        console.error('Error seeking:', error);
        res.status(500).json({ error: 'Failed to seek' });
    }
});

// Session beenden
router.delete('/api/stream/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        await mediaService.stopSession(sessionId);
        res.json({ success: true });
    } catch (error) {
        console.error('Error stopping session:', error);
        res.status(500).json({ error: 'Failed to stop session' });
    }
});

export default router;