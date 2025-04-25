import {Request, Response, NextFunction, ErrorRequestHandler} from 'express';
import {isHttpError} from "http-errors";

const errorHandler: ErrorRequestHandler = (error: unknown, req: Request, res: Response, next: NextFunction) => {
    console.error(error);

    let errorMessage = "An unknown error occurred";
    let statusCode = 500;

    if (isHttpError(error)) {
        errorMessage = error.message;
        statusCode = error.statusCode;
    }
    res.status(statusCode).json({error: errorMessage});
}

export default errorHandler;