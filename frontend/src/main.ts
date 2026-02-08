import './css/styles.css'
import { createApp } from 'vue'
import App from './App.vue'
import router from "./router"
import i18n from "./i18n";
import axios from './axios';

// Font Awesome
import { library } from '@fortawesome/fontawesome-svg-core';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { far } from '@fortawesome/free-regular-svg-icons';
import { fab } from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon} from "@fortawesome/vue-fontawesome";
import { initializeClient } from "./client-init.ts";

library.add(fas, far, fab);

async function bootstrap() {
    try {
        await initializeClient();

        const app = createApp(App);
        app.use(router);
        app.use(i18n);
        app.use(axios, {
            baseURL: '/api'
        });
        app.component('font-awesome-icon', FontAwesomeIcon)
        app.mount('#app');
    } catch (error) {
        console.error('Initialization failed!', error);

        document.getElementById('app')!.innerHTML = `
            <div class="flex flex-col justify-center items-center h-screen">
                <h1 class="text-white font-bold text-2xl mb-2">Verbindung fehlgeschlagen</h1>
                <p class="text-white">Der Client konnte nicht initialisiert werden.</p>
                <button onclick="location.reload()" class="text-white bg-primary rounded-lg" style="margin-top: 20px; padding: 10px 20px; cursor: pointer;">
                    Erneut versuchen
                </button>
            </div>
        `;
    }
}

bootstrap();