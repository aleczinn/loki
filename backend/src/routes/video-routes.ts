import { Router, Request, Response } from 'express';
import { logger } from "../logger";
import { findMediaFileById } from "../utils/media-utils";
import clientManager from "../services/client-manager";
import { pathExists, stat } from "../utils/file-utils";
import streamingService, { PlaySession } from "../services/streaming-service";
import { BANDWIDTH_BY_PROFILE, QualityProfile } from "../services/transcode-decision";
import path from "path";
import { TRANSCODE_PATH } from "../app";

const router = Router();

/**
 * Route for direct play
 */
router.get('/api/hls/:mediaId/stream', async (req: Request, res: Response) => {
    const { mediaId } = req.params;
    const token = req.headers['x-client-token'] as string || req.query.token as string;

    if (!token) {
        return res.status(401).json({ error: 'No client token provided' });
    }

    const file = await findMediaFileById(mediaId);
    if (!file || !await pathExists(file.path)) {
        return res.status(404).json({ error: 'Media file not found' });
    }

    const range = req.headers.range;
    await streamingService.streamDirectPlay(req, res, file, range);
});

/**
 * HLS Master Playlist
 * Schlägt nur Session nach und verweist auf index.m3u8
 */
router.get('/api/hls/:sessionId/master.m3u8', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;

        const session = streamingService.getSession(sessionId);
        if (!session) {
            return res.status(404).json({ error: `Session ${sessionId} not found` });
        }

        const bandwidth = BANDWIDTH_BY_PROFILE[session.decision.profile] || 10000000;

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache');

        const masterPlaylist = [
            '#EXTM3U',
            '#EXT-X-VERSION:7',
            `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth}`,
            `index.m3u8`
        ].join('\n');

        return res.send(masterPlaylist);
    } catch (error) {
        logger.ERROR(`Error getting active sessions: ${error}`);
        res.status(500).json({ error: 'Failed to get active sessions' });
    }
});

/**
 * HLS Index Playlist (Media Playlist)
 * Startet ggf. FFmpeg und liefert die Segment-Liste
 */
router.get('/api/hls/:sessionId/index.m3u8', async (req, res) => {
    const { sessionId } = req.params;

    const session = streamingService.getSession(sessionId);
    if (!session) {
        return res.status(404).json({ error: `Session ${sessionId} not found` });
    }

    const playlist = await streamingService.getPlaylist(session);

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(playlist);
});

/**
 * HLS Segment
 * Liefert Segmente aus
 */
router.get('/api/hls/:sessionId/:segment', async (req: Request, res: Response): Promise<any> => {
    const { sessionId, segment } = req.params;

    const session = streamingService.getSession(sessionId);
    if (!session) {
        return res.sendStatus(404);
    }

    const job = session.transcode;
    if (!job) {
        return res.sendStatus(404);
    }

    const dir = path.join(TRANSCODE_PATH, sessionId, job.id);

    // Init Segment (fMP4)
    if (segment.startsWith('init') && segment.endsWith('.mp4')) {
        const initPath = path.join(dir, 'init.mp4');

        if (await pathExists(initPath)) {
            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.sendFile(initPath);
        }

        // Warte kurz — init.mp4 wird von FFmpeg als erstes geschrieben
        try {
            await streamingService.waitForFile(initPath, 5000);
            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.sendFile(initPath);
        } catch {
            return res.status(503).json({ error: 'Init segment not ready' });
        }
    }

    // Media Segments
    const match = segment.match(/segment(\d+)\.mp4/);
    if (!match) {
        return res.sendStatus(404);
    }

    const segmentIndex = Number(match[1]);

    try {
        const segmentPath = await streamingService.getSegment(session, segmentIndex);

        if (segmentPath && await pathExists(segmentPath)) {
            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.sendFile(segmentPath);
        }

        res.setHeader('Retry-After', '2');
        return res.status(503).json({
            error: 'Segment not ready',
            segmentIndex
        });
    } catch (error) {
        logger.ERROR(`Error serving segment ${segmentIndex}: ${error}`);
        return res.status(500).json({ error: 'Failed to serve segment' });
    }



    // // const match = segment.match(/segment(\d+)\.ts/);
    // const match = segment.match(/segment(\d+)\.mp4/);
    // if (!match) {
    //     return res.sendStatus(404);
    // }
    //
    // const segmentIndex = Number(match[1]);
    // const session = streamingService.getSession(sessionId);
    // if (!session) {
    //     return res.sendStatus(404);
    // }
    //
    // try {
    //     const segmentPath = await streamingService.getSegment(session, segmentIndex);
    //
    //     if (segmentPath && await pathExists(segmentPath)) {
    //         res.setHeader('Content-Type', 'video/mp4'); // mime type to mp4 because of fMP4 -> change to video/mp2t for .ts files (mpegts)
    //         res.setHeader('Cache-Control', 'public, max-age=3600');
    //         return res.sendFile(segmentPath);
    //     }
    //
    //     // Segment noch nicht fertig
    //     res.setHeader('Retry-After', '2');
    //     return res.status(503).json({
    //         error: 'Segment not ready',
    //         segmentIndex
    //     });
    // } catch (error) {
    //     logger.ERROR(`Error serving segment ${segmentIndex}: ${error}`);
    //     return res.status(500).json({ error: 'Failed to serve segment' });
    // }
});

export default router;