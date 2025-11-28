import { generateToken } from "../utils/utils";
import { ClientInfo } from "../types/client-info";
import { ClientCapabilities } from "../types/capabilities/client-capabilities";

class ClientManager {

    private clients: Map<string, ClientInfo> = new Map();

    registerClient(token: string | null, capabilities: ClientCapabilities): string {
        if (!token) {
            token = generateToken();
        }

        if (this.clients.has(token)) {
            this.updateClientCapabilities(token, capabilities);
            console.log("Update client capabilities for client " + token);
        } else {
            const clientInfo: ClientInfo = {
                token,
                capabilities,
                createdAt: new Date(),
                lastSeen: new Date()
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
}

const clientManager = new ClientManager();

export default clientManager;
export { ClientManager };