import axios from "axios";
import type { App } from 'vue';
import { LOKI_TOKEN } from "../variables.ts";

interface AxiosOptions {
    baseURL?: string;
}

export const axiosInstance = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json'
    },
    timeout: 10000
});

// Dev Logging
if (import.meta.env.DEV) {
    axiosInstance.interceptors.request.use(
        (config) => {
            console.log(`🚀 ${config.method?.toUpperCase()} ${config.url}`);
            return config;
        },
        (error) => {
            console.error('❌ Request Error:', error);
            return Promise.reject(error);
        }
    );
}

// Token-Interceptor
axiosInstance.interceptors.request.use(config => {
    if (!config.url?.includes('/client/register')) {
        const token = sessionStorage.getItem(LOKI_TOKEN);
        if (token) {
            config.headers['X-Client-Token'] = token;
        }
    }
    return config;
});

// Error Handling
axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 &&
            error.response?.data?.code === 'INVALID_CLIENT_TOKEN') {
            console.error('Invalid client token');
            sessionStorage.removeItem(LOKI_TOKEN);
        }
        return Promise.reject(error);
    }
);

// Vue-Plugin
export default {
    install: (app: App, options: AxiosOptions = {}) => {
        if (options.baseURL) {
            axiosInstance.defaults.baseURL = options.baseURL;
        }
        // for options api
        app.config.globalProperties.$axios = axiosInstance;

        // for composition api (inject)
        app.provide('axios', axiosInstance);
    }
};