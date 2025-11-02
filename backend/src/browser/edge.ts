import { Browser } from "./browser";

export class Edge extends Browser {

    detectCapabilities(): void {
        // Container
        this.container = ['mp4', 'webm', 'mkv'];

        // Video
        if (this.version >= 12) {
            this.videoCodecs.push('h264');
        }
        if (this.version >= 14) {
            this.videoCodecs.push('vp8', 'vp9');
        }
        if (this.version >= 18) {
            this.videoCodecs.push('hevc');
        }
        if (this.version >= 75) {
            this.videoCodecs.push('av1');
        }

        // Audio codecs
        this.audioCodecs.push('aac', 'mp3', 'flac');

        if (this.version >= 14) {
            this.audioCodecs.push('opus');
        }
        if (this.version >= 17) {
            this.audioCodecs.push('vorbis');
        }
    }
}