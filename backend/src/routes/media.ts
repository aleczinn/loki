import { Router, Request, Response, NextFunction } from 'express';
import { MediaService } from '../services/media-service';
import { StreamingService } from '../services/streaming-service';
import createHttpError from 'http-errors';

const router = Router();
const mediaService = new MediaService(process.env.MEDIA_PATH || '/media');
const streamingService = new StreamingService(
    process.env.TRANSCODE_PATH || '/loki/transcode',
    parseInt(process.env.CACHE_DURATION || '24')
);

// Get all media files
router.get('/api/media', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const directory = req.query.dir as string || '';
        const files = await mediaService.getMediaFiles(directory);
        res.json(files);
    } catch (error) {
        next(createHttpError(500, 'Failed to get media files'));
    }
});

// Start streaming session
router.post('/api/stream/start', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { filePath } = req.body;

        if (!filePath) {
            return next(createHttpError(400, 'File path is required'));
        }

        const fullPath = mediaService.getMediaFilePath(filePath);

        if (!mediaService.isValidMediaFile(fullPath)) {
            return next(createHttpError(400, 'Invalid media file'));
        }

        const session = await streamingService.createStreamSession(fullPath);

        // Start transcoding in background
        streamingService.startTranscoding(session).catch(err => {
            console.error('Transcoding error:', err);
        });

        res.json({
            sessionId: session.id,
            playlistUrl: `/api/stream/${session.id}/playlist.m3u8`
        });
    } catch (error) {
        next(createHttpError(500, 'Failed to start streaming session'));
    }
});

// Get HLS playlist
router.get('/api/stream/:sessionId/playlist.m3u8', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { sessionId } = req.params;
        const playlist = await streamingService.getPlaylist(sessionId);

        if (!playlist) {
            return next(createHttpError(404, 'Playlist not found'));
        }

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(playlist);
    } catch (error) {
        next(createHttpError(500, 'Failed to get playlist'));
    }
});

// Get HLS segment
router.get('/api/stream/:sessionId/:segment', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { sessionId, segment } = req.params;

        if (!segment.endsWith('.ts')) {
            return next(createHttpError(400, 'Invalid segment format'));
        }

        const segmentData = await streamingService.getSegment(sessionId, segment);

        if (!segmentData) {
            return next(createHttpError(404, 'Segment not found'));
        }

        res.setHeader('Content-Type', 'video/mp2t');
        res.send(segmentData);
    } catch (error) {
        next(createHttpError(500, 'Failed to get segment'));
    }
});

// Cleanup old sessions periodically
// setInterval(() => {
//     streamingService.cleanupOldSessions();
// }, 60 * 60 * 1000); // Run every hour

export default router;