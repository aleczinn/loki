import { MediaAudioCodec, MediaContainer, MediaVideoCodec, MediaVideoProfile } from "../browser/browser";

export interface ClientCapabilities {
    maxResolutionWidth: number;
    maxResolutionHeight: number;
    containers: MediaContainer[];
    videoCodecs: MediaVideoCodec[];
    audioCodecs: MediaAudioCodec[];
    hdrFormats: MediaVideoProfile[];
}