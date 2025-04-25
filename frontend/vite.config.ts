import {defineConfig, loadEnv} from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from "url";

export default ({mode}) => {
    process.env = {...process.env, ...loadEnv(mode, process.cwd())};

    // https://vitejs.dev/config/
    return defineConfig({
        server: {
            port: 8080
        },
        plugins: [
            vue(),
        ],
        resolve: {
            alias: [
                 { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
            ],
        },
        define: {
            __VUE_I18N_FULL_INSTALL__: true,
            __VUE_I18N_LEGACY_API__: false,
            __INTLIFY_PROD_DEVTOOLS__: false,
        },
        optimizeDeps: {
            include: [
                'vue',
                'vue-router'
            ]
        },
        css: {
            preprocessorOptions: {
                scss: {
                    silenceDeprecations: ["legacy-js-api"],
                }
            }
        }
    })
}