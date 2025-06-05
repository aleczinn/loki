import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import crypto from 'crypto';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

export interface MediaFile {
    id: string;
    name: string;
    path: string;
    size: number;
    extension: string;
    mimeType: string;
}

export class MediaService {
    private readonly mediaPath: string;
    private readonly supportedFormats = ['.mp4', '.mkv', '.avi', '.mov', '.webm'];

    constructor(mediaPath: string = '/media') {
        this.mediaPath = mediaPath;
    }

    private getMimeType(extension: string): string {
        const mimeTypes: { [key: string]: string } = {
            '.mp4': 'video/mp4',
            '.mkv': 'video/x-matroska',
            '.avi': 'video/x-msvideo',
            '.mov': 'video/quicktime',
            '.webm': 'video/webm'
        };
        return mimeTypes[extension] || 'video/mp4';
    }

    async getMediaFiles(directory: string = ''): Promise<MediaFile[]> {
        try {
            const fullPath = path.join(this.mediaPath, directory);
            const files = await readdir(fullPath);
            const mediaFiles: MediaFile[] = [];

            for (const file of files) {
                const filePath = path.join(fullPath, file);
                const stats = await stat(filePath);

                if (stats.isFile()) {
                    const extension = path.extname(file).toLowerCase();
                    if (this.supportedFormats.includes(extension)) {
                        const relativePath = path.relative(this.mediaPath, filePath);
                        const id = crypto.createHash('md5').update(relativePath).digest('hex');

                        mediaFiles.push({
                            id,
                            name: file,
                            path: relativePath,
                            size: stats.size,
                            extension,
                            mimeType: this.getMimeType(extension)
                        });
                    }
                }
            }

            return mediaFiles;
        } catch (error) {
            console.error('Error reading media files:', error);
            return [];
        }
    }

    getMediaFilePath(relativePath: string): string {
        return path.join(this.mediaPath, relativePath);
    }

    isValidMediaFile(filePath: string): boolean {
        const extension = path.extname(filePath).toLowerCase();
        return this.supportedFormats.includes(extension);
    }
}