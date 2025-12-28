import { Router, Request, Response } from 'express';
import { logger } from "../logger";
import streamingService from "../services/streaming-service";
import clientManager from "../services/client-manager";
import { findMediaFileById } from "../utils/media-utils";

const router = Router();

/**
 * Stop playback session
 */
router.post('/api/session/start', async (req: Request, res: Response) => {
    try {
        const { mediaId, profile, audioTrack, subtitleTrack } = req.body;
        const token = req.headers['x-client-token'] as string || req.query.token as string || undefined;

        if (!token) {
            return res.status(401).json({ error: 'No client token provided' });
        }

        if (!mediaId) {
            return res.status(400).json({ error: 'Media ID required' });
        }

        const client = clientManager.getClient(token);
        if (!client) {
            return res.status(401).json({ error: 'Invalid client token' });
        }

        const file = await findMediaFileById(mediaId);
        if (!file) {
            return res.status(404).json({ error: 'Media file not found' });
        }

        const session = streamingService.getOrCreateSession(client, file, profile);

        return res.status(200).json({
            sessionId: session.id,
            file: session.file
        });
    } catch (error) {
        logger.ERROR(`Failed to start a new session: ${error}`);
        res.status(500).json({ error: 'Failed to start a new session' });
    }
});

/**
 * Report playback statistics (Heartbeat)
 * Call this every 5-10 seconds
 */
router.post('/api/session/progress', async (req: Request, res: Response) => {
    try {
        const { sessionId, currentTime, isPaused } = req.body;

        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID required' });
        }

        await streamingService.reportStatistics(sessionId, currentTime, isPaused);

        res.status(204).send();
    } catch (error) {
        logger.ERROR(`Error reporting statistics: ${error}`);
        res.status(500).json({ error: 'Failed to report statistics' });
    }
});

/**
 * Report a seek operation
 */
router.post('/api/session/seek', async (req: Request, res: Response) => {
    try {
        const { sessionId, time } = req.body;

        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID required' });
        }

        if (!time) {
            return res.status(400).json({ error: 'No time provided' });
        }

        const result = await streamingService.handleSeek(sessionId, time);

        res.status(200).send(result);
    } catch (error) {
        logger.ERROR(`Error reporting a client seek: ${error}`);
        res.status(500).json({ error: 'Failed to report a client seek' });
    }
});

/**
 * Stop playback session
 */
router.post('/api/session/stop', async (req: Request, res: Response) => {
    try {
        const { sessionId, time } = req.body;

        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID required' });
        }

        const session = streamingService.getSession(sessionId);
        if (!session) {
            return res.status(404).json({ error: `No session for id ${sessionId} found` });
        }

        await streamingService.handlePlaybackStop(sessionId, time);

        res.status(204).send();
    } catch (error) {
        logger.ERROR(`Error stopping a session: ${error}`);
        res.status(500).json({ error: 'Failed to stop a session' });
    }
});

/**
 * Info for Session
 */
router.get('/api/session/:sessionId', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;

        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID required' });
        }

        const session = streamingService.getSession(sessionId);
        if (!session) {
            return res.status(404).json({ error: `No session for id ${sessionId} found` });
        }

        const { decision } = session;
        const transcode = session.transcode;

        const response: any = {
            id: session.id,
            client: session.client,
            file: session.file,
            decision,
            audioIndex: session.audioIndex,
            subtitleIndex: session.subtitleIndex,
            createdAt: session.createdAt,
            lastAccessed: session.lastAccessed,
            transcode: {}
        };

        if (transcode && decision.mode !== 'direct_play') {

            response.transcode = {
                progress: transcode.progress,
                fps: transcode.fps,
                speed: transcode.speed
            }
        }

        res.status(200).json(response);
    } catch (error) {
        logger.ERROR(`Error for session info: ${error}`);
        res.status(500).json({ error: 'Failed to generate session info' });
    }
});

export default router;