export type MediaContainer = 'mp4' | 'webm' | 'mkv' | 'avi' | 'm4v' | 'mov';
export type MediaHDRFormat = 'hdr10' | 'hdr10+' | 'dolby vision' | 'hlg';
export type MediaVideoCodec = 'h264' | 'hevc' | 'mpeg2' | 'vc1' | 'vp8' | 'vp9' | 'av1';
export type MediaAudioCodec = 'opus' | 'flac' | 'pcm' | 'ogg' | 'vorbis' | 'aac' | 'ac3' | 'eac3' | 'mp3' | 'wav' | 'dts' | 'truehd';
export type MediaSubtitleFormat = 'srt' | 'vtt' | 'ass' | 'ssa' | 'pgs' | 'vobsub' | 'subrip';

// VIDEO
export interface VideoCodecCapability {
    codec: MediaVideoCodec;
    profiles: VideoProfile[];
    maxWidth: number;
    maxHeight: number;
    bitDepths: number[];
}

export interface VideoProfile {
    name: string;       // 'baseline', 'main', 'high', 'main10', 'profile0', 'profile2'
    maxLevel: string;   // '4.1', '5.1', etc.
    bitDepth: number;   // 8 oder 10
}

// AUDIO
export interface AudioCodecCapability {
    codec: MediaAudioCodec;
    extensions: AudioExtension[];
    maxChannels: number;
    sampleRates: number[];
    passthrough: boolean;
}

export type AudioExtension =
    // Dolby Extensions
    | 'atmos'          // Atmos (für EAC3 oder TrueHD)
    // DTS Extensions
    | 'es'             // DTS-ES (6.1)
    | 'hd-hr'          // DTS-HD High Resolution
    | 'hd-ma'          // DTS-HD Master Audio
    | 'x';             // DTS:X (object-based)

// SUBTITLE
export interface SubtitleCapability {
    // Welche Formate kann der Client NATIV anzeigen? (ohne Burn-in)
    nativeFormats: MediaSubtitleFormat[];

    // Alle anderen müssen eingebrannt werden (PGS, VobSub, ASS meist)
    requiresBurnIn: MediaSubtitleFormat[];
}

// DISPLAY
export interface DisplayCapability {
    width: number;
    height: number;
    pixelRatio: number;
    refreshRate: number;
    hdr: {
        capable: boolean;           // Kann Display HDR?
        formats: MediaHDRFormat[];  // Welche HDR-Formate?
        maxLuminance?: number;      // in nits (nur native Apps)
        minLuminance?: number;      // in nits
        colorDepth: number;         // 8, 10, 12 bit
    }
    colorSpaces: ('srgb' | 'p3' | 'rec709' | 'rec2020')[];
}

// CLIENT
export interface Client {
    userAgent: string;
    deviceModel: {
        name: string;       // "NVIDIA Shield", "Samsung Galaxy S23", etc.
        version?: string;    // specific device model or browser version
    };
    platform: string;       // windows, macOS, linux, android, ios
    osVersion?: string;     // "Android 13", "iOS 17.1", etc.
    appVersion?: string;    // Version deiner App
}


/** Einheitliche Client Capabilities für alle Plattformen */
export interface ClientCapabilities {
    client: Client;
    display: DisplayCapability;
    containers: MediaContainer[];
    videoCodecs: VideoCodecCapability[];
    audioCodecs: AudioCodecCapability[];
    subtitles: SubtitleCapability;
    supportsAdaptiveStreaming: boolean; // Unterstützt der Client Media Source Extensions? Adaptive Streaming (HLS via hls.js)
}