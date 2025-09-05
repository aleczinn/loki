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
        component: () => import('../views/TESTING/HomeView.vue'),
    },
    {
        path: "/test1",
        name: "Test1",
        component: () => import('../views/TESTING/IdeaViewOne.vue'),
    },
    {
        path: "/test2",
        name: "Test2",
        component: () => import('../views/TESTING/IdeaViewTwo.vue'),
    },
    {
        path: "/media",
        name: "MediaLibrary",
        component: () => import('../views/TESTING/MediaLibraryView.vue'),
    },
    {
        path: "/sandbox",
        name: "Sandbox",
        component: () => import('../views/TESTING/SandboxView.vue'),
    },
    {
        path: "/styling",
        name: "Styling",
        component: () => import('../views/TESTING/StylingView.vue'),
    },
    {
        path: "/:pathMatch(.*)*",
        component: () => import('../views/TESTING/PageNotFoundView.vue'),
    }
];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
});

export default router;