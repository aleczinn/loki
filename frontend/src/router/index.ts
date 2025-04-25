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
        path: "/test1",
        name: "Test1",
        component: () => import('../views/IdeaViewOne.vue'),
    },
    {
        path: "/test2",
        name: "Test2",
        component: () => import('../views/IdeaViewTwo.vue'),
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