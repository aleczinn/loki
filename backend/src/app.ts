import express, { Express } from 'express';
import cors from 'cors';
import bodyParser from "body-parser";
import { AddressInfo } from 'net';
import errorHandler from "./middleware/error-handler";
import dotenv from "dotenv";
import * as path from 'path';
import userRoutes from "./routes/user-routes";
import mediaRoutes from "./routes/media-routes";
import streamingRoutes from "./routes/streaming-routes";
import sessionRoutes from "./routes/session-routes";
import { loggerHandler } from "./middleware/logger-handler";
import { undefinedRouteHandler } from "./middleware/undefined-route-handler";
import { logger } from "./logger";
import { userAgentMiddleware } from "./middleware/user-agent-handler";
import { ensureDirSync } from "./utils/file-utils";
import streamingService from "./services/streaming-service";


dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const MEDIA_PATH = process.env.MEDIA_PATH ||  path.join(__dirname, '../../loki/media');

const app: Express = express();

app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? false                     // nginx handles production
        : 'http://localhost:5173',  // development frontend server
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['X-Stream-Token', 'Content-Type', 'Authorization']
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

app.use(userAgentMiddleware)

app.use(userRoutes);
app.use(mediaRoutes);
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

const server = app.listen(3000, () => {
    const address = server.address() as AddressInfo;

    if (address && 'address' in address) {
        let host: string = address.address;
        if (host === '::') host = 'localhost';
        const port: number = address.port;

        console.log(`Listening on http://${host}:${port}`);
        logger.INFO(`Media path: ${MEDIA_PATH}`);
        ensureDirSync(MEDIA_PATH);
    }
});

export default server;