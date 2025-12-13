import type { AxiosInstance } from 'axios';
import type { MediaFile } from "../types/media.ts";

export interface PlaybackInfo {
    mediaId: string;
    mode: 'direct_play' | 'direct_stream' | 'transcode';
    playbackUrl: string;
    decision: {
        video: {
            action: 'copy' | 'transcode';
            reason?: string;
            sourceCodec?: string;
            targetCodec?: string;
            hwAccel?: 'nvenc' | 'qsv' | 'cpu';
        };
        audio: {
            action: 'copy' | 'transcode';
            reason?: string;
            sourceCodec?: string;
            targetCodec?: string;
            trackIndex?: number;
        };
        subtitle: {
            action: 'copy' | 'burn_in' | 'none';
            reason?: string;
            trackIndex?: number;
        };
        container: {
            needsRemux: boolean;
            reason?: string;
            sourceContainer: string;
            targetContainer?: string;
        };
    };
    statistics: {
        directPlayReasons: string[];
        transcodeReasons: string[];
        remuxReasons: string[];
    };
    metadata: {
        duration: number;
        resolution: string;
        videoCodec: string;
        audioCodec: string;
    };
}

export class PlaybackService {

    private axiosInstance: AxiosInstance;

    constructor(axios: AxiosInstance) {
        this.axiosInstance = axios;
    }

    /**
     * Get playback information for a media file
     */
    async getPlaybackInfo(file: MediaFile, quality: string = 'original'): Promise<PlaybackInfo> {
        const response = await this.axiosInstance.get(`/playback/${file.id}/info`, {
            params: { quality }
        });
        return response.data;
    }

    /**
     * Get statistics about why transcoding is happening
     */
    getTranscodeStatistics(info: PlaybackInfo): string[] {
        const stats: string[] = [];

        if (info.mode === 'direct_play') {
            stats.push('✓ Direct Play - No transcoding needed');
            stats.push(...info.statistics.directPlayReasons);
        } else if (info.mode === 'direct_stream') {
            stats.push('⚡ Direct Stream - Container remux only');
            stats.push(...info.statistics.remuxReasons);
        } else {
            stats.push('⚙️ Transcoding required:');
            stats.push(...info.statistics.transcodeReasons);

            if (info.decision.video.action === 'transcode') {
                stats.push(`  Video: ${info.decision.video.sourceCodec} → ${info.decision.video.targetCodec}`);
                if (info.decision.video.hwAccel && info.decision.video.hwAccel !== 'cpu') {
                    stats.push(`  HW Accel: ${info.decision.video.hwAccel.toUpperCase()}`);
                }
            }

            if (info.decision.audio.action === 'transcode') {
                stats.push(`  Audio: ${info.decision.audio.sourceCodec} → ${info.decision.audio.targetCodec}`);
            }
        }

        return stats;
    }

    /**
     * Check if we should use HLS or native video element
     */
    shouldUseHLS(info: PlaybackInfo): boolean {
        return info.mode === 'transcode';
    }
}