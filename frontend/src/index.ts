import {createApp} from 'vue'
import App from './App.vue'
import router from "./router"
import i18n from "./i18n";

import axios from './axios';

import './css/global.css'

const BASE_URL_DEV = '';
const BASE_URL_PROD = '';

const app = createApp(App);
app.use(router);
app.use(i18n);
app.use(axios, {
    baseUrl: process.env.NODE_ENV === "production" ? BASE_URL_PROD : BASE_URL_DEV,
    token: ''
});
app.provide('axios', app.config.globalProperties.axios);
app.mount('#app');