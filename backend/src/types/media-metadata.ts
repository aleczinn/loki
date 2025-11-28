import { GeneralTrack } from "./general-track";
import { VideoTrack } from "./mediainfo/video-track";
import { AudioTrack } from "./mediainfo/audio-track";
import { SubtitleTrack } from "./mediainfo/subtitle-track";

export interface MediaMetadata {
    general: GeneralTrack;
    video: VideoTrack[];
    audio: AudioTrack[];
    subtitle: SubtitleTrack[];
}