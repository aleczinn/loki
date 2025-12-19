import { GeneralTrack } from "./general-track";
import { VideoTrack } from "./video-track";
import { AudioTrack } from "./audio-track";
import { SubtitleTrack } from "./subtitle-track";

export interface Mediainfo {
    general: GeneralTrack;
    video: VideoTrack[];
    audio: AudioTrack[];
    subtitle: SubtitleTrack[];
}