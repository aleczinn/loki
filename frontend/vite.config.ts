import { defineConfig, loadEnv, type ConfigEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default ({ mode }: ConfigEnv) => {
    process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };

    return defineConfig({
        plugins: [vue()],
        server: {
            port: 3000
        },
        optimizeDeps: {
            include: [
                'vue',
                'vue-router'
            ]
        },
    })
}