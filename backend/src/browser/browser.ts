type VideoProfile = 'hdr10' | 'hdr10+' | 'dolby vision' | 'hlg';

export abstract class Browser {

    protected name: string;
    protected version: number;
    protected platform: string;

    protected videoCodecs: string[] = [];
    protected audioCodecs: string[] = [];
    protected containers: string[] = [];

    protected profiles: VideoProfile[] = [];

    constructor(name: string, version: number, platform: string) {
        this.name = name;
        this.version = version;
        this.platform = platform;

        this.detectCapabilities();
    }

    abstract detectCapabilities(): void;

    supportsVideo(codec: string): boolean {
        return this.videoCodecs.includes(codec.toLowerCase());
    }

    supportsAudio(codec: string): boolean {
        return this.audioCodecs.includes(codec.toLowerCase());
    }
}