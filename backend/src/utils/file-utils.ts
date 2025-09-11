import { rm, mkdir, access, constants, readFile as fsReadFile, writeFile as fsWriteFile, readdir as fsReaddir, stat as fsStat } from 'fs/promises';
import fs from "fs";
import path from "path";
import { RED, RESET } from "./utils";
import { logger } from "../logger";

/**
 * Ensure that a directory exists. Creates it recursively if needed.
 */
export async function ensureDir(dirPath: string): Promise<void> {
    try {
        await access(dirPath, constants.F_OK);
        // exists
    } catch {
        // not exists → create recursively
        await mkdir(dirPath, { recursive: true });
    }
}

/**
 * Ensure that a directory exists. Creates it recursively if needed.
 */
export function ensureDirSync(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * Check if a file or directory exists.
 */
export async function pathExists(filePath: string): Promise<boolean> {
    try {
        await access(filePath, constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

/**
 * Read a file with specified encoding (default utf-8)
 */
export async function readFile(filePath: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
    return await fsReadFile(filePath, { encoding });
}

export function readFileSync(filePath: string, encoding: BufferEncoding = 'utf8'): string {
    return fs.readFileSync(filePath, { encoding });
}

/**
 * Write a file, creating parent directories if needed.
 */
export async function writeFile(filePath: string, content: string, encoding: BufferEncoding = 'utf8'): Promise<void> {
    await ensureDir(path.dirname(filePath));
    await fsWriteFile(filePath, content, { encoding });
}

export async function stat(path: string) {
    return await fsStat(path);
}

export function statSync(path: string) {
    return fs.statSync(path);
}

export async function readdir(dir: string) {
    return await fsReaddir(dir);
}

export async function clearDir(path: string) {
    try {
        await rm(path, { recursive: true, force: true });
        await mkdir(path);
    } catch (error) {
        logger.ERROR(`${RED}Error: ${error}${RESET}`);
    }
}