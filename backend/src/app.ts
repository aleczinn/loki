import express, {Express} from 'express';
import cors from 'cors';
import bodyParser from "body-parser";
import {AddressInfo} from 'net';
import errorHandler from "./middleware/error-handler";
import undefinedRouteHandler from "./middleware/undefined-route-handler";
import dotenv from "dotenv";
import path from "path";
import mariadb from "mariadb";
import * as process from "node:process";
import console from "console";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import testRoute from "./routes/test";
import mediaRoutes from "./routes/media";

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

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

/* Routes */
app.use(testRoute);
app.use(mediaRoutes);

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