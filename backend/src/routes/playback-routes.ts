import { Router, Request, Response } from 'express';
import { findMediaFileById } from "../utils/media-utils";
import { logger } from "../logger";
import clientManager from "../services/client-manager";
import transcodeDecisionService from "../services/ transcode-decision";

const router = Router();

/**
 * Get playback information for a media file
 * This tells the client how to play the file (direct, transcode, etc.)
 * GET /api/playback/:id/info
 */
router.get('/api/playback/:id/info', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const quality = req.query.quality as string || 'original';
        const token = req.headers['x-client-token'] as string || req.query.token as string || undefined;

        if (!token) {
            return res.status(401).json({ error: 'No client token provided' });
        }

        // Get media file
        const file = await findMediaFileById(id);
        if (!file) {
            return res.status(404).json({ error: 'Media file not found' });
        }

        // Get client capabilities
        const client = clientManager.getClient(token);
        if (!client) {
            return res.status(401).json({ error: 'Invalid client token' });
        }

        // Make transcoding decision
        const decision = transcodeDecisionService.decide(file, client.capabilities);

        // Build response based on decision
        const playbackInfo = {
            mediaId: file.id,
            mode: decision.mode,
            playbackUrl: decision.mode === 'direct_play'
                ? `/api/streaming/${id}/direct`
                : `/api/streaming/${id}/${quality}/playlist.m3u8`,
            decision: {
                video: decision.video,
                audio: decision.audio,
                subtitle: decision.subtitle,
                container: decision.container
            },
            statistics: decision.statistics,
            metadata: {
                duration: file.metadata?.general.Duration || 0,
                resolution: file.metadata?.video[0]
                    ? `${file.metadata.video[0].Width}x${file.metadata.video[0].Height}`
                    : 'unknown',
                videoCodec: file.metadata?.video[0]?.Format || 'unknown',
                audioCodec: file.metadata?.audio[0]?.Format || 'unknown'
            }
        };

        logger.INFO(`Playback Info for ${file.name}: mode=${decision.mode}, video=${decision.video.action}, audio=${decision.audio.action}`);

        res.status(200).json(playbackInfo);

    } catch (error) {
        logger.ERROR(`Error getting playback info: ${error}`);
        res.status(500).json({ error: 'Failed to get playback information' });
    }
});

export default router;