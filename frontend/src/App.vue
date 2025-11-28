<template>
    <router-view/>
</template>

<script setup lang="ts">
import { inject, onMounted } from "vue";
import type { AxiosInstance } from "axios";
import { LOKI_TOKEN } from "./variables.ts";
import { CapabilityDetector } from "./lib/capability-detector.ts";
import type { ClientCapabilities } from "./types/client-capabilities.ts";

const axios = inject<AxiosInstance>('axios');

async function registerClient() {
    try {
        const existingToken = sessionStorage.getItem(LOKI_TOKEN);

        const detector = new CapabilityDetector();
        const capabilities: ClientCapabilities = await detector.detectCapabilities();

        const res = await axios?.post('/client/register', {
            token: existingToken || null,
            capabilities: capabilities
        });
        const token = res?.data?.token;

        if (token) {
            sessionStorage.setItem(LOKI_TOKEN, token);
        } else {
            console.error('Server did not send a valid token');
        }
    } catch (err) {
        console.error('Failed to register client:', err);
    }
}

onMounted(() => {
    registerClient();
})
</script>

<style lang="postcss" scoped>
@import "css/styles.css";
</style>
