import { GeneralTrack } from "./general-track";
import { VideoTrack } from "./video-track";
import { AudioTrack } from "./audio-track";
import { SubtitleTrack } from "./subtitle-track";

export interface MediaMetadata {
    general: GeneralTrack;
    video: VideoTrack[];
    audio: AudioTrack[];
    subtitle: SubtitleTrack[];
}