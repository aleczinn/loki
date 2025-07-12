import * as path from 'path';
import * as fs from 'fs-extra';
import * as crypto from 'crypto';
import { MediaFile } from "../types/media-file";
import { getCombinedMetadata } from "./media-utils";
import { GeneralTrack } from "../types/general-track";
import { VideoTrack } from "../types/video-track";
import { AudioTrack } from "mediainfo.js";
import { SubtitleTrack } from "../types/subtitle-track";

const SUPPORTED_FORMATS = ['.mp4', '.mkv', '.avi', '.mov', '.webm'];

export function getCurrentDateTime(): string {
    const now = new Date();

    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');  // Monat von 0 bis 11, also +1
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function formatDuration(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '00:00:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatBitrate(bitrate: number): string {
    if (!bitrate || isNaN(bitrate)) return 'Unknown';

    const kbps = Math.round(bitrate / 1000);
    if (kbps >= 1000) {
        return `${(kbps / 1000).toFixed(1)} Mbps`;
    }
    return `${kbps} kbps`;
}

export function formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(size < 10 ? 1 : 0)} ${units[unitIndex]}`;
}

export async function scanMediaDirectory(dir: string): Promise<MediaFile[]> {
    const files: MediaFile[] = [];

    async function scanRecursive(currentDir: string, relativePath: string = ''): Promise<void> {
        const items = await fs.readdir(currentDir);

        for (const item of items) {
            const fullPath = path.join(currentDir, item);
            const itemRelativePath = path.join(relativePath, item);
            const stats = await fs.stat(fullPath);

            if (stats.isDirectory()) {
                await scanRecursive(fullPath, itemRelativePath);
            } else if (stats.isFile()) {
                const ext = path.extname(item).toLowerCase();
                if (SUPPORTED_FORMATS.includes(ext)) {
                    const metaData = await getCombinedMetadata(fullPath)

                    files.push({
                        id: getHashFromPath(fullPath),
                        name: item,
                        path: fullPath,
                        size: stats.size,
                        extension: path.extname(fullPath).toLowerCase(),
                        metadata: metaData,
                        modified: stats.mtime
                    });
                }
            }
        }
    }

    await scanRecursive(dir);
    return files;
}

export function getHashFromPath(filePath: string): string {
    return crypto.createHash('md5').update(filePath).digest('hex');
}