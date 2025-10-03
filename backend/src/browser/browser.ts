type VideoProfile = 'hdr10' | 'hdr10+' | 'dolby vision' | 'hlg';

export abstract class Browser {

    protected name: string;
    protected version: number;
    protected platform: string;

    protected containers: string[] = [];
    protected videoCodecs: string[] = [];
    protected audioCodecs: string[] = [];

    protected profiles: VideoProfile[] = [];

    constructor(name: string, version: number, platform: string) {
        this.name = name;
        this.version = version;
        this.platform = platform;

        this.detectCapabilities();
    }

    protected abstract detectCapabilities(): void;

    isContainerSupported(codec: string): boolean {
        return this.containers.includes(codec.toLowerCase());
    }

    isVideoSupported(codec: string): boolean {
        return this.videoCodecs.includes(codec.toLowerCase());
    }

    isAudioSupported(codec: string): boolean {
        return this.audioCodecs.includes(codec.toLowerCase());
    }
}