import { Request, Response, NextFunction } from 'express';
import createHttpError from 'http-errors';

export function undefinedRouteHandler(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl, ip } = req;
    const traceId = req.traceId;

    const message = `${method} ${originalUrl} not found`;

    const traceInfo = traceId ? `[${traceId}]` : '';
    console.warn(`${traceInfo} \x1b[33mNOT_FOUND\x1b[0m ${method} ${originalUrl} from ${ip}`);

    next(createHttpError(404, message, {
        method,
        path: originalUrl,
        timestamp: new Date().toISOString()
    }));
}