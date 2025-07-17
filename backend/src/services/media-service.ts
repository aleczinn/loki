import * as path from 'path';
import * as fs from 'fs-extra';
import * as crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import { TRANSCODE_PATH } from "../app";
import { getCombinedMetadata } from "../utils/media-utils";
import { MediaFile } from "../types/media-file";

const SEGMENT_DURATION = 10; // seconds per segment
const BUFFER_SEGMENTS = 3; // x times segment_duration for extra buffer

interface StreamingSession {
    id: string;
    lastAccessed: number;
}

class MediaService {
    private sessions: Map<string, StreamingSession> = new Map();

    async startSession(file: MediaFile): Promise<StreamingSession> {
        const sessionId = file.id;

        const existingSession = this.sessions.get(sessionId);
        if (existingSession) {
            existingSession.lastAccessed = Date.now();
            return existingSession;
        }

        const session = await this.createSession(file);
        this.sessions.set(file.id, session);
        return session;
    }

    private async createSession(file: MediaFile): Promise<StreamingSession> {
        const sessionId = file.id;

        const transcodingDir = path.join(TRANSCODE_PATH, file.id);
        await fs.ensureDir(transcodingDir);

        return {
            id: sessionId,
            lastAccessed: Date.now()
        }
    }

    async generatePlaylist(session: StreamingSession, time: number): Promise<string> {
        return '';
    }

    getSession(sessionId: string): StreamingSession | null {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastAccessed = Date.now();
            return session;
        }
        return null;
    }

    /**
     * Shutdown media service
     */
    async shutdown(): Promise<void> {
        console.log('Shutting down MediaService...');
        console.log('MediaService shutdown complete');
    }
}

const mediaService = new MediaService();

export default mediaService;
export { MediaService, StreamingSession };