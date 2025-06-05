import Router from 'express';
import { MediaController } from "../controller/media-controller";

const router = Router();

// Get all media files
router.get('/api/media', MediaController.getMediaFiles);

// Get media file info
router.get('/api/media/:id/info', MediaController.getMediaInfo);

// Stream media file (master playlist)
router.get('/api/media/:id/stream', MediaController.streamMedia);

// Get HLS playlist
router.get('/api/media/:id/playlist.m3u8', MediaController.getPlaylist);

// Get HLS segment
router.get('/api/media/:id/segment:segment.ts', MediaController.getSegment);

export default router;