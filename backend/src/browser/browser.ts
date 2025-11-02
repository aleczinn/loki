export type MediaContainer = 'mp4' | 'webm' | 'mkv' | 'avi' | 'm4v' | 'mov';
export type MediaVideoProfile = 'hdr10' | 'hdr10+' | 'dolby vision' | 'hlg';
export type MediaVideoCodec = 'h264' | 'hevc' | 'mpeg2' | 'vc1' | 'vp8' | 'vp9' | 'av1';
export type MediaAudioCodec = 'opus' | 'flac' | 'pcm' | 'ogg' | 'vorbis' | 'aac' | 'ac3' | 'eac3' | 'mp3' | 'wav' | 'dts' | 'truehd';

export abstract class Browser {

    protected name: string;
    protected version: number;
    protected platform: string;

    protected container: MediaContainer[] = [];
    protected videoCodecs: MediaVideoCodec[] = [];
    protected audioCodecs: MediaAudioCodec[] = [];

    protected profiles: MediaVideoProfile[] = [];

    constructor(name: string, version: number, platform: string) {
        this.name = name;
        this.version = version;
        this.platform = platform;

        this.detectCapabilities();
    }

    protected abstract detectCapabilities(): void;

    isContainerSupported(codec: MediaContainer): boolean {
        return this.container.includes(codec);
    }

    isVideoSupported(codec: MediaVideoCodec): boolean {
        return this.videoCodecs.includes(codec);
    }

    isAudioSupported(codec: MediaAudioCodec): boolean {
        return this.audioCodecs.includes(codec);
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

    getContainer(): MediaContainer[] {
        return this.container;
    }

    getVideoCodecs(): MediaVideoCodec[] {
        return this.videoCodecs;
    }

    getAudioCodecs(): MediaAudioCodec[] {
        return this.audioCodecs;
    }

    getProfiles(): MediaVideoProfile[] {
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