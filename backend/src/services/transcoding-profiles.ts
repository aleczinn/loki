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

                    ],
                    audioOptions: [

                    ],
                    subtitleOptions: []
                }
            case "4k_20mbps":
                return {
                    containerOptions: [],
                    videoOptions: [

                    ],
                    audioOptions: [

                    ],
                    subtitleOptions: []
                }
            case "1080p_20mbps":
                return {
                    containerOptions: [],
                    videoOptions: [

                    ],
                    audioOptions: [

                    ],
                    subtitleOptions: []
                }
            case "1080p_8mbps":
                return {
                    containerOptions: [],
                    videoOptions: [

                    ],
                    audioOptions: [

                    ],
                    subtitleOptions: []
                }
            case "720p_6mbps":
                return {
                    containerOptions: [],
                    videoOptions: [

                    ],
                    audioOptions: [

                    ],
                    subtitleOptions: []
                }
            case "480p_3mbps":
                return {
                    containerOptions: [],
                    videoOptions: [

                    ],
                    audioOptions: [

                    ],
                    subtitleOptions: []
                }
            case "360p_1mbps":
                return {
                    containerOptions: [],
                    videoOptions: [

                    ],
                    audioOptions: [

                    ],
                    subtitleOptions: []
                }
        }
    }
    throw Error(`Unable to determine quality args for ${profile} because hwaccl is undefined`);
}