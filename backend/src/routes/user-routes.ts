import { Router, Request, Response } from 'express';
import userManager from "../services/user-manager";

const router = Router();

/**
 * Register a new client and create a token if none is provided.
 */
router.post('/api/user/register', async (req: Request, res: Response) => {
        const { token } = req.body;

        if (token) {
            return res.status(200).json({ token: token });
        }

        const newToken = userManager.createToken();
    return res.status(200).json({ token: newToken  });
});

export default router;