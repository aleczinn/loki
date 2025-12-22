import { MediaFile } from "../types/media-file";
import { ClientCapabilities, MediaVideoCodec, MediaAudioCodec } from "../types/capabilities/client-capabilities";
import { preferFragmentedMp4 } from "../settings";

export type StreamMode = 'direct_play' | 'direct_remux' | 'transcode';
export type GenericStreamingType = 'copy' | 'transcode';
export type SubtitleStreamingType = 'copy' | 'burn_in' | 'none';

export interface TranscodeDecision {
    mode: StreamMode;
    video: {
        action: GenericStreamingType;
        reason?: string;
        sourceCodec?: string;
        targetCodec?: MediaVideoCodec;
        hwAccel?: 'nvenc' | 'qsv' | 'cpu';
    };
    audio: {
        action: GenericStreamingType;
        reason?: string;
        sourceCodec?: string;
        targetCodec?: MediaAudioCodec;
        trackIndex?: number;
    };
    subtitle: {
        action: SubtitleStreamingType;
        reason?: string;
        trackIndex?: number;
    };
    container: {
        needsRemux: boolean;
        reason?: string;
        sourceContainer: string;
        targetContainer?: string;
    };
    statistics: {
        directPlayReasons: string[];
        transcodeReasons: string[];
        remuxReasons: string[];
    };
}

export class TranscodeDecisionService {

    /**
     * Main decision function - determines how to stream media
     */
    public decide(file: MediaFile, capabilities: ClientCapabilities, profile?: string): TranscodeDecision {
        const stats = {
            directPlayReasons: [] as string[],
            transcodeReasons: [] as string[],
            remuxReasons: [] as string[]
        };

        // Check container compatibility
        const containerDecision = this.checkContainer(file, capabilities, stats);

        // Check video codec compatibility
        const videoDecision = this.checkVideoCodec(file, capabilities, stats);

        // Check audio codec compatibility
        const audioDecision = this.checkAudioCodec(file, capabilities, stats);

        // Check subtitle requirements
        const subtitleDecision = this.checkSubtitles(file, capabilities, stats);

        // Determine final mode
        let mode: StreamMode = 'direct_play';

        if (containerDecision.needsRemux && audioDecision.action === 'copy') {
            mode = 'direct_remux';
        } else if (videoDecision.action === 'transcode' || audioDecision.action === 'transcode') {
            mode = 'transcode';
        }

        // Prefer fragmented MP4
        if (mode === 'direct_play' && preferFragmentedMp4) {
            mode = 'direct_remux';

            containerDecision.reason = 'fragmented-mp4-preferred';
            stats.remuxReasons.push('optimized-for-seeking');
        }

        return {
            mode,
            video: videoDecision,
            audio: audioDecision,
            subtitle: subtitleDecision,
            container: containerDecision,
            statistics: stats
        };
    }

    /**
     * Check if container is compatible
     */
    private checkContainer(file: MediaFile, capabilities: ClientCapabilities, stats: TranscodeDecision['statistics']): TranscodeDecision['container'] {
        const sourceContainer = file.extension.replace('.', '') as any;
        const supportedContainers = capabilities.containers;

        if (supportedContainers.includes(sourceContainer)) {
            stats.directPlayReasons.push(`Container ${sourceContainer} is supported`);
            return {
                needsRemux: false,
                sourceContainer
            };
        }

        // MKV needs remux to MP4 for browsers
        if (sourceContainer === 'mkv' && supportedContainers.includes('mp4')) {
            stats.remuxReasons.push(`Container ${sourceContainer} needs remux to mp4`);
            return {
                needsRemux: true,
                reason: `Container ${sourceContainer} not supported, remuxing to mp4`,
                sourceContainer,
                targetContainer: 'mp4'
            };
        }

        stats.transcodeReasons.push(`Container ${sourceContainer} not supported`);
        return {
            needsRemux: true,
            reason: `Container ${sourceContainer} not supported`,
            sourceContainer,
            targetContainer: 'mp4'
        };
    }

    /**
     * Check video codec compatibility
     */
    private checkVideoCodec(file: MediaFile, capabilities: ClientCapabilities, stats: TranscodeDecision['statistics']): TranscodeDecision['video'] {
        if (!file.metadata?.video?.[0]) {
            return { action: 'copy' };
        }

        const videoTrack = file.metadata.video[0];
        const sourceCodec = this.mapVideoFormat(videoTrack.Format);
        const bitDepth = videoTrack.BitDepth || 8;
        const width = videoTrack.Width;
        const height = videoTrack.Height;

        // Check if codec is supported
        const codecSupport = capabilities.videoCodecs.find(c => c.codec === sourceCodec);

        if (!codecSupport) {
            stats.transcodeReasons.push(`Video codec ${sourceCodec} not supported`);
            return {
                action: 'transcode',
                reason: `Video codec ${sourceCodec} not supported by client`,
                sourceCodec,
                targetCodec: this.selectBestVideoCodec(capabilities),
                hwAccel: this.detectHardwareAcceleration()
            };
        }

        // Check bit depth
        if (!codecSupport.bitDepths.includes(bitDepth)) {
            stats.transcodeReasons.push(`Video bit depth ${bitDepth} not supported`);
            return {
                action: 'transcode',
                reason: `${bitDepth}-bit not supported, transcoding to 8-bit`,
                sourceCodec,
                targetCodec: 'h264',
                hwAccel: this.detectHardwareAcceleration()
            };
        }

        // Check resolution
        if (width > codecSupport.maxWidth || height > codecSupport.maxHeight) {
            stats.transcodeReasons.push(`Resolution ${width}x${height} exceeds max ${codecSupport.maxWidth}x${codecSupport.maxHeight}`);
            return {
                action: 'transcode',
                reason: `Resolution too high, downscaling required`,
                sourceCodec,
                targetCodec: sourceCodec,
                hwAccel: this.detectHardwareAcceleration()
            };
        }

        stats.directPlayReasons.push(`Video codec ${sourceCodec} fully supported`);
        return {
            action: 'copy',
            sourceCodec
        };
    }

    /**
     * Check audio codec compatibility
     */
    private checkAudioCodec(file: MediaFile, capabilities: ClientCapabilities, stats: TranscodeDecision['statistics']): TranscodeDecision['audio'] {
        if (!file.metadata?.audio?.[0]) {
            return { action: 'copy' };
        }

        const audioTrack = file.metadata.audio[0];
        const sourceCodec = this.mapAudioFormat(audioTrack.Format);
        const channels = audioTrack.Channels || 2;

        const codecSupport = capabilities.audioCodecs.find(c => c.codec === sourceCodec);

        if (!codecSupport) {
            stats.transcodeReasons.push(`Audio codec ${sourceCodec} not supported`);
            return {
                action: 'transcode',
                reason: `Audio codec ${sourceCodec} not supported`,
                sourceCodec,
                targetCodec: 'aac',
                trackIndex: 0
            };
        }

        // Check channel count
        if (channels > codecSupport.maxChannels) {
            stats.transcodeReasons.push(`Audio channels ${channels} exceeds max ${codecSupport.maxChannels}`);
            return {
                action: 'transcode',
                reason: `Downmixing ${channels} channels to ${codecSupport.maxChannels}`,
                sourceCodec,
                targetCodec: sourceCodec,
                trackIndex: 0
            };
        }

        stats.directPlayReasons.push(`Audio codec ${sourceCodec} fully supported`);
        return {
            action: 'copy',
            sourceCodec,
            trackIndex: 0
        };
    }

    /**
     * Check subtitle requirements
     */
    private checkSubtitles(file: MediaFile, capabilities: ClientCapabilities, stats: TranscodeDecision['statistics']): TranscodeDecision['subtitle'] {
        if (!file.metadata?.subtitle?.length) {
            return { action: 'none' };
        }

        // For now, we don't burn in subtitles automatically
        // User can select them in player if they're text-based (SRT/VTT)
        return {
            action: 'copy',
            trackIndex: -1 // -1 means no subtitle selected
        };
    }

    /**
     * Map MediaInfo format to our codec types
     */
    private mapVideoFormat(format?: string): MediaVideoCodec {
        if (!format) return 'h264';

        const formatLower = format.toLowerCase();
        if (formatLower.includes('avc') || formatLower.includes('h264')) return 'h264';
        if (formatLower.includes('hevc') || formatLower.includes('h265')) return 'hevc';
        if (formatLower.includes('vp9')) return 'vp9';
        if (formatLower.includes('vp8')) return 'vp8';
        if (formatLower.includes('av1')) return 'av1';
        if (formatLower.includes('mpeg-2') || formatLower === 'mpeg video') return 'mpeg2';
        if (formatLower.includes('vc-1') || formatLower.includes('vc1')) return 'vc1';

        return 'h264'; // default fallback
    }

    /**
     * Map MediaInfo format to our audio codec types
     */
    private mapAudioFormat(format?: string): MediaAudioCodec {
        if (!format) return 'aac';

        const formatLower = format.toLowerCase();
        if (formatLower.includes('aac')) return 'aac';
        if (formatLower.includes('ac-3') || formatLower === 'ac3') return 'ac3';
        if (formatLower.includes('e-ac-3') || formatLower.includes('eac3')) return 'eac3';
        if (formatLower.includes('opus')) return 'opus';
        if (formatLower.includes('vorbis')) return 'vorbis';
        if (formatLower.includes('flac')) return 'flac';
        if (formatLower.includes('mp3') || formatLower === 'mpeg audio') return 'mp3';
        if (formatLower.includes('dts')) return 'dts';
        if (formatLower.includes('truehd')) return 'truehd';
        if (formatLower.includes('pcm')) return 'pcm';

        return 'aac'; // default fallback
    }

    /**
     * Select best video codec for transcoding
     */
    private selectBestVideoCodec(capabilities: ClientCapabilities): MediaVideoCodec {
        // Prefer H.264 as it's most compatible
        if (capabilities.videoCodecs.some(c => c.codec === 'h264')) {
            return 'h264';
        }

        // Fallback to first available codec
        return capabilities.videoCodecs[0]?.codec || 'h264';
    }

    /**
     * Detect available hardware acceleration
     */
    private detectHardwareAcceleration(): 'nvenc' | 'qsv' | 'cpu' {
        // Check for NVIDIA GPU
        if (process.env.FFMPEG_HWACCEL === 'nvenc') {
            return 'nvenc';
        }

        // Check for Intel QuickSync
        if (process.env.FFMPEG_HWACCEL === 'qsv') {
            return 'qsv';
        }

        // Fallback to CPU
        return 'cpu';
    }
}

const transcodeDecisionService = new TranscodeDecisionService();
export default transcodeDecisionService;