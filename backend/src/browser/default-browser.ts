import { Browser } from "./browser";

export class DefaultBrowser extends Browser {

    detectCapabilities(): void {
        this.videoCodecs = [];
        this.audioCodecs = [];
        this.containers = ['mp4', 'webm'];
    }
}