import * as path from 'path';
import * as fs from 'fs-extra';
import * as crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import { TRANSCODE_PATH } from "../app";
import { StreamSession } from "../types/types";
import { getCombinedMetadata } from "../utils/media-utils";

const sessions = new Map();
const SEGMENT_DURATION = 10; // Sekunden pro Segment
const BUFFER_SEGMENTS = 3; // 30 Sekunden Puffer (3 * 10s)
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 Minuten

class MediaService {
    private sessions: Map<string, StreamSession> = new Map();

    /**
     * Startet eine neue Streaming-Session
     */
    // async startSession(filePath: string): Promise<StreamSession> {
    //     // const absolutePath = this.getAbsoluteMediaPath(filePath);
    //     //
    //     // // Prüfen ob Datei existiert
    //     // if (!await fs.pathExists(absolutePath)) {
    //     //     throw new Error('File not found');
    //     // }
    //     //
    //     // // Session-ID generieren
    //     // const sessionId = this.generateSessionId(absolutePath);
    //     //
    //     // // Existierende Session zurückgeben falls vorhanden
    //     // if (this.sessions.has(sessionId)) {
    //     //     const existingSession = this.sessions.get(sessionId)!;
    //     //     existingSession.lastAccessed = Date.now();
    //     //     return existingSession;
    //     // }
    //     //
    //     // // Neue Session erstellen
    //     // const session = await this.createSession(absolutePath, sessionId);
    //     // this.sessions.set(sessionId, session);
    //     //
    //     // // Erste Segmente vorbereiten
    //     // await this.ensureSegmentsAvailable(sessionId, 0);
    //     //
    //     // return session;
    //     return new StreamSession({
    //         id: 0,
    //         duration: 0,
    //         filePath: filePath,
    //         metadata: getCombinedMetadata(filePath),
    //     });
    // }

    /**
     * Get session by id
     */
    getSession(sessionId: string): StreamSession | null {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastAccessed = Date.now();
            return session;
        }
        return null;
    }

    /**
     * Stop session
     */
    async stopSession(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (session) {
            await session.cleanup();
            this.sessions.delete(sessionId);
        }
    }

    /**
     * Segmente für bestimmte Zeit sicherstellen
     */
    async ensureSegmentsAvailable(sessionId: string, startTime: number): Promise<void> {
        // const session = this.getSession(sessionId);
        // if (!session) {
        //     throw new Error('Session not found');
        // }
        //
        // const startSegment = Math.floor(startTime / this.config.segmentDuration);
        // const endSegment = Math.min(
        //     startSegment + this.config.bufferSegments,
        //     session.totalSegments - 1
        // );
        //
        // const promises: Promise<string>[] = [];
        //
        // for (let i = startSegment; i <= endSegment; i++) {
        //     if (!session.segments.has(i) || !session.segments.get(i)?.ready) {
        //         promises.push(this.requestSegment(sessionId, i));
        //     }
        // }
        //
        // await Promise.all(promises);
    }

    /**
     * Einzelnes Segment anfordern
     */
    async requestSegment(sessionId: string, segmentIndex: number): Promise<string> {
        // const session = this.getSession(sessionId);
        // if (!session) {
        //     throw new Error('Session not found');
        // }
        //
        // if (segmentIndex >= session.totalSegments) {
        //     throw new Error('Segment index out of bounds');
        // }
        //
        // // Bereits vorhandenes Promise verwenden
        // if (session.segmentPromises.has(segmentIndex)) {
        //     return session.segmentPromises.get(segmentIndex)!;
        // }
        //
        // // Neues Segment generieren
        // const segmentPromise = this.generateSegment(session, segmentIndex);
        // session.segmentPromises.set(segmentIndex, segmentPromise);
        //
        // try {
        //     const result = await segmentPromise;
        //     session.segmentPromises.delete(segmentIndex);
        //     return result;
        // } catch (error) {
        //     session.segmentPromises.delete(segmentIndex);
        //     throw error;
        // }
        return ''
    }

    /**
     * M3U8 Playlist generieren
     */
    async generatePlaylist(sessionId: string, requestedTime: number = 0): Promise<string> {
        // const session = this.getSession(sessionId);
        // if (!session) {
        //     throw new Error('Session not found');
        // }
        //
        // const playlistSegments: Array<{
        //     index: number;
        //     duration: number;
        //     url: string;
        // }> = [];
        //
        // // Verfügbare Segmente sammeln
        // for (let i = 0; i < session.totalSegments; i++) {
        //     const segment = session.segments.get(i);
        //     if (segment && segment.ready) {
        //         playlistSegments.push({
        //             index: i,
        //             duration: Math.min(
        //                 this.config.segmentDuration,
        //                 session.duration - (i * this.config.segmentDuration)
        //             ),
        //             url: `segment_${i}.ts`
        //         });
        //     }
        // }
        //
        // // M3U8 Playlist erstellen
        // let playlist = '#EXTM3U\n';
        // playlist += '#EXT-X-VERSION:3\n';
        // playlist += `#EXT-X-TARGETDURATION:${this.config.segmentDuration}\n`;
        // playlist += '#EXT-X-MEDIA-SEQUENCE:0\n';
        // playlist += '#EXT-X-PLAYLIST-TYPE:VOD\n';
        //
        // for (const segment of playlistSegments) {
        //     playlist += `#EXTINF:${segment.duration.toFixed(3)},\n`;
        //     playlist += `${segment.url}\n`;
        // }
        //
        // playlist += '#EXT-X-ENDLIST\n';
        // return playlist;
        return ''
    }

    /**
     * Segment-Datei abrufen
     */
    getSegmentPath(sessionId: string, segmentIndex: number): string | null {
        // const session = this.getSession(sessionId);
        // if (!session) {
        //     return null;
        // }
        //
        // const segment = session.segments.get(segmentIndex);
        // if (segment && segment.ready) {
        //     return segment.path;
        // }

        return null;
    }

    /**
     * Alle aktiven Sessions abrufen
     */
    getActiveSessions(): Array<{
        id: string;
        filePath: string;
        duration: number;
        lastAccessed: number;
    }> {
        // return Array.from(this.sessions.entries()).map(([id, session]) => ({
        //     id,
        //     filePath: session.filePath,
        //     duration: session.duration,
        //     lastAccessed: session.lastAccessed
        // }));
        return []
    }

    async shutdown(): Promise<void> {
        console.log('Shutting down MediaService...');

        // Alle Sessions beenden
        const shutdownPromises = Array.from(this.sessions.values()).map(session =>
            session.cleanup()
        );

        await Promise.all(shutdownPromises);
        this.sessions.clear();

        console.log('MediaService shutdown complete');
    }
}

const mediaService = new MediaService();

export default mediaService;
export { MediaService, StreamSession };