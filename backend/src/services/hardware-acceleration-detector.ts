import { ChildProcess, spawn } from 'child_process';
import { logger } from '../logger';
import { BLUE, MAGENTA, RESET, WHITE } from "../utils/utils";
import { FFMPEG_PATH } from "../utils/ffmpeg";
import { FFMPEG_HWACCEL } from "../app";
import { VideoCodec } from "../types/media";

export type HWAccelType = 'nvenc' | 'qsv' | 'vaapi' | 'amf' | 'cpu';

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

export const DEFAULT_HWACCELINFO: HWAccelInfo = {
    available: ['cpu'],
    preferred: 'cpu',
    encoders: {
        cpu: {},
        nvenc: {},
        qsv: {},
        vaapi: {},
        amf: {}
    }
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

        logger.INFO('Detecting hardware acceleration capabilities...');

        const available = await this.detectHWTypes();
        const allEncoders = await this.getAllEncoders();

        const encodersByType = {
            cpu:{}, nvenc:{}, qsv:{}, vaapi:{}, amf:{}
        } as HWAccelInfo['encoders'];

        for (const enc of allEncoders) {
            const hw = this.detectHWType(enc.name);
            const codec = this.detectCodec(enc.name);
            if (hw && codec && available.includes(hw)) {
                enc.hwType = hw;
                enc.codec = codec;
                encodersByType[hw][codec] = enc;
            }
        }

        const preferred: HWAccelType = this.determinePreferred(available);

        this.cachedInfo = { available, preferred, encoders: encodersByType };

        this.logDetectedHardware(available, encodersByType);
        logger.INFO(`${WHITE}Preferred encoder: ${preferred.toUpperCase()}${RESET}`);

        return this.cachedInfo;
    }

    private logEncoderFailure(hwType: HWAccelType, encoder: string, stderr: string) {
        const out = stderr.toLowerCase();

        let reason = 'hardware not available';

        if (out.includes('unknown encoder')) {
            reason = 'encoder not compiled into ffmpeg';
        } else if (out.includes('no device') || out.includes('no capable device')) {
            reason = 'no compatible hardware device found';
        } else if (out.includes('failed to initialize') || out.includes('init failed')) {
            reason = 'failed to initialize hardware encoder';
        } else if (out.includes('not supported')) {
            reason = 'encoder not supported by this hardware';
        }

        logger.WARNING(
            `${hwType.toUpperCase()} test failed for ${encoder}: ${reason}`
        );
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
                logger.INFO(`Found ${encoders.length} relevant encoders`);
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

    private async detectHWTypes(): Promise<HWAccelType[]> {
        const available: HWAccelType[] = ['cpu'];

        const tests: Record<HWAccelType, string> = {
            nvenc: 'h264_nvenc',
            qsv:   'h264_qsv',
            vaapi:'h264_vaapi',
            amf:  'h264_amf',
            cpu:  'libx264'
        };

        for (const [hw, encoder] of Object.entries(tests)) {
            if (hw === 'cpu') continue;

            const ok = await this.testEncoder(encoder, hw as HWAccelType);
            if (ok) available.push(hw as HWAccelType);
        }

        return available;
    }

    private async testEncoder(encoder: string, hwType: HWAccelType): Promise<boolean> {
        return new Promise(resolve => {
            const args = [
                '-f','lavfi',
                '-i','testsrc=duration=0.1:size=512x512:rate=1',
                '-frames:v','1',
                '-c:v', encoder,
                '-f','null','-'
            ];

            const p = spawn(FFMPEG_PATH, args);
            let stderr = '';

            p.stderr?.on('data', d => stderr += d.toString());

            p.on('close', code => {
                if (code !== 0) {
                    this.logEncoderFailure(hwType, encoder, stderr);
                    return resolve(false);
                }

                const fatal = [
                    'not supported',
                    'no device',
                    'failed to initialize',
                    'no amf capable device',
                    'unknown encoder'
                ];

                resolve(!fatal.some(f => stderr.toLowerCase().includes(f)));
            });

            setTimeout(() => {
                if (!p.killed) p.kill();
                resolve(false);
            }, 2500);
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

export class DEFAULT {
}