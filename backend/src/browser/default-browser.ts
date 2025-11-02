import { Browser } from "./browser";

export class DefaultBrowser extends Browser {

    detectCapabilities(): void {
        this.container = ['mp4', 'webm'];
        this.videoCodecs = ['h264'];
        this.audioCodecs = ['aac'];
    }
}