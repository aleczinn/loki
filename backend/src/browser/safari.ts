import { Browser } from "./browser";

export class Safari extends Browser {

    detectCapabilities(): void {
        // Container
        this.container = ['mp4', 'webm', 'mkv'];

        // Video
        this.videoCodecs.push('mpeg-1', 'mpeg-2');

        if (this.version >= 3) {
            this.videoCodecs.push('avc', 'h264');
        }
        if (this.version >= 11) {
            this.videoCodecs.push('hevc', 'h265');
        }

        // Audio codecs
        if (this.version >= 3) {
            this.audioCodecs.push('aac', 'mp3');
        }
        if (this.version >= 11) {
            this.audioCodecs.push('flac');
        }
    }
}