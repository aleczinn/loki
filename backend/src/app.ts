import express, { Express } from 'express';
import cors from 'cors';
import bodyParser from "body-parser";
import { AddressInfo } from 'net';
import errorHandler from "./middleware/error-handler";
import dotenv from "dotenv";
import mariadb from "mariadb";
import * as path from 'path';
import * as fs from 'fs-extra';
import mediaRoutes from "./routes/media-routes";
import streamingRoutes from "./routes/streaming-routes";
import mediaService from "./services/media-service";
import { loggerHandler } from "./middleware/logger-handler";
import { undefinedRouteHandler } from "./middleware/undefined-route-handler";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const MEDIA_PATH = process.env.MEDIA_PATH ||  path.join(__dirname, '../../loki/media');
export const TRANSCODE_PATH = process.env.TRANSCODE_PATH || path.join(__dirname, '../../loki/transcode');
export const METADATA_PATH = process.env.METADATA_PATH ||  path.join(__dirname, '../../loki/metadata');
export const FFMPEG_HWACCEL = process.env.FFMPEG_HWACCEL || 'auto';

// TODO : WIP - implement later
// export const database = mariadb.createPool({
//     host: process.env.DATABASE_HOST,
//     port: Number(process.env.DATABASE_PORT),
//     user: process.env.DATABASE_USER,
//     password: process.env.DATABASE_PASSWORD,
//     database: process.env.DATABASE_NAME
// });

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
    if (req.path.includes('/api/media/')) {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Range');
        res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
    }
    next();
});

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

app.use(mediaRoutes)
app.use(streamingRoutes)

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await mediaService.shutdown();
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
        console.log(`Media path: ${MEDIA_PATH}`);
        console.log(`Transcode path: ${TRANSCODE_PATH}`);
        console.log(`Metadata path: ${METADATA_PATH}`);

        fs.ensureDirSync(MEDIA_PATH);
        fs.ensureDirSync(TRANSCODE_PATH);
    }
});

export default server;