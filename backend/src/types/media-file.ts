import { MediaMetadata } from "./media-metadata";

export interface MediaFile {
    id: string;
    name: string;
    path: string;
    size: number;
    extension: string;
    metadata: MediaMetadata | null;
    modified: Date;
}