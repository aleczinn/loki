import { MediaMetadata } from "./media-metadata";
import { MediaFile } from "./media-file";

export interface StreamSegment {
    path: string;
    ready: boolean;
    generating?: boolean;
    startTime: number;
    duration: number;
}

export interface StreamSession {
    id: string;
    file: MediaFile
    totalSegments: number;
    segments: Map<number, StreamSegment>;
    transcodeDir: string;
    lastAccessed: number;
    segmentPromises: Map<number, Promise<string>>;
    cleanup: () => Promise<void>;
}