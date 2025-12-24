import { QualityProfile } from "./transcode-decision";
import hardwareAccelerationDetector from "./hardware-acceleration-detector";
import { ClientCapabilities } from "../types/capabilities/client-capabilities";

interface TranscodingArgs {
    containerOptions: string[];
    videoOptions: string[];
    audioOptions: string[];
    subtitleOptions: string[];
}

export function getTranscodingArgs(profile: QualityProfile, capabilities: ClientCapabilities): TranscodingArgs {
    const hwAccl = hardwareAccelerationDetector.getInfo();

    if (hwAccl) {
        switch (profile) {
            case "4k_40mbps":
                return {
                    containerOptions: [],
                    videoOptions: [
                        '-vf', 'scale=-2:min(ih,2160)',
                        '-b:v', '40000k',
                        '-maxrate', '42000k',
                        '-bufsize', '80000k',
                    ],
                    audioOptions: [
                        '-c:a', 'aac',
                        '-b:a', '192k',
                        '-ac', '2',
                        '-ar', '48000',
                    ],
                    subtitleOptions: []
                }
            case "4k_20mbps":
                return {
                    containerOptions: [],
                    videoOptions: [
                        '-vf', 'scale=-2:min(ih,2160)',
                        '-b:v', '20000k',
                        '-maxrate', '22000k',
                        '-bufsize', '40000k',
                    ],
                    audioOptions: [
                        '-c:a', 'aac',
                        '-b:a', '192k',
                        '-ac', '2',
                        '-ar', '48000',
                    ],
                    subtitleOptions: []
                }
            case "1080p_20mbps":
                return {
                    containerOptions: [],
                    videoOptions: [
                        '-vf', 'scale=-2:min(ih,1080)',
                        '-b:v', '20000k',
                        '-maxrate', '22000k',
                        '-bufsize', '40000k',
                    ],
                    audioOptions: [
                        '-c:a', 'aac',
                        '-b:a', '192k',
                        '-ac', '2',
                        '-ar', '48000',
                    ],
                    subtitleOptions: []
                }
            case "1080p_8mbps":
                return {
                    containerOptions: [],
                    videoOptions: [
                        '-vf', 'scale=-2:min(ih,1080)',
                        '-b:v', '8000k',
                        '-maxrate', '10000k',
                        '-bufsize', '20000k',
                    ],
                    audioOptions: [
                        '-c:a', 'aac',
                        '-b:a', '192k',
                        '-ac', '2',
                        '-ar', '48000',
                    ],
                    subtitleOptions: []
                }
            case "720p_6mbps":
                return {
                    containerOptions: [],
                    videoOptions: [
                        '-vf', 'scale=-2:min(ih,720)',
                        '-b:v', '6000k',
                        '-maxrate', '7000k',
                        '-bufsize', '14000k',
                    ],
                    audioOptions: [
                        '-c:a', 'aac',
                        '-b:a', '192k',
                        '-ac', '2',
                        '-ar', '48000',
                    ],
                    subtitleOptions: []
                }
            case "480p_3mbps":
                return {
                    containerOptions: [],
                    videoOptions: [
                        '-vf', 'scale=-2:min(ih,480)',
                        '-b:v', '3000k',
                        '-maxrate', '3500k',
                        '-bufsize', '7000k',
                    ],
                    audioOptions: [
                        '-c:a', 'aac',
                        '-b:a', '128k',
                        '-ac', '2',
                        '-ar', '48000',
                    ],
                    subtitleOptions: []
                }
            case "360p_1mbps":
                return {
                    containerOptions: [],
                    videoOptions: [
                        '-vf', 'scale=-2:min(ih,360)',
                        '-b:v', '1000k',
                        '-maxrate', '1200k',
                        '-bufsize', '2400k',
                    ],
                    audioOptions: [
                        '-c:a', 'aac',
                        '-b:a', '128k',
                        '-ac', '2',
                        '-ar', '48000',
                    ],
                    subtitleOptions: []
                }
            case "240p_1mbps":
                return {
                    containerOptions: [],
                    videoOptions: [
                        '-vf', 'scale=-2:min(ih,240)',
                        '-b:v', '1000k',
                        '-maxrate', '1200k',
                        '-bufsize', '2400k',
                    ],
                    audioOptions: [
                        '-c:a', 'aac',
                        '-b:a', '96k',
                        '-ac', '2',
                        '-ar', '48000',
                    ],
                    subtitleOptions: []
                }
        }
    }
    throw Error(`Unable to determine quality args for ${profile} because hwaccl is undefined`);
}