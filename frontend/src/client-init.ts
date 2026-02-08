import { axiosInstance } from "./axios";
import { LOKI_TOKEN } from "./variables.ts";
import { CapabilityDetector } from "./lib/capability-detector.ts";

let isClientInitialized = false;

export async function initializeClient(): Promise<string> {
    if (isClientInitialized) {
        const token = sessionStorage.getItem(LOKI_TOKEN);

        if (token) {
            return token;
        }
    }

    const existingToken = sessionStorage.getItem(LOKI_TOKEN);
    const detector = new CapabilityDetector();
    const capabilities = await detector.detectCapabilities();

    const response = await axiosInstance.post('/client/register', {
        token: existingToken || null,
        capabilities
    });

    const newToken = response.data.token;

    if (!newToken) {
        throw new Error('Server returned no valid token');
    }

    sessionStorage.setItem(LOKI_TOKEN, newToken);
    isClientInitialized = true;

    return newToken;
}

export function getClientToken(): string | null {
    return sessionStorage.getItem(LOKI_TOKEN);
}

export function isClientReady(): boolean {
    return isClientInitialized && !!sessionStorage.getItem(LOKI_TOKEN);
}