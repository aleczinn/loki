// backend/src/utils/hardware-acceleration.ts - FIXED PARSING

import { ChildProcess, spawn } from 'child_process';
import { logger } from '../logger';
import { BLUE, GREEN, MAGENTA, RESET, WHITE, YELLOW } from "../utils/utils";
import { FFMPEG_PATH } from "../utils/ffmpeg";
import { FFMPEG_HWACCEL } from "../app";

export type HWAccelType = 'nvenc' | 'qsv' | 'vaapi' | 'amf' | 'cpu';
export type VideoCodec = 'h264' | 'hevc' | 'av1' | 'vp8' | 'vp9';

export interface EncoderInfo {
    name: string;           // e.g., "h264_nvenc"
    codec: VideoCodec;      // e.g., "h264"
    hwType: HWAccelType;    // e.g., "nvenc"
    description: string;    // FFmpeg description
}

export interface HWAccelInfo {
    available: HWAccelType[];
    preferred: HWAccelType;
    encoders: {
        [K in HWAccelType]: {
            [C in VideoCodec]?: EncoderInfo;
        };
    };
}

export class HardwareAccelerationDetector {

    private cachedInfo: HWAccelInfo | null = null;

    /**
     * Detect all available hardware acceleration and encoders
     */
    async detect(): Promise<HWAccelInfo> {
        if (this.cachedInfo) {
            return this.cachedInfo;
        }

        logger.INFO('🔍 Detecting hardware acceleration capabilities...');

        // Get all available encoders from FFmpeg
        const allEncoders = await this.getAllEncoders();

        const available: HWAccelType[] = ['cpu']; // CPU always available
        const encodersByType: HWAccelInfo['encoders'] = {
            cpu: {},
            nvenc: {},
            qsv: {},
            vaapi: {},
            amf: {}
        };

        // Categorize encoders by hardware type
        for (const encoder of allEncoders) {
            const hwType = this.detectHWType(encoder.name);
            const codec = this.detectCodec(encoder.name);

            if (hwType && codec) {
                encoder.hwType = hwType;
                encoder.codec = codec;
                encodersByType[hwType][codec] = encoder;

                // Mark hw type as available
                if (hwType !== 'cpu' && !available.includes(hwType)) {
                    available.push(hwType);
                }
            }
        }

        // Log detected hardware
        this.logDetectedHardware(available, encodersByType);

        // Determine preferred hardware
        const preferred = this.determinePreferred(available);

        const info: HWAccelInfo = {
            available,
            preferred,
            encoders: encodersByType
        };

        this.cachedInfo = info;
        logger.INFO(`✅ Hardware Acceleration: Using ${preferred.toUpperCase()}`);

        return info;
    }

    /**
     * Get all available encoders from FFmpeg
     */
    private async getAllEncoders(): Promise<EncoderInfo[]> {
        return new Promise((resolve) => {
            const encoders: EncoderInfo[] = [];
            const ffmpeg: ChildProcess = spawn(FFMPEG_PATH, ['-encoders', '-hide_banner']);
            let output = '';

            ffmpeg.stdout?.on('data', (data) => {
                output += data.toString();
            });

            let finished = false;

            ffmpeg.on('close', () => {
                // Parse encoder list
                const lines = output.split(/\r?\n/); // Support both \n and \r\n
                let inEncoderSection = false;

                for (let line of lines) {
                    // Trim whitespace
                    line = line.trim();

                    // Skip empty lines
                    if (!line) continue;

                    // Start of encoder list (after the dashes)
                    if (line.startsWith('------') || line === '------') {
                        inEncoderSection = true;
                        continue;
                    }

                    if (!inEncoderSection) continue;

                    // Parse encoder line
                    // Format: " V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (codec h264)"
                    // After trim: "V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (codec h264)"

                    // Match video encoders only
                    if (!line.startsWith('V')) continue;

                    // Split by whitespace, but the description has many spaces
                    // Pattern: V + 5 flag chars + spaces + encoder_name + spaces + description
                    const match = line.match(/^V[\.FSBXD]{5}\s+(\S+)\s+(.+)$/);

                    if (match) {
                        const name = match[1];
                        const description = match[2].trim();

                        // Only include relevant video encoders
                        if (this.isRelevantEncoder(name)) {
                            encoders.push({
                                name,
                                codec: 'h264', // Will be determined later
                                hwType: 'cpu', // Will be determined later
                                description
                            });
                        }
                    }
                }

                finished = true;
                logger.DEBUG(`Found ${encoders.length} relevant encoders`);
                resolve(encoders);
            });

            ffmpeg.on('error', () => {
                logger.ERROR('Failed to get encoder list from FFmpeg');
                resolve([]);
            });

            // Timeout
            setTimeout(() => {
                if (!finished && !ffmpeg.killed) {
                    ffmpeg.kill();
                    logger.WARNING('FFmpeg encoder detection timed out');
                    resolve(encoders);
                }
            }, 5000);
        });
    }

    /**
     * Check if encoder name is relevant for our use case
     */
    private isRelevantEncoder(name: string): boolean {
        const relevant = [
            // NVENC
            'h264_nvenc', 'hevc_nvenc', 'av1_nvenc',
            // QSV
            'h264_qsv', 'hevc_qsv', 'av1_qsv', 'vp8_qsv', 'vp9_qsv',
            // VAAPI
            'h264_vaapi', 'hevc_vaapi', 'av1_vaapi', 'vp8_vaapi', 'vp9_vaapi',
            // AMF (AMD)
            'h264_amf', 'hevc_amf', 'av1_amf',
            // CPU
            'libx264', 'libx265', 'libaom-av1', 'libvpx', 'libvpx-vp9',
            // VideoToolbox (macOS) - optional
            'h264_videotoolbox', 'hevc_videotoolbox',
        ];

        return relevant.some(r => name === r || name.includes(r));
    }

    /**
     * Detect hardware type from encoder name
     */
    private detectHWType(encoderName: string): HWAccelType | null {
        const lower = encoderName.toLowerCase();

        if (lower.includes('nvenc')) return 'nvenc';
        if (lower.includes('qsv')) return 'qsv';
        if (lower.includes('vaapi')) return 'vaapi';
        if (lower.includes('amf')) return 'amf';
        if (lower.startsWith('lib')) return 'cpu';
        if (lower.includes('videotoolbox')) return 'cpu'; // Treat as CPU for now

        return null;
    }

    /**
     * Detect codec from encoder name
     */
    private detectCodec(encoderName: string): VideoCodec | null {
        const lower = encoderName.toLowerCase();

        if (lower.includes('264') || lower === 'libx264') return 'h264';
        if (lower.includes('265') || lower.includes('hevc') || lower === 'libx265') return 'hevc';
        if (lower.includes('av1') || lower === 'libaom-av1') return 'av1';
        if (lower.includes('vp9') || lower === 'libvpx-vp9') return 'vp9';
        if (lower.includes('vp8') || lower === 'libvpx') return 'vp8';

        return null;
    }

    /**
     * Determine preferred hardware type
     */
    private determinePreferred(available: HWAccelType[]): HWAccelType {
        // Check environment variable first
        const envPref = FFMPEG_HWACCEL?.toLowerCase();

        if (envPref === 'nvenc' && available.includes('nvenc')) return 'nvenc';
        if (envPref === 'qsv' && available.includes('qsv')) return 'qsv';
        if (envPref === 'vaapi' && available.includes('vaapi')) return 'vaapi';
        if (envPref === 'amf' && available.includes('amf')) return 'amf';
        if (envPref === 'cpu') return 'cpu';

        // Auto-detect: prefer GPU over CPU
        if (available.includes('nvenc')) return 'nvenc';
        if (available.includes('amf')) return 'amf';
        if (available.includes('qsv')) return 'qsv';
        if (available.includes('vaapi')) return 'vaapi';

        return 'cpu';
    }

    /**
     * Log detected hardware and encoders
     */
    private logDetectedHardware(
        available: HWAccelType[],
        encoders: HWAccelInfo['encoders']
    ): void {
        logger.INFO('Available hardware acceleration:');

        for (const hwType of available) {
            const encoderList = Object.values(encoders[hwType])
                .map(e => e?.codec.toUpperCase())
                .filter(Boolean)
                .join(', ');

            if (encoderList) {
                const color = hwType === 'cpu' ? MAGENTA : BLUE;
                logger.INFO(`  ${color}${hwType.toUpperCase()}${RESET}: ${encoderList}`);
            }
        }
    }

    /**
     * Get encoder for specific codec and hardware type
     */
    getEncoder(codec: VideoCodec, hwType?: HWAccelType): string | null {
        if (!this.cachedInfo) {
            logger.WARNING('Hardware acceleration not initialized');
            return null;
        }

        const targetHW = hwType || this.cachedInfo.preferred;
        const encoder = this.cachedInfo.encoders[targetHW][codec];

        return encoder?.name || null;
    }

    /**
     * Get all encoders for a specific hardware type
     */
    getEncodersForHW(hwType: HWAccelType): Record<VideoCodec, string> {
        if (!this.cachedInfo) {
            return {} as Record<VideoCodec, string>;
        }

        const result: Partial<Record<VideoCodec, string>> = {};
        const encoders = this.cachedInfo.encoders[hwType];

        for (const codec in encoders) {
            const encoder = encoders[codec as VideoCodec];
            if (encoder) {
                result[codec as VideoCodec] = encoder.name;
            }
        }

        return result as Record<VideoCodec, string>;
    }

    /**
     * Check if specific codec is available
     */
    hasEncoder(codec: VideoCodec, hwType?: HWAccelType): boolean {
        const encoder = this.getEncoder(codec, hwType);
        return encoder !== null;
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
            case 'amf':
                return [
                    '-hwaccel', 'auto'
                ];
            case 'cpu':
            default:
                return [];
        }
    }

    /**
     * Get quality preset for encoder
     */
    getPreset(hwType: HWAccelType, targetQuality: 'fast' | 'balanced' | 'quality'): string {
        switch (hwType) {
            case 'nvenc':
                // NVENC presets: p1-p7 (p1=fastest, p7=slowest/best quality)
                return targetQuality === 'fast' ? 'p1'
                    : targetQuality === 'balanced' ? 'p4'
                        : 'p6';

            case 'qsv':
            case 'amf':
                return targetQuality === 'fast' ? 'veryfast'
                    : targetQuality === 'balanced' ? 'medium'
                        : 'slow';

            case 'vaapi':
            case 'cpu':
            default:
                return targetQuality === 'fast' ? 'veryfast'
                    : targetQuality === 'balanced' ? 'medium'
                        : 'slow';
        }
    }

    /**
     * Get additional encoder-specific arguments
     */
    getEncoderArgs(hwType: HWAccelType, codec: VideoCodec): string[] {
        switch (hwType) {
            case 'nvenc':
                return [
                    '-rc', 'vbr',
                    '-rc-lookahead', '32',
                    '-spatial_aq', '1',
                    '-temporal_aq', '1',
                    '-b_ref_mode', 'middle'
                ];

            case 'qsv':
                return [
                    '-look_ahead', '1',
                    '-look_ahead_depth', '40'
                ];

            case 'amf':
                return [
                    '-quality', 'balanced',
                    '-rc', 'vbr_latency'
                ];

            case 'vaapi':
                return ['-quality', '4'];

            case 'cpu':
            default:
                if (codec === 'h264' || codec === 'hevc') {
                    return ['-tune', 'film'];
                }
                return [];
        }
    }

    /**
     * Get complete info for API/debugging
     */
    getInfo(): HWAccelInfo | null {
        return this.cachedInfo;
    }
}

const hwAccelDetector = new HardwareAccelerationDetector();
export default hwAccelDetector;