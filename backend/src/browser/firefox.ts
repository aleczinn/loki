import { Browser } from './browser';

export class Firefox extends Browser {

    detectCapabilities(): void {
        // Container
        this.containers = ['mp4', 'webm', 'mkv'];

        // Video
        if (this.version >= 3) {
            this.videoCodecs.push('theora', 'ogg');
        }
        if (this.version >= 4) {
            this.videoCodecs.push('vp8');
        }
        if (this.version >= 28) {
            this.videoCodecs.push('vp9');
        }
        if (this.version >= 35) {
            this.videoCodecs.push('avc', 'h264');
        }
        if (this.version >= 67) {
            this.videoCodecs.push('av1');
        }

        // Audio codecs
        this.audioCodecs.push('aac', 'mp3');

        if (this.version >= 3) {
            this.audioCodecs.push('vorbis');
        }
        if (this.version >= 15) {
            this.audioCodecs.push('opus');
        }
        if (this.version >= 51) {
            this.audioCodecs.push('flac');
        }
    }
}