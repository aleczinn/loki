import axios from "axios";
import type {App} from 'vue';

interface AxiosOptions {
    baseUrl?: string
    token?: string
}

export default {
    install: (app: App, options: AxiosOptions) => {
        app.config.globalProperties.$axios = axios.create({
            baseURL: options.baseUrl,
            headers: {
                'Content-Type': 'application/json',
                Authorization: options.token ? `Bearer ${options.token}` : '',
            },
            timeout: 10000 // 10-second timeout
        })
    }
}

