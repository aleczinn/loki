type VideoProfile = 'hdr10' | 'hdr10+' | 'dolby vision' | 'hlg';

export abstract class Browser {

    protected name: string;
    protected version: number;
    protected platform: string;

    protected container: string[] = [];
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
        return this.container.includes(codec.toLowerCase());
    }

    isVideoSupported(codec: string): boolean {
        return this.videoCodecs.includes(codec.toLowerCase());
    }

    isAudioSupported(codec: string): boolean {
        return this.audioCodecs.includes(codec.toLowerCase());
    }

    getName(): string {
        return this.name;
    }

    getVersion(): number {
        return this.version;
    }

    getPlatform(): string{
        return this.platform;
    }

    getContainer(): string[] {
        return this.container;
    }

    getVideoCodecs(): string[] {
        return this.videoCodecs;
    }

    getAudioCodecs(): string[] {
        return this.audioCodecs;
    }

    getProfiles(): VideoProfile[] {
        return this.profiles;
    }

    supportsDolbyVision(): boolean {
        return this.profiles.includes('dolby vision');
    }

    supportsHDR10Plus(): boolean {
        return this.profiles.includes('hdr10+');
    }

    supportsHDR10(): boolean {
        return this.profiles.includes('hdr10');
    }

    supportsHLG(): boolean {
        return this.profiles.includes('hlg');
    }
}