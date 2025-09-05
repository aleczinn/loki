import { Router, Request, Response } from 'express';
import mediaService from "../services/streaming-service";
import { logger } from "../logger";

const router = Router();

router.get('/api/userinfo', async (req: Request, res: Response) => {
    try {
        const client = req.clientInfo;

        res.status(200).json(client);
    } catch (error) {
        logger.ERROR(`Error getting active sessions: ${error}`);
        res.status(500).json({ error: 'Failed to get active sessions' });
    }
});

/**
 * Return all active sessions
 */
router.get('/api/sessions', async (req: Request, res: Response) => {
    try {
        const sessions = mediaService.getSessions();
        res.status(200).json(Array.from(sessions.values()));
    } catch (error) {
        logger.ERROR(`Error getting active sessions: ${error}`);
        res.status(500).json({ error: 'Failed to get active sessions' });
    }
});

/**
 * Get specific session with details
 */
router.get('/api/sessions/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const sessions = mediaService.getSessions();
        const session = sessions.get(id)

        if (!session) {
            return res.status(404).json({ error: `Session with id '${id}' not found.` });
        }

        res.status(200).json(session);
    } catch (error) {
        logger.ERROR(`Error getting active sessions: ${error}`);
        res.status(500).json({ error: 'Failed to get active sessions' });
    }
});

export default router;