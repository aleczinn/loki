import { ClientCapabilities } from "./client-capabilities";

export interface ClientInfo {
    token: string;
    userAgent: string;
    browser: string;
    browserVersion: number;
    platform: string;
    createdAt: Date;
    lastSeen: Date;
    capabilities: ClientCapabilities;
}