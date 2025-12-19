import { ClientCapabilities } from "./capabilities/client-capabilities";

export interface ClientInfo {
    token: string;
    capabilities: ClientCapabilities;
    createdAt: Date;
    lastSeen: Date;
}