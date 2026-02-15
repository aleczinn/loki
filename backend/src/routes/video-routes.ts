import { Router, Request, Response } from 'express';
import { logger } from "../logger";
import { findMediaFileById } from "../utils/media-utils";
import clientManager from "../services/client-manager";
import { pathExists, stat } from "../utils/file-utils";
import streamingService, { PlaySession } from "../services/streaming-service";
import { BANDWIDTH_BY_PROFILE, QualityProfile } from "../services/transcode-decision";

const router = Router();

/**
 * Route for direct play
 */
router.get('/api/videos/:mediaId/stream', async (req: Request, res: Response) => {
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
 * Route for hls
 */
router.get('/api/videos/:mediaId/master.m3u8', async (req: Request, res: Response) => {
    try {
        const { mediaId } = req.params;

        const profile = (req.query.profile as QualityProfile) ?? 'original';
        const audio = Number(req.query.audio ?? 0);
        const subtitle = req.query.subtitle as string | undefined;

        const token = req.headers['x-client-token'] as string || req.query.token as string || undefined;

        if (!token) {
            return res.status(401).json({ error: 'No client token provided' });
        }

        // Get media file
        const file = await findMediaFileById(mediaId);
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

        const session = streamingService.getOrCreateSession(client, file, profile);

        switch (session.decision.mode) {
            case 'direct_play':
                console.log("use direct play");
                const range = req.headers.range;
                // return await streamingService.streamDirectPlay(req, res, session, range);
                break;
            case 'direct_remux':
                console.log("use direct remux");
                return await streamingService.streamDirectRemux(req, res, session);
            case 'transcode':
                console.log("use transcode");
                const bandwidth = BANDWIDTH_BY_PROFILE[session.decision.profile];

                res.type('application/vnd.apple.mpegurl');

                const masterPlaylist = [
                    '#EXTM3U',
                    '#EXT-X-VERSION:3',
                    `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth}`,
                    `/api/videos/hls/${session.id}/index.m3u8`
                ].join('\n');

                return res.send(masterPlaylist);
        }
    } catch (error) {
        logger.ERROR(`Error getting active sessions: ${error}`);
        res.status(500).json({ error: 'Failed to get active sessions' });
    }
});

router.get('/api/videos/hls/:sessionId/index.m3u8', async (req, res) => {
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

router.get('/api/videos/hls/:sessionId/:segment', async (req: Request, res: Response): Promise<any> => {
        const { sessionId, segment } = req.params;

        const match = segment.match(/segment(\d+)\.ts/);
        if (!match) {
            return res.sendStatus(404);
        }

        const segmentIndex = Number(match[1]);

        const session = streamingService.getSession(sessionId);
        if (!session) {
            return res.sendStatus(404);
        }

        const segmentPath = await streamingService.getSegment(session, segmentIndex);

        if (segmentPath && await pathExists(segmentPath)) {
            res.setHeader('Content-Type', 'video/mp2t');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.sendFile(segmentPath);
        }

        try {
            // ✨ Intelligentes Warten auf Segment mit Polling
            const segmentPath = await waitForSegment(
                session,
                segmentIndex,
                {
                    pollInterval: 100,      // Alle 100ms prüfen
                    timeout: 3000,
                    maxPolls: 100          // Max 100 Versuche (= 10s bei 100ms)
                }
            );

            if (segmentPath) {
                res.setHeader('Content-Type', 'video/mp2t');
                res.setHeader('Cache-Control', 'public, max-age=3600');
                res.setHeader('Accept-Ranges', 'bytes');
                return res.sendFile(segmentPath);
            }

            // Timeout erreicht - Segment konnte nicht erstellt werden
            logger.WARNING(`Segment ${segmentIndex} timeout after 10s [${sessionId}]`);

            res.setHeader('Retry-After', '2');
            return res.status(503).json({
                error: 'Segment not ready',
                message: 'Transcoding in progress, please retry',
                segmentIndex: segmentIndex
            });

        } catch (error) {
            logger.ERROR(`Error serving segment ${segmentIndex}: ${error}`);
            return res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to serve segment'
            });
        }
    }
);

/**
 * Wait for segment with intelligent polling
 */
async function waitForSegment(
    session: PlaySession,
    segmentIndex: number,
    options: {
        pollInterval: number;
        timeout: number;
        maxPolls: number;
    }
): Promise<string | null> {
    const startTime = Date.now();
    let pollCount = 0;

    while (pollCount < options.maxPolls) {
        // Prüfe ob Segment existiert
        const segmentPath = await streamingService.getSegment(session, segmentIndex);

        if (segmentPath && await pathExists(segmentPath)) {
            const elapsed = Date.now() - startTime;
            logger.DEBUG(`Segment ${segmentIndex} ready after ${elapsed}ms (${pollCount} polls)`);
            return segmentPath;
        }

        // Prüfe Timeout
        const elapsed = Date.now() - startTime;
        if (elapsed >= options.timeout) {
            logger.WARNING(`Segment ${segmentIndex} timeout after ${elapsed}ms`);
            return null;
        }

        // Warte vor nächstem Poll
        await new Promise(resolve => setTimeout(resolve, options.pollInterval));
        pollCount++;
    }

    return null;
}

export default router;