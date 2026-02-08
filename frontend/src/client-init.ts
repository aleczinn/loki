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

    const response = await axiosInstance.post('/client/register', {
        token: existingToken || null,
        capabilities: detector.getMinimalCapabilities()
    });

    const newToken = response.data.token;

    if (!newToken) {
        throw new Error('Server returned no valid token');
    }

    sessionStorage.setItem(LOKI_TOKEN, newToken);
    isClientInitialized = true;


    detectFullCapabilities(newToken, detector);

    return newToken;
}

async function detectFullCapabilities(token: string, detector: CapabilityDetector) {
    try {
        console.log('Detecting full capabilities now...');
        const capabilities = await detector.detectCapabilities();

        await axiosInstance.post('/client/update', {
            token,
            capabilities
        });

        console.log('Updated capabilities!');
    } catch (error) {
        console.warn('Failed to update full capabilities:', error);
    }
}

export function getClientToken(): string | null {
    return sessionStorage.getItem(LOKI_TOKEN);
}

export function isClientReady(): boolean {
    return isClientInitialized && !!sessionStorage.getItem(LOKI_TOKEN);
}