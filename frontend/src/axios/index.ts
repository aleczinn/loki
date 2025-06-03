import axios, { type AxiosInstance } from "axios";
import type { App } from 'vue';

interface AxiosOptions {
    baseURL?: string
    token?: string
}

let axiosInstance: AxiosInstance;

export default {
    install: (app: App, options: AxiosOptions = {}) => {
        axiosInstance = axios.create({
            baseURL: options.baseURL,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        // simple request interceptor for logging in development
        if (import.meta.env.DEV) {
            axiosInstance.interceptors.request.use(
                (config) => {
                    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
                    return config;
                },
                (error) => {
                    console.error('❌ Request Error:', error);
                    return Promise.reject(error);
                }
            );
        }

        // request interceptor for auth-token
        axiosInstance.interceptors.request.use(
            (config) => {
                const token = localStorage.getItem('authToken') || options.token;
                if (token && config.headers) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                return config;
            },
            (error) => {
                return Promise.reject(error);
            }
        );

        // response interceptor for error handling
        axiosInstance.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 503) {
                    console.error('Backend service unavailable');
                }
                if (error.response?.status === 401) {
                    // token expired/invalid
                    localStorage.removeItem('authToken');
                    // optional: redirect to log in
                }
                return Promise.reject(error);
            }
        );

        // for options api
        app.config.globalProperties.$axios = axiosInstance;

        // for composition api (inject)
        app.provide('axios', axiosInstance);
    }
};

export { axiosInstance };