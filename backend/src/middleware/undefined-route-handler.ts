import {Request, Response, NextFunction} from 'express';
import createHttpError from "http-errors";

const undefinedRouteHandler = (req: Request, res: Response, next: NextFunction) => {
    next(createHttpError(404, 'Endpoint not found'));
}

export default undefinedRouteHandler;