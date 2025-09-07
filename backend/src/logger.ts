import * as path from 'path';
import { ensureDirSync } from "./utils/file-utils";
import fs from "fs";

const LOGS_DIR = path.join(__dirname, '../../loki/logs');

enum LogLevel {
    INFO = 0,
    WARNING = 1,
    ERROR = 2,
    DEBUG = 3
}

const COLOR = {
    BLACK: "\x1b[30m",
    RED: "\x1b[31m",
    GREEN: "\x1b[32m",
    YELLOW: "\x1b[33m",
    BLUE: "\x1b[34m",
    MAGENTA: "\x1b[35m",
    CYAN: "\x1b[36m",
    WHITE: "\x1b[37m",
    RESET: "\x1b[0m"
};

interface LogStreams {
    infoLog: fs.WriteStream;
    warningLog: fs.WriteStream;
    errorLog: fs.WriteStream;
    debugLog: fs.WriteStream;
    allLog: fs.WriteStream;
    currentLogDate: number;
}

class Logger {

    private logLevelColors: { [key in LogLevel]: string } = {
        [LogLevel.INFO]: COLOR.RESET,
        [LogLevel.DEBUG]: COLOR.CYAN,
        [LogLevel.WARNING]: COLOR.YELLOW,
        [LogLevel.ERROR]: COLOR.RED
    };

    private logLevelNames: { [key in LogLevel]: string } = {
        [LogLevel.INFO]: 'INFO',
        [LogLevel.WARNING]: 'WARNING',
        [LogLevel.ERROR]: 'ERROR',
        [LogLevel.DEBUG]: 'DEBUG'
    };

    constructor() {
        this.ensureLogsDirectory();
    }

    private ensureLogsDirectory(): void {
        try {
            ensureDirSync(LOGS_DIR);
        } catch (error) {
            console.error('Failed to create logs directory:', error);
        }
    }

    private formatTimestamp(): string {
        const now = new Date();
        return now.toISOString().replace('T', ' ').substring(0, 19);
    }

    private log(level: LogLevel, message: string): void {
        const timestamp = this.formatTimestamp();
        const levelName = this.logLevelNames[level];
        const color = this.logLevelColors[level];
        const colorMessage = level === LogLevel.INFO ? COLOR.WHITE : color;

        console.log(`${COLOR.RESET}[${colorMessage}${levelName}${COLOR.RESET}] ${color}${timestamp} > ${message}${COLOR.RESET}`);
    }

    public INFO(message: string): void {
        this.log(LogLevel.INFO, message);
    }

    public WARNING(message: string): void {
        this.log(LogLevel.WARNING, message);
    }

    public ERROR(message: string): void {
        this.log(LogLevel.ERROR, message);
    }

    public DEBUG(message: string): void {
        this.log(LogLevel.DEBUG, message);
    }
}

const logger = new Logger();

export { Logger, LogLevel, logger };
