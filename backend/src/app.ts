import express, {Express} from 'express';
import cors from 'cors';
import bodyParser from "body-parser";
import {AddressInfo} from 'net';
import errorHandler from "./middleware/error-handler";
import undefinedRouteHandler from "./middleware/undefined-route-handler";
import dotenv from "dotenv";
import path from "path";
import mariadb from "mariadb";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const database = mariadb.createPool({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME
});

const app: Express = express();

app.use(cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

/* Routes */


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