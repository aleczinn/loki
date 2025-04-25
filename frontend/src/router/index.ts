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
        path: "/:pathMatch(.*)*",
        component: () => import('../views/PageNotFoundView.vue'),
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

export default router;