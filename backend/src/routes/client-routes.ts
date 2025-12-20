import { Request, Response, Router } from 'express';
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

    capabilities.client.ipAddress = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket.remoteAddress;

    const newToken = clientManager.registerClient(token, capabilities);
    return res.status(200).json({ token: newToken });
});

router.post('/api/client/update', async (req: Request, res: Response) => {
    const { token, capabilities } = req.body as {
        token: string | null;
        capabilities: ClientCapabilities;
    };

    if (!token) {
        return res.status(401).json({ error: 'No client token provided' });
    }

    if (!capabilities) {
        return res.status(401).json({ error: 'No client capabilities provided' });
    }

    const status = clientManager.updateClientCapabilities(token, capabilities);
    if (status) {
        return res.status(200);
    }
    return res.status(404).json({ error: `no client with token ${token} found` });
});

router.get('/api/client/:token', async (req: Request, res: Response) => {
    const { token } = req.params;

    if (!token) {
        return res.status(401).json({ error: 'No client token provided' });
    }

    const client = clientManager.getClient(token);
    if (!client) {
        return res.status(404).json({ error: `No client for token ${token} found` });
    }

    return res.status(200).json({ client });
});

router.get('/api/client/', async (req: Request, res: Response) => {
    const clients: ClientInfo[] = Array.from(clientManager.getClients().values());

    return res.status(200).json({ clients });
});

export default router;