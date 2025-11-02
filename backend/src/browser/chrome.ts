import { Browser } from "./browser";

export class Chrome extends Browser {

    detectCapabilities(): void {
        // Container
        this.container = ['mp4', 'webm', 'mkv'];

        // Video
        if (this.version >= 4) {
            this.videoCodecs.push('h264');
        }
        if (this.version >= 25) {
            this.videoCodecs.push('vp8');
        }
        if (this.version >= 29) {
            this.videoCodecs.push('vp9');
        }
        if (this.version >= 70) {
            this.videoCodecs.push('av1');
        }
        if (this.version >= 107) {
            this.videoCodecs.push('hevc');
        }

        // Audio codecs
        this.audioCodecs.push('aac', 'mp3', 'flac');

        if (this.version >= 4) {
            this.audioCodecs.push('vorbis');
        }
        if (this.version >= 33) {
            this.audioCodecs.push('opus');
        }
    }
}