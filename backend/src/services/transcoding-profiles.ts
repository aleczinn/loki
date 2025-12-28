import { QualityProfile, TranscodeDecision } from "./transcode-decision";
import hardwareAccelerationDetector from "./hardware-acceleration-detector";
import { PlaySession } from "./streaming-service";
import { crfForAVCEncoding, supportEncodingInAV1, supportEncodingInHEVC, videoEncodingPreset } from "../settings";

interface TranscodingArgs {
    inputArgs: string[];
    videoArgs: string[];
    audioArgs: string[];
    subtitleArgs: string[];
}

export function getTranscodingArgs(session: PlaySession): TranscodingArgs {
    const decision: TranscodeDecision = session.decision;

    const caps = session.client.capabilities;
    const profile = decision.profile;
    const hevc = caps.videoCodecs.find(v => v.codec === 'hevc');

    const supportsHEVC = !!hevc;
    const supportsHEVC_8bit = supportsHEVC && hevc?.bitDepths.includes(8);
    const supportsHEVC_10bit = supportsHEVC && hevc?.bitDepths.includes(10);

    const av1 = caps.videoCodecs.find(v => v.codec === 'av1');
    const supportsAV1 = !!av1;
    const supportsAV1_10bit = supportsAV1 && av1?.bitDepths.includes(10);

    const inputArgs: string[] = [];
    const videoArgs: string[] = [];
    const audioArgs: string[] = [];
    const subtitleArgs: string[] = [];

    const hw = hardwareAccelerationDetector.getInfo();
    if (hw) {
        // VIDEO
        if (decision.video.action === 'copy') {
            videoArgs.push('-c:v', 'copy');
        } else {
            if (hw.preferred === 'cpu') {
                let encoder = 'libx264';
                if (supportsHEVC && supportEncodingInHEVC) {
                    encoder = 'libx265';
                }
                if (supportsAV1 && supportEncodingInAV1) {
                    encoder = 'libsvtav1';
                }

                videoArgs.push('-c:v', encoder); // TODO : change based on settings if I should use h264 or h265
                videoArgs.push('-crf', String(crfForAVCEncoding));
                videoArgs.push('-preset', String(videoEncodingPreset));
                videoArgs.push('-pix_fmt', (supportsHEVC_10bit || supportsAV1_10bit) ? 'yuv420p10le' : 'yuv420p');
            } else {
                inputArgs.push(...hardwareAccelerationDetector.getInputArgs(hw.preferred));

                // TODO : Need to check if gpu/igpu also support encoder
                switch (hw.preferred) {
                    case 'nvenc':
                        if (supportEncodingInAV1) {
                            videoArgs.push('-c:v', 'av1_nvenc');
                            if (supportsAV1_10bit) {
                                videoArgs.push('-pix_fmt', 'yuv420p10le');
                            } else {
                                videoArgs.push('-profile:v', 'main');
                                videoArgs.push('-pix_fmt', 'yuv420p');
                            }
                        } else if (supportEncodingInHEVC) {
                            videoArgs.push('-c:v', 'hevc_nvenc');
                            if (supportsHEVC_10bit) {
                                videoArgs.push('-profile:v', 'main10');
                                videoArgs.push('-pix_fmt', 'p010le');
                            } else {
                                videoArgs.push('-profile:v', 'main');
                                videoArgs.push('-pix_fmt', 'yuv420p');
                            }
                        } else {
                            videoArgs.push('-c:v', 'h264_nvenc');
                            videoArgs.push('-pix_fmt', 'yuv420p');
                        }
                        break;
                    case 'qsv':
                        if (supportEncodingInAV1) {
                            // encoder = 'av1_qsv';
                        } else if (supportEncodingInHEVC) {
                            // encoder = 'hevc_qsv';
                        } else {
                            // encoder = 'h264_qsv';
                        }
                        break;
                    case 'amf':
                        if (supportEncodingInAV1) {
                            // encoder = 'av1_amf';
                        } else if (supportEncodingInHEVC) {
                            // encoder = 'hevc_amf';
                        } else {
                            // encoder = 'h264_amf';
                        }
                        break;
                    case 'vaapi':
                        if (supportEncodingInAV1) {
                            // encoder = 'av1_vaapi';
                        } else if (supportEncodingInHEVC) {
                            // encoder = 'hevc_vaapi';
                        } else {
                            // encoder = 'h264_vaapi';
                        }
                        break;
                }

                switch (profile) {
                    case "4k_40mbps":
                        videoArgs.push('-vf', 'scale=-2:min(ih,2160)');
                        videoArgs.push('-b:v', '40000k');
                        videoArgs.push('-maxrate', '42000k');
                        videoArgs.push('-bufsize', '80000k');
                        break;
                    case "4k_20mbps":
                        videoArgs.push('-vf', 'scale=-2:min(ih,2160)');
                        videoArgs.push('-b:v', '20000k');
                        videoArgs.push('-maxrate', '22000k');
                        videoArgs.push('-bufsize', '40000k');
                        break;
                    case "1080p_20mbps":
                        videoArgs.push('-vf', 'scale=-2:min(ih,1080)');
                        videoArgs.push('-b:v', '20000k');
                        videoArgs.push('-maxrate', '22000k');
                        videoArgs.push('-bufsize', '40000k');
                        break;
                    case "1080p_8mbps":
                        videoArgs.push('-vf', 'scale=-2:min(ih,1080)');
                        videoArgs.push('-b:v', '8000k');
                        videoArgs.push('-maxrate', '10000k');
                        videoArgs.push('-bufsize', '16000k');
                        break;
                    case "720p_6mbps":
                        videoArgs.push('-vf', 'scale=-2:min(ih,720)');
                        videoArgs.push('-b:v', '6000k');
                        videoArgs.push('-maxrate', '8000k');
                        videoArgs.push('-bufsize', '12000k');
                        break;
                    case "480p_3mbps":
                        videoArgs.push('-vf', 'scale=-2:min(ih,480)');
                        videoArgs.push('-b:v', '3000k');
                        videoArgs.push('-maxrate', '4000k');
                        videoArgs.push('-bufsize', '6000k');
                        break;
                    case "360p_1mbps":
                        videoArgs.push('-vf', 'scale=-2:min(ih,360)');
                        videoArgs.push('-b:v', '1000k');
                        videoArgs.push('-maxrate', '1500k');
                        videoArgs.push('-bufsize', '2000k');
                        break;
                    case "240p_1mbps":
                        videoArgs.push('-vf', 'scale=-2:min(ih,240)');
                        videoArgs.push('-b:v', '1000k');
                        videoArgs.push('-maxrate', '1500k');
                        videoArgs.push('-bufsize', '2000k');
                        break;
                }
            }
        }

        // AUDIO
        if (decision.audio.action === 'copy') {
            audioArgs.push('-c:a', 'copy');
        } else {
            const opus = caps.audioCodecs.find(a => a.codec === 'opus');
            const opusSupported = !!opus;

            audioArgs.push('-c:a', opusSupported ? 'opus' : 'aac');
            switch (profile) {
                case "4k_40mbps":
                case "4k_20mbps":
                case "1080p_20mbps":
                case "1080p_8mbps":
                case "720p_6mbps":
                    audioArgs.push('-b:a', '192k');
                    break;
                case "480p_3mbps":
                    audioArgs.push('-b:a', '128k');
                    break;
                case "360p_1mbps":
                case "240p_1mbps":
                    audioArgs.push('-b:a', '96k');
                    break;
            }
            audioArgs.push('-ac', '2');
            audioArgs.push('-ar', '48000');
        }
    }

    // console.log("INPUT_ARGS", inputArgs);
    // console.log("VIDEO_ARGS", videoArgs);
    // console.log("AUDIO_ARGS", audioArgs);

    return {
        inputArgs,
        videoArgs,
        audioArgs,
        subtitleArgs
    }
}