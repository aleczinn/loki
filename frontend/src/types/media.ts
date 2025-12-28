import type { Mediainfo } from "./mediainfo/mediainfo.ts";

export interface MediaFile {
    id: string;
    name: string;
    path: string;
    size: number;
    extension: string;
    metadata: Mediainfo;
    modified: Date;
}