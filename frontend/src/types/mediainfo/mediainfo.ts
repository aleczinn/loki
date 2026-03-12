import type { GeneralTrack } from "./general-track";
import type { VideoTrack } from "./video-track";
import type { AudioTrack } from "./audio-track";
import type { SubtitleTrack } from "./subtitle-track";

export interface Mediainfo {
    general: GeneralTrack;
    video: VideoTrack[];
    audio: AudioTrack[];
    subtitle: SubtitleTrack[];
}