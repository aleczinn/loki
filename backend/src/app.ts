import express, { Express } from 'express';
import cors from 'cors';
import bodyParser from "body-parser";
import { AddressInfo } from 'net';
import errorHandler from "./middleware/error-handler";
import dotenv from "dotenv";
import * as path from 'path';
import { loggerHandler } from "./middleware/logger-handler";
import { undefinedRouteHandler } from "./middleware/undefined-route-handler";
import { logger } from "./logger";
import { clearDir, clearDirSync, ensureDirSync } from "./utils/file-utils";
import streamingService from "./services/streaming-service";
import clientRoutes from "./routes/client-routes";
import mediaRoutes from "./routes/media-routes";
import videoRoutes from "./routes/video-routes";

import streamingRoutes from "./routes/streaming-routes";
import sessionRoutes from "./routes/session-routes";
import hwAccelDetector from "./services/hardware-acceleration-detector";


dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const MEDIA_PATH = process.env.MEDIA_PATH || path.join(__dirname, '../../../loki/loki/media');
export const TRANSCODE_PATH = process.env.TRANSCODE_PATH || path.join(__dirname, '../../../loki/loki/transcode');
export const METADATA_PATH = process.env.METADATA_PATH || path.join(__dirname, '../../../loki/loki/metadata');
export const FFMPEG_HWACCEL = process.env.FFMPEG_HWACCEL || 'unknown';

const app: Express = express();

app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? false                     // nginx handles production
        : 'http://localhost:5173',  // development frontend server
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['X-Client-Token', 'Content-Type', 'Authorization']
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(loggerHandler)

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

app.use(clientRoutes);
app.use(mediaRoutes);
app.use(videoRoutes);

// TODO : REMOVE
app.use(streamingRoutes);
app.use(sessionRoutes);

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.INFO('SIGTERM received, shutting down gracefully');
    await streamingService.shutdown();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.INFO('SIGINT received, shutting down gracefully');
    await streamingService.shutdown();
    process.exit(0);
});

app.use(undefinedRouteHandler);
app.use(errorHandler);

const server = app.listen(3000, async () => {
    const address = server.address() as AddressInfo;

    if (address && 'address' in address) {
        let host: string = address.address;
        if (host === '::') host = 'localhost';
        const port: number = address.port;

        console.log(`Listening on http://${host}:${port}`);

        logger.INFO(`Media path: ${MEDIA_PATH}`);
        ensureDirSync(MEDIA_PATH);

        logger.INFO(`Transcode path: ${TRANSCODE_PATH}`);
        ensureDirSync(TRANSCODE_PATH);

        logger.INFO(`Metadata path: ${METADATA_PATH}`);
        ensureDirSync(METADATA_PATH);
        clearDirSync(TRANSCODE_PATH);

        await hwAccelDetector.detect();
    }
});

export default server;