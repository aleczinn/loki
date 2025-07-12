import express, {Express} from 'express';
import cors from 'cors';
import bodyParser from "body-parser";
import {AddressInfo} from 'net';
import errorHandler from "./middleware/error-handler";
import undefinedRouteHandler from "./middleware/undefined-route-handler";
import dotenv from "dotenv";
import mariadb from "mariadb";
import * as process from "node:process";
import * as path from 'path';
import * as fs from 'fs-extra';
import console from "console";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { generateSessionId, MediaSession, scanMediaDirectory } from 'services/media-session';

const sessions = new Map<string, MediaSession>();

export const database = mariadb.createPool({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME
});

const app: Express = express();

app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? false                     // nginx handles production
        : 'http://localhost:5173',  // development frontend server
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Zusätzliche CORS Headers für Streaming
app.use((req, res, next) => {
    // CORS Headers für HLS Streaming
    if (req.path.includes('/api/stream/')) {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Range');
        res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
    }
    next();
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

const MEDIA_PATH = process.env.MEDIA_PATH || '/media';
const TRANSCODE_PATH = process.env.TRANSCODE_PATH || './transcode';
const CACHE_DIR = process.env.CACHE_DIR || './cache';
const METADATA_PATH = process.env.METADATA_PATH || './metadata';
const FFMPEG_HWACCEL = process.env.FFMPEG_HWACCEL || 'auto';

function getRelativeMediaPath(absolutePath: string): string {
    return path.relative(MEDIA_PATH, absolutePath);
}

function getAbsoluteMediaPath(relativePath: string): string {
    return path.join(MEDIA_PATH, relativePath);
}

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Get media library
app.get('/api/media', async (req, res) => {
    try {
        const mediaFiles = await scanMediaDirectory(MEDIA_PATH);
        res.json({ files: mediaFiles });
    } catch (error) {
        console.error('Error scanning media directory:', error);
        res.status(500).json({ error: 'Failed to scan media directory' });
    }
});

// Start streaming session
app.post('/api/stream/start', async (req, res) => {
    try {
        const { filePath } = req.body;

        if (!filePath) {
            return res.status(400).json({ error: 'File path is required' });
        }

        const absolutePath = getAbsoluteMediaPath(filePath);

        if (!await fs.pathExists(absolutePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        const sessionId = generateSessionId(absolutePath);

        if (sessions.has(sessionId)) {
            const existingSession = sessions.get(sessionId)!;
            existingSession.lastAccessed = Date.now();
            return res.json({
                sessionId,
                duration: existingSession.duration,
                playlistUrl: `/api/stream/${sessionId}/playlist.m3u8`
            });
        }

        const session = new MediaSession(absolutePath, sessionId);
        const initialized = await session.initialize();

        if (!initialized) {
            return res.status(500).json({ error: 'Failed to initialize streaming session' });
        }

        sessions.set(sessionId, session);
        await session.ensureSegmentsAvailable(0);

        res.json({
            sessionId,
            duration: session.duration,
            playlistUrl: `/api/stream/${sessionId}/playlist.m3u8`,
            metadata: session.metadata
        });

    } catch (error) {
        console.error('Error starting stream:', error);
        res.status(500).json({ error: 'Failed to start streaming session' });
    }
});

// Get playlist
app.get('/api/stream/:sessionId/playlist.m3u8', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = sessions.get(sessionId);

        if (!session?.isActive) {
            return res.status(404).json({ error: 'Session not found' });
        }

        session.lastAccessed = Date.now();

        const playlist = await fs.readFile(session.playlistPath, 'utf8');
        res.set('Content-Type', 'application/vnd.apple.mpegurl');
        res.set('Cache-Control', 'no-cache');
        res.send(playlist);

    } catch (error) {
        console.error('Error serving playlist:', error);
        res.status(500).json({ error: 'Failed to serve playlist' });
    }
});

// Get segment
app.get('/api/stream/:sessionId/segment_:segmentNumber.ts', async (req, res) => {
    try {
        const { sessionId, segmentNumber } = req.params;
        const session = sessions.get(sessionId);

        if (!session?.isActive) {
            return res.status(404).json({ error: 'Session not found' });
        }

        session.lastAccessed = Date.now();
        const segNum = parseInt(segmentNumber);

        if (segNum + 1 < session.totalSegments) {
            session.ensureSegmentsAvailable(segNum + 1).catch(console.error);
        }

        const segmentPath = session.getSegmentPath(segNum);

        if (!await session.hasSegment(segNum)) {
            const startTime = segNum * session.segmentDuration;
            await session.transcodeSegment(segNum, startTime);
        }

        if (await fs.pathExists(segmentPath)) {
            res.set('Content-Type', 'video/mp2t');
            res.set('Cache-Control', 'public, max-age=3600');
            const stream = fs.createReadStream(segmentPath);
            stream.pipe(res);
        } else {
            res.status(404).json({ error: 'Segment not found' });
        }

    } catch (error) {
        console.error('Error serving segment:', error);
        res.status(500).json({ error: 'Failed to serve segment' });
    }
});

// Seek to position
app.post('/api/stream/:sessionId/seek', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { time } = req.body;

        const session = sessions.get(sessionId);

        if (!session?.isActive) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (typeof time !== 'number' || time < 0 || (session.duration && time > session.duration)) {
            return res.status(400).json({ error: 'Invalid time position' });
        }

        await session.seek(time);
        session.lastAccessed = Date.now();

        res.json({
            success: true,
            currentSegment: Math.floor(time / session.segmentDuration)
        });

    } catch (error) {
        console.error('Error seeking:', error);
        res.status(500).json({ error: 'Failed to seek' });
    }
});

// Stop session
app.delete('/api/stream/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);

    if (session) {
        session.cleanup();
        sessions.delete(sessionId);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Session not found' });
    }
});

// Session status
app.get('/api/stream/:sessionId/status', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);

    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session.getStatus());
});

// Session cleanup job
// cron.schedule('*/30 * * * *', () => {
//     console.log('Running session cleanup...');
//     const now = Date.now();
//     const maxIdleTime = 2 * 60 * 60 * 1000; // 2 hours
//
//     for (const [sessionId, session] of sessions.entries()) {
//         if (now - session.lastAccessed > maxIdleTime) {
//             console.log(`Cleaning up inactive session: ${sessionId}`);
//             session.cleanup();
//             sessions.delete(sessionId);
//         }
//     }
// });

process.on('SIGTERM', () => {
    console.log('Cleaning up sessions...');
    for (const session of sessions.values()) {
        session.cleanup();
    }
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Cleaning up sessions...');
    for (const session of sessions.values()) {
        session.cleanup();
    }
    process.exit(0);
});

app.use(undefinedRouteHandler);
app.use(errorHandler);

const server = app.listen(3000, () => {
    const address = server.address() as AddressInfo;

    if (address && 'address' in address) {
        let host: string = address.address;
        if (host === '::') host = 'localhost';
        const port: number = address.port;

        console.log(`Listening on http://${host}:${port}`);
    }
});

export default server;