export interface MediaFile {
    name: string;
    path: string;
    size: number;
    modified: Date;
}

export interface StreamSegment {
    path: string;
    duration: number;
    ready: boolean;
}

export interface SessionInfo {
    id: string;
    filePath: string;
    transcodeDir: string;
    playlistPath: string;
    duration: number | null;
    currentPosition: number;
    bufferSize: number;
    segmentDuration: number;
    lastAccessed: number;
    metadata: any;
    isActive: boolean;
    totalSegments: number;
}