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
    const { statusCode } = res;

    req.traceId = traceId;

    res.on('finish', () => {
        const duration = performance.now() - start;

        console.log(`[${traceId}] - ${method} - ${originalUrl} - ${statusCode} - ${duration.toFixed(2)}ms`);
    });

    next();
}
