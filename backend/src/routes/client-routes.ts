import { Router, Request, Response } from 'express';
import clientManager from "../services/client-manager";
import { ClientInfo } from "../types/client-info";
import { ClientCapabilities } from "../types/capabilities/client-capabilities";

const router = Router();

/**
 * Register a new client and create a token if none is provided.
 */
router.post('/api/client/register', async (req: Request, res: Response) => {
        const { token, capabilities } = req.body as {
            token: string | null;
            capabilities: ClientCapabilities;
        };

        const newToken = clientManager.registerClient(token, capabilities);
    return res.status(200).json({ token: newToken  });
});

router.post('/api/client/update', async (req: Request, res: Response) => {
    const { token, capabilities } = req.body as {
        token: string | null;
        capabilities: ClientCapabilities;
    };

    const newToken = clientManager.registerClient(token, capabilities);
    return res.status(200).json({ token: newToken  });
});

router.get('/api/client/info', async (req: Request, res: Response) => {
    const clients: ClientInfo[] = Array.from( clientManager.getClients().values());

    return res.status(200).json({ clients });
});

export default router;