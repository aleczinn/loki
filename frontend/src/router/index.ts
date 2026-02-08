import {createRouter, createWebHistory} from 'vue-router';

const routes = [
    {
        path: "/",
        name: "Login",
        component: () => import('../views/LoginView.vue'),
    },
    {
        path: "/home",
        name: "Home",
        component: () => import('../views/HomeView.vue'),
    },
    {
        path: "/styleguide",
        name: "Styleguide",
        component: () => import('../views/testing/StyleguideView.vue'),
    },
    {
        path: "/:pathMatch(.*)*",
        component: () => import('../views/PageNotFoundView.vue'),
    }
];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
});

export default router;