import type {
    AudioCodecCapability,
    Client,
    ClientCapabilities,
    DisplayCapability,
    MediaContainer,
    SubtitleCapability,
    VideoCodecCapability,
    VideoProfile
} from "../types/client-capabilities.ts";

export class CapabilityDetector {

    getMinimalCapabilities(): ClientCapabilities {
        return {
            client: this.detectClient()
        }
    }

    async detectCapabilities(): Promise<ClientCapabilities> {
        const client = this.detectClient();
        const containers = this.detectContainers();
        const audioCodecs = this.detectAudioCodecs();
        const subtitles = this.detectSubtitles();
        const supportsAdaptiveStreaming = 'MediaSource' in window;

        // Call in parallel for better performance
        const [display, videoCodecs] = await Promise.all([
            this.detectDisplay(),
            this.detectVideoCodecs()
        ]);

        return {
            client,
            display,
            containers,
            videoCodecs,
            audioCodecs,
            subtitles,
            supportsAdaptiveStreaming
        };
    }

    private detectClient(): Client {
        const ua = navigator.userAgent.toLowerCase();

        return {
            userAgent: ua,
            platform: this.getPlatform(ua),
            deviceModel: this.getDeviceModel(ua),
            osVersion: this.getOSVersion(ua),
            appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
        }
    }

    private getPlatform(ua: string): string {
        if (ua.includes('windows')) return 'windows';
        if (ua.includes('mac')) return 'mac os';
        if (ua.includes('linux')) return 'linux';
        if (ua.includes('android')) return 'android';
        if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return 'ios';
        return 'unknown';
    }

    private getDeviceModel(ua: string): Client['deviceModel'] {
        if (ua.includes('edg/')) {
            return {
                name: 'edge',
                version: this.getVersion(ua, 'edg/')
            }
        } else if (ua.includes('chrome/') && !ua.includes('edg/')) {
            return {
                name: 'chrome',
                version: this.getVersion(ua, 'chrome/')
            }
        } else if (ua.includes('firefox/')) {
            return {
                name: 'firefox',
                version: this.getVersion(ua, 'firefox/')
            }
        } else if (ua.includes('safari/') && !ua.includes('chrome')) {
            return {
                name: 'safari',
                version: this.getVersion(ua, 'version/')
            }
        } else if (ua.includes('opr/') || ua.includes('opera/')) {
            return {
                name: 'opera',
                version: this.getVersion(ua, ua.includes('opr/') ? 'opr/' : 'opera/')
            }
        }
        return {
            name: 'unknown'
        };
    }

    private getVersion(ua: string, pattern: string): string {
        const match = ua.match(new RegExp(pattern + '(\\d+)'));
        return match ? match[1] : 'unknown';
    }

    private getOSVersion(ua: string): string {
        if (ua.includes('windows nt 10.0')) return 'Windows 10/11';
        if (ua.includes('windows nt 6.3')) return 'Windows 8.1';
        if (ua.includes('mac os x')) {
            const match = ua.match(/Mac OS X (\d+[._]\d+)/);
            return match ? `macOS ${match[1].replace('_', '.')}` : 'macOS';
        }
        if (ua.includes('Linux')) return 'Linux';

        return 'Unknown OS';
    }

    private async detectDisplay(): Promise<DisplayCapability> {
        return {
            width: screen.width,
            height: screen.height,
            pixelRatio: window.devicePixelRatio || 1.0,
            refreshRate: await this.detectRefreshRate(),
            hdr: {
                capable: false,
                formats: [],
                colorDepth: this.convertColorDepth(screen.colorDepth) || 8
            },
            colorSpaces: this.detectColorSpaces()
        }
    }

    private async detectRefreshRate(): Promise<number> {
        let refreshRate = 60;

        // Versuche mit requestAnimationFrame zu messen
        try {
            const start = performance.now();
            let frames = 0;

            await new Promise<void>(resolve => {
                const measure = () => {
                    frames++;
                    if (performance.now() - start < 1000) {
                        requestAnimationFrame(measure);
                    } else {
                        refreshRate = Math.round(frames);
                        resolve();
                    }
                };
                requestAnimationFrame(measure);
            });
        } catch (error) {
            console.warn('Could not detect refresh rate, using 60Hz');
        }

        return refreshRate;
    }

    /**
     * Konvertiere Total Color Depth zu Bits pro Kanal
     *
     * @param totalBits - Total bits für RGB (24, 30, 36, 48)
     * @returns Bits pro Kanal (8, 10, 12, 16)
     */
    private convertColorDepth(totalBits: number): number {
        // Standard RGB hat 3 Kanäle (Red, Green, Blue)
        const channels = 3;

        // Bekannte Werte
        switch (totalBits) {
            case 24: return 8;   // 8-bit pro Kanal (Standard SDR)
            case 30: return 10;  // 10-bit pro Kanal (HDR10)
            case 36: return 12;  // 12-bit pro Kanal (Dolby Vision)
            case 48: return 16;  // 16-bit pro Kanal (Professional)
            default:
                // Fallback: Division durch 3
                return Math.floor(totalBits / channels);
        }
    }

    private detectColorSpaces(): ('srgb' | 'p3' | 'rec709' | 'rec2020')[] {
        const colorSpaces: ('srgb' | 'p3' | 'rec709' | 'rec2020')[] = ['srgb', 'rec709'];

        // P3 Wide Gamut
        if (window.matchMedia && window.matchMedia('(color-gamut: p3)').matches) {
            colorSpaces.push('p3');
        }

        // Rec.2020 (sehr selten)
        if (window.matchMedia && window.matchMedia('(color-gamut: rec2020)').matches) {
            colorSpaces.push('rec2020');
        }

        return colorSpaces;
    }

    /**
     * Detektiere unterstützte Container
     *
     * WICHTIG: Kein Browser unterstützt nativ MKV!
     * - MP4: Alle Browser
     * - WebM: Alle modernen Browser
     * - MOV: Safari (ist quasi MP4)
     * - MKV/AVI: NICHT nativ, nur mit MSE + Demuxer (machen wir nicht)
     */
    private detectContainers(): MediaContainer[] {
        const video = document.createElement('video');
        const containers: MediaContainer[] = [];

        // MP4
        if (video.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '') {
            containers.push('mp4', 'm4v'); // m4v ist quasi mp4
        }

        // WebM
        if (video.canPlayType('video/webm; codecs="vp8"') !== '') {
            containers.push('webm');
        }

        // MOV
        if (video.canPlayType('video/quicktime') !== '') {
            containers.push('mov');
        }

        // MKV - browser does not support it directly but with MSE you can technically do it
        return containers;
    }

    private async detectVideoCodecs(): Promise<VideoCodecCapability[]> {
        // Call in parallel for better performance
        const [h264, hevc, vp9, av1, vp8] = await Promise.all([
            this.detectH264(),
            this.testHEVC(),
            this.testVP9(),
            this.testAV1(),
            this.testVP8()
        ]);

        return [h264, hevc, vp9, av1, vp8].filter(codec => codec.profiles.length > 0);
    }

    private async detectH264(): Promise<VideoCodecCapability> {
        const profiles: VideoProfile[] = [];
        const bitDepths: number[] = [8];

        // Baseline Profile
        if (await this.testVideoCodec('video/mp4; codecs="avc1.42E01E"')) {
            const maxLevel = await this.testH264Levels('baseline');
            profiles.push({
                name: 'baseline',
                maxLevel,
                bitDepth: 8,
            });
        }

        // Main Profile
        if (await this.testVideoCodec('video/mp4; codecs="avc1.4D401E"')) {
            const maxLevel = await this.testH264Levels('main');
            profiles.push({
                name: 'main',
                maxLevel,
                bitDepth: 8,
            });
        }

        // High Profile
        if (await this.testVideoCodec('video/mp4; codecs="avc1.64001E"')) {
            const maxLevel = await this.testH264Levels('high');
            profiles.push({
                name: 'high',
                maxLevel,
                bitDepth: 8,
            });
        }

        // High10 Profile (10-bit, sehr selten)
        if (await this.testVideoCodec('video/mp4; codecs="avc1.6E0033"')) {
            profiles.push({
                name: 'high10',
                maxLevel: '5.1',
                bitDepth: 10,
            });
            bitDepths.push(10);
        }

        if (profiles.length === 0) {
            return {
                codec: 'h264',
                profiles: [],
                maxWidth: -1,
                maxHeight: -1,
                bitDepths: []
            }
        }

        // Max Resolution basierend auf höchstem Level
        const highestLevel = Math.max(...profiles.map(p => parseFloat(p.maxLevel)));
        const resolution = this.getResolutionForLevel(highestLevel);

        return {
            codec: 'h264',
            profiles,
            maxWidth: resolution.width,
            maxHeight: resolution.height,
            bitDepths,
        };
    }

    private async testH264Levels(profile: string): Promise<string> {
        const levelTests = [
            { level: '3.0', hex: '1E' },
            { level: '3.1', hex: '1F' },
            { level: '4.0', hex: '28' },
            { level: '4.1', hex: '29' },
            { level: '4.2', hex: '2A' },
            { level: '5.0', hex: '32' },
            { level: '5.1', hex: '33' },
            { level: '5.2', hex: '34' },
        ];

        let maxLevel = '3.0';

        for (const test of levelTests) {
            const codec = this.getH264Codec(profile, test.hex);
            const supported = await this.testVideoCodec(`video/mp4; codecs="${codec}"`);

            if (supported) {
                maxLevel = test.level;
            } else {
                break; // Höhere Levels werden auch nicht gehen
            }
        }

        return maxLevel;
    }

    private getH264Codec(profile: string, levelHex: string): string {
        const profileCodes: Record<string, string> = {
            'baseline': '42E0',
            'main': '4D40',
            'high': '6400',
            'high10': '6E00',
        };
        return `avc1.${profileCodes[profile]}${levelHex}`;
    }

    private async testHEVC(): Promise<VideoCodecCapability> {
        const profiles: VideoProfile[] = [];
        const bitDepths: number[] = [];

        // Main Profile (8-bit)
        if (await this.testVideoCodec('video/mp4; codecs="hev1.1.6.L93.B0"')) {
            profiles.push({
                name: 'main',
                maxLevel: '5.1',
                bitDepth: 8,
            });
            bitDepths.push(8);
        }

        // Main10 Profile (10-bit, HDR-fähig)
        if (await this.testVideoCodec('video/mp4; codecs="hev1.2.4.L93.B0"')) {
            profiles.push({
                name: 'main10',
                maxLevel: '5.1',
                bitDepth: 10,
            });
            if (!bitDepths.includes(10)) bitDepths.push(10);
        }

        if (profiles.length === 0) {
            return {
                codec: 'hevc',
                profiles: [],
                maxWidth: -1,
                maxHeight: -1,
                bitDepths: []
            }
        }

        return {
            codec: 'hevc',
            profiles,
            maxWidth: 3840,
            maxHeight: 2160,
            bitDepths,
        };
    }

    private async testVP9(): Promise<VideoCodecCapability> {
        const profiles: VideoProfile[] = [];
        const bitDepths: number[] = [];

        // Profile 0 (8-bit)
        if (await this.testVideoCodec('video/webm; codecs="vp09.00.10.08"') ||
            await this.testVideoCodec('video/webm; codecs="vp9"')) {
            profiles.push({
                name: 'profile0',
                maxLevel: '5.1',
                bitDepth: 8,
            });
            bitDepths.push(8);
        }

        // Profile 2 (10-bit, HDR-fähig)
        if (await this.testVideoCodec('video/webm; codecs="vp09.02.10.10"')) {
            profiles.push({
                name: 'profile2',
                maxLevel: '5.1',
                bitDepth: 10,
            });
            if (!bitDepths.includes(10)) bitDepths.push(10);
        }

        if (profiles.length === 0) {
            return {
                codec: 'vp9',
                profiles: [],
                maxWidth: -1,
                maxHeight: -1,
                bitDepths: []
            }
        }

        return {
            codec: 'vp9',
            profiles,
            maxWidth: 3840,
            maxHeight: 2160,
            bitDepths,
        };
    }

    private async testAV1(): Promise<VideoCodecCapability> {
        const profiles: VideoProfile[] = [];
        const bitDepths: number[] = [];

        // Main Profile (8-bit)
        if (await this.testVideoCodec('video/mp4; codecs="av01.0.05M.08"')) {
            profiles.push({
                name: 'main',
                maxLevel: '5.1',
                bitDepth: 8,
            });
            bitDepths.push(8);
        }

        // High Profile (10-bit, HDR-fähig)
        if (await this.testVideoCodec('video/mp4; codecs="av01.0.05M.10"')) {
            profiles.push({
                name: 'high',
                maxLevel: '5.1',
                bitDepth: 10,
            });
            if (!bitDepths.includes(10)) bitDepths.push(10);
        }

        if (profiles.length === 0) {
            return {
                codec: 'av1',
                profiles: [],
                maxWidth: -1,
                maxHeight: -1,
                bitDepths: []
            }
        }

        return {
            codec: 'av1',
            profiles,
            maxWidth: 3840,
            maxHeight: 2160,
            bitDepths,
        };
    }

    private async testVP8(): Promise<VideoCodecCapability> {
        if (!await this.testVideoCodec('video/webm; codecs="vp8"')) {
            return {
                codec: 'vp8',
                profiles: [],
                maxWidth: -1,
                maxHeight: -1,
                bitDepths: []
            }
        }

        return {
            codec: 'vp8',
            profiles: [
                {
                    name: 'main',
                    maxLevel: '3.0',
                    bitDepth: 8,
                },
            ],
            maxWidth: 1920,
            maxHeight: 1080,
            bitDepths: [8],
        };
    }

    private async testVideoCodec(mimeType: string): Promise<boolean> {
        const video = document.createElement('video');
        const result = video.canPlayType(mimeType);
        return result === 'probably' || result === 'maybe';
    }

    private getResolutionForLevel(level: number): { width: number; height: number } {
        if (level >= 6.0) return { width: 7680, height: 4320 }; // 8K
        if (level >= 5.0) return { width: 3840, height: 2160 }; // 4K
        if (level >= 4.0) return { width: 1920, height: 1080 }; // 1080p
        if (level >= 3.0) return { width: 1280, height: 720 };  // 720p
        return { width: 720, height: 576 }; // SD
    }

    private detectAudioCodecs(): AudioCodecCapability[] {
        const codecs: AudioCodecCapability[] = [];
        const audio = document.createElement('audio');

        // AAC (Standard in MP4)
        if (audio.canPlayType('audio/mp4; codecs="mp4a.40.2"') !== '') {
            codecs.push({
                codec: 'aac',
                extensions: [],
                maxChannels: 2,
                sampleRates: [44100, 48000],
                passthrough: false
            });
        }

        // AC3 (Dolby Digital) - selten im Browser
        if (audio.canPlayType('audio/mp4; codecs="ac-3"') !== '') {
            codecs.push({
                codec: 'ac3',
                extensions: [],
                maxChannels: 2,
                sampleRates: [48000],
                passthrough: false
            });
        }

        // EAC3 (Dolby Digital Plus) - sehr selten im Browser
        if (audio.canPlayType('audio/mp4; codecs="ec-3"') !== '') {
            codecs.push({
                codec: 'eac3',
                extensions: [],
                maxChannels: 2,
                sampleRates: [48000],
                passthrough: false
            });
        }

        // Opus (moderne Browser)
        if (audio.canPlayType('audio/webm; codecs="opus"') !== '' ||
            audio.canPlayType('audio/ogg; codecs="opus"') !== '') {
            codecs.push({
                codec: 'opus',
                extensions: [],
                maxChannels: 2,
                sampleRates: [48000],
                passthrough: false
            });
        }

        // Vorbis
        if (audio.canPlayType('audio/ogg; codecs="vorbis"') !== '') {
            codecs.push({
                codec: 'vorbis',
                extensions: [],
                maxChannels: 2,
                sampleRates: [44100, 48000],
                passthrough: false
            });
        }

        // FLAC
        if (audio.canPlayType('audio/flac') !== '') {
            codecs.push({
                codec: 'flac',
                extensions: [],
                maxChannels: 2,
                sampleRates: [44100, 48000, 96000, 192000],
                passthrough: false
            });
        }

        // MP3
        if (audio.canPlayType('audio/mpeg') !== '') {
            codecs.push({
                codec: 'mp3',
                extensions: [],
                maxChannels: 2,
                sampleRates: [44100, 48000],
                passthrough: false
            });
        }

        return codecs;
    }

    /**
     * Detektiere Untertitel-Unterstützung
     *
     * Browser können:
     * - SRT/VTT: Nativ als WebVTT
     *
     * Browser können NICHT:
     * - PGS/VobSub: Bitmap-basiert → müssen eingebrannt werden
     * - ASS/SSA: Komplex formatiert → müssen eingebrannt oder zu WebVTT konvertiert
     */
    private detectSubtitles(): SubtitleCapability {
        return {
            nativeFormats: ['srt', 'vtt'], // Browser können nur Text-basierte Subs
            requiresBurnIn: ['pgs', 'vobsub', 'ass', 'ssa'], // Rest muss eingebrannt werden
        };
    }
}