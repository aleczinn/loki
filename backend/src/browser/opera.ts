import { Browser } from './browser';

export class Opera extends Browser {

    detectCapabilities(): void {
        // Container
        this.container = ['mp4', 'webm', 'mkv'];

        // Video
        if (this.version >= 10) {
            this.videoCodecs.push('vp9');
        }
        if (this.version >= 16) {
            this.videoCodecs.push('vp8');
        }
        if (this.version >= 25) {
            this.videoCodecs.push('h264');
        }
        if (this.version >= 57) {
            this.videoCodecs.push('av1');
        }

        // Audio codecs
        this.audioCodecs.push('aac', 'mp3');

        if (this.version >= 11) {
            this.audioCodecs.push('vorbis');
        }
        if (this.version >= 20) {
            this.audioCodecs.push('opus');
        }
    }
}