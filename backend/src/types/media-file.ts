import { Mediainfo } from "./mediainfo/mediainfo";

export interface MediaFile {
    id: string;
    name: string;
    path: string;
    size: number;
    extension: string;
    metadata: Mediainfo;
    modified: Date;
}