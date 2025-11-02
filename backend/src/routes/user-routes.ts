import { Router, Request, Response } from 'express';
import userManager from "../services/user-manager";
import { ClientInfo } from "../types/client-info";

const router = Router();

/**
 * Register a new client and create a token if none is provided.
 */
router.post('/api/user/register', async (req: Request, res: Response) => {
        const { token, capabilities } = req.body;
        const userAgent = req.get('User-Agent') || 'Unknown';

        const newToken = userManager.registerClient(token, userAgent, capabilities);
    return res.status(200).json({ token: newToken  });
});

router.get('/api/user/info', async (req: Request, res: Response) => {
    const clients: ClientInfo[] = Array.from( userManager.getClients().values());

    return res.status(200).json({ clients });
});

export default router;