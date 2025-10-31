export interface ClientCapabilities {
    containers: string[];
    videoCodecs: string[];
    audioCodecs: string[];
    maxResolution: string;
    supportsDolbyVision: boolean;
    supportsHDR10: boolean;
    supportsHDR10Plus: boolean;
}