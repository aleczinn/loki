import { randomUUID } from 'crypto'
import { performance } from 'node:perf_hooks'
import { NextFunction, Request, Response } from "express";

declare global {
    namespace Express {
        interface Request {
            traceId: string;
        }
    }
}

export function loggerHandler(req: Request, res: Response, next: NextFunction): void {
    const traceId = randomUUID();
    const start = performance.now()
    const { method, originalUrl } = req;

    req.traceId = traceId;

    res.on('finish', () => {
        const duration = performance.now() - start;
        const { statusCode } = res;
        const statusColor = getStatusColor(statusCode);

        console.log(`[${traceId}] -> ${method} - ${originalUrl} - ${statusColor}${statusCode}\x1b[0m - ${duration.toFixed(2)}ms`);
    });

    res.on('close', () => {
        if (!res.headersSent) {
            const duration = performance.now() - start;
            console.log(`[${traceId}] ! ${method} ${originalUrl} \x1b[31mCONNECTION_CLOSED\x1b[0m - ${duration.toFixed(2)}ms`);
        }
    });

    next();
}

function getStatusColor(statusCode: number): string {
    if (statusCode >= 500) return '\x1b[31m'; // red for 5xx
    if (statusCode >= 400) return '\x1b[33m'; // yellow for 4xx
    if (statusCode >= 300) return '\x1b[36m'; // cyan for 3xx
    if (statusCode >= 200) return '\x1b[32m'; // green for 2xx
    return '\x1b[37m'; // white for others
}