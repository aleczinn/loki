import { ClientCapabilities } from "./capabilities/client-capabilities";

export interface ClientInfo {
    token: string;
    createdAt: Date;
    lastSeen: Date;
    capabilities: ClientCapabilities;
}