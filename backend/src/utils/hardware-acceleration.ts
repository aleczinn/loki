import { ChildProcess, spawn } from 'child_process';
import { Logger, logger } from '../logger';
import { FFMPEG_PATH } from "./ffmpeg";
import { BLACK, CYAN, GREEN, MAGENTA, RESET, WHITE } from "./utils";

export type HWAccelType = 'nvenc' | 'qsv' | 'vaapi' | 'cpu';

export interface HWAccelInfo {
    available: HWAccelType[];
    preferred: HWAccelType;
    encoders: {
        h264: string;
        hevc: string;
    };
}

export class HardwareAccelerationDetector {

    private cachedInfo: HWAccelInfo | null = null;

    /**
     * Detect available hardware acceleration
     */
    async detect(): Promise<HWAccelInfo> {
        if (this.cachedInfo) {
            return this.cachedInfo;
        }

        const available: HWAccelType[] = ['cpu']; // CPU is always available

        // Check NVIDIA NVENC
        if (await this.checkNVENC()) {
            available.push('nvenc');
            logger.INFO(`${GREEN}✓ ${WHITE}NVIDIA NVENC detected${RESET}`);
        }

        // Check Intel QuickSync
        if (await this.checkQSV()) {
            available.push('qsv');
            logger.INFO(`${GREEN}✓ ${WHITE}Intel QuickSync detected${RESET}`);
        }

        // Check VAAPI (Linux)
        if (await this.checkVAAPI()) {
            available.push('vaapi');
            logger.INFO(`${GREEN}✓ ${WHITE}VAAPI detected${RESET}`);
        }

        // Prefer GPU acceleration over CPU
        const preferred = available.includes('nvenc') ? 'nvenc'
            : available.includes('qsv') ? 'qsv'
                : available.includes('vaapi') ? 'vaapi'
                    : 'cpu';

        const info: HWAccelInfo = {
            available,
            preferred,
            encoders: this.getEncoders(preferred)
        };

        this.cachedInfo = info;
        logger.INFO(`Hardware Acceleration: Using ${preferred.toUpperCase()}`);

        return info;
    }

    /**
     * Check if NVIDIA NVENC is available
     */
    private async checkNVENC(): Promise<boolean> {
        return this.checkEncoder('h264_nvenc');
    }

    /**
     * Check if Intel QuickSync is available
     */
    private async checkQSV(): Promise<boolean> {
        return this.checkEncoder('h264_qsv');
    }

    /**
     * Check if VAAPI is available (Linux)
     */
    private async checkVAAPI(): Promise<boolean> {
        return this.checkEncoder('h264_vaapi');
    }

    /**
     * Check if specific encoder is available
     */
    private async checkEncoder(encoderName: string): Promise<boolean> {
        return new Promise((resolve) => {
            const ffmpeg: ChildProcess = spawn(FFMPEG_PATH, ['-encoders']);
            let output = '';

            ffmpeg.stdout?.on('data', (data) => {
                output += data.toString();
            });

            ffmpeg.on('close', () => {
                resolve(output.includes(encoderName));
            });

            ffmpeg.on('error', () => {
                resolve(false);
            });

            // Timeout after 5 seconds
            setTimeout(() => {
                ffmpeg.kill();
                resolve(false);
            }, 5000);
        });
    }

    /**
     * Get encoder names for the hardware acceleration type
     */
    private getEncoders(hwType: HWAccelType): { h264: string; hevc: string } {
        switch (hwType) {
            case 'nvenc':
                return {
                    h264: 'h264_nvenc',
                    hevc: 'hevc_nvenc'
                };
            case 'qsv':
                return {
                    h264: 'h264_qsv',
                    hevc: 'hevc_qsv'
                };
            case 'vaapi':
                return {
                    h264: 'h264_vaapi',
                    hevc: 'hevc_vaapi'
                };
            case 'cpu':
            default:
                return {
                    h264: 'libx264',
                    hevc: 'libx265'
                };
        }
    }

    /**
     * Get FFmpeg input arguments for hardware acceleration
     */
    getInputArgs(hwType: HWAccelType): string[] {
        switch (hwType) {
            case 'nvenc':
                return [
                    '-hwaccel', 'cuda',
                    '-hwaccel_output_format', 'cuda'
                ];
            case 'qsv':
                return [
                    '-hwaccel', 'qsv',
                    '-hwaccel_output_format', 'qsv'
                ];
            case 'vaapi':
                return [
                    '-hwaccel', 'vaapi',
                    '-hwaccel_output_format', 'vaapi',
                    '-vaapi_device', '/dev/dri/renderD128'
                ];
            case 'cpu':
            default:
                return [];
        }
    }

    /**
     * Get quality preset for hardware encoder
     */
    getPreset(hwType: HWAccelType, targetQuality: 'fast' | 'balanced' | 'quality'): string {
        switch (hwType) {
            case 'nvenc':
                // NVENC presets: p1-p7 (p1=fastest, p7=slowest/best quality)
                return targetQuality === 'fast' ? 'p1'
                    : targetQuality === 'balanced' ? 'p4'
                        : 'p6';

            case 'qsv':
                // QSV presets
                return targetQuality === 'fast' ? 'veryfast'
                    : targetQuality === 'balanced' ? 'medium'
                        : 'slow';

            case 'vaapi':
            case 'cpu':
            default:
                // Software presets
                return targetQuality === 'fast' ? 'veryfast'
                    : targetQuality === 'balanced' ? 'medium'
                        : 'slow';
        }
    }

    /**
     * Get additional encoder-specific arguments
     */
    getEncoderArgs(hwType: HWAccelType, encoder: 'h264' | 'hevc'): string[] {
        switch (hwType) {
            case 'nvenc':
                return [
                    '-rc', 'vbr',           // Variable bitrate
                    '-rc-lookahead', '32',   // Look-ahead for better quality
                    '-spatial_aq', '1',      // Spatial AQ
                    '-temporal_aq', '1',     // Temporal AQ
                    '-b_ref_mode', 'middle'  // B-frame reference mode
                ];

            case 'qsv':
                return [
                    '-look_ahead', '1',
                    '-look_ahead_depth', '40'
                ];

            case 'vaapi':
                return [
                    '-quality', '4'  // VAAPI quality level
                ];

            case 'cpu':
            default:
                return [
                    '-preset', 'veryfast',
                    '-tune', 'film'
                ];
        }
    }
}

const hwAccelDetector = new HardwareAccelerationDetector();
export default hwAccelDetector;