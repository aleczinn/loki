import { createApp } from 'vue'
import './css/global.css'

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

library.add(fas, far, fab);

const app = createApp(App);
app.use(router);
app.use(i18n);
app.use(axios, {
    baseURL: '/api'
});
app.component('font-awesome-icon', FontAwesomeIcon)
app.mount('#app');