import { generateToken } from "../utils/utils";
import { ClientInfo } from "../types/client-info";
import { BrowserFactory } from "../browser/browser-factory";
import { ClientCapabilities } from "../types/client-capabilities";
import { Browser } from "../browser/browser";

class UserManager {

    private clients: Map<string, ClientInfo> = new Map();

    registerClient(token: string | null, userAgent: string): string {
        const browser: Browser = BrowserFactory.create(userAgent);
        const capabilities: ClientCapabilities = this.extractCapabilities(browser, userAgent);

        if (!token) {
            token = generateToken();
        }

        if (this.clients.has(token)) {
            this.updateClientCapabilities(token, capabilities);
            console.log("Update client capabilities for client " + token);
        } else {
            const clientInfo: ClientInfo = {
                token,
                userAgent,
                browser: browser.getName(),
                browserVersion: browser.getVersion(),
                platform: browser.getPlatform(),
                createdAt: new Date(),
                lastSeen: new Date(),
                capabilities
            };

            this.clients.set(token, clientInfo);

            console.log("Register new client with token " + token);
        }
        return token;
    }

    getClient(token: string): ClientInfo | undefined {
        const client = this.clients.get(token);
        if (client) {
            client.lastSeen = new Date();
        }
        return client;
    }

    getClients(): Map<string, ClientInfo> {
        return this.clients;
    }

    updateClientCapabilities(token: string, capabilities: Partial<ClientCapabilities>): void {
        const client = this.clients.get(token);

        if (client) {
            client.capabilities = { ...client.capabilities, ...capabilities };
            client.lastSeen = new Date();
        }
    }

    private extractCapabilities(browser: Browser, userAgent: string): ClientCapabilities {
        return {
            containers: browser.getContainer(),
            videoCodecs: browser.getVideoCodecs(),
            audioCodecs: browser.getAudioCodecs(),
            maxResolution: this.detectMaxResolution(userAgent),
            supportsDolbyVision: browser.supportsDolbyVision(),
            supportsHDR10: browser.supportsHDR10(),
            supportsHDR10Plus: browser.supportsHDR10Plus(),
            supportsDirectPlay: true, // Will be refined based on actual codec support
            supportsDirectStream: true
        };
    }

    private detectMaxResolution(userAgent: string): string {
        return '1080p';
    }
}

const userManager = new UserManager();

export default userManager;
export { UserManager };