<template>
    <div class="flex flex-col h-screen">
        <header class="bg-background-darkest shadow-md shadow-background-darkest z-30 flex flex-row justify-between px-8 py-4">
            <!-- Mobile Items -->
            <div class="flex flex-row items-center md:hidden text-gray-darker">
                <font-awesome-icon icon="bars" class="text-xl duration-100 hover:text-white hover:cursor-pointer mr-4" @click="toggleSidebar"></font-awesome-icon>
            </div>

            <!-- Logo -->
            <router-link to="/" class="loki-logo-container">
                <img src="/images/test/logo-v1.png" alt="Logo">
            </router-link>

            <!-- Items -->
            <div class="flex flex-row items-center">
                <!-- Chromecast -->
                <a class="text-xl text-gray-darker duration-200 hover:text-white cursor-default hover:cursor-pointer mr-4">
                    <font-awesome-icon :icon="['fab', 'chromecast']" class=""></font-awesome-icon>
                </a>

                <!-- Search -->
                <a class="text-gray-darker duration-100 hover:text-white hover:cursor-pointer mr-4">
                    <font-awesome-icon icon="search" class=""></font-awesome-icon>
                </a>

                <!-- Profile picture -->
                <img src="/images/profile/geko.png" alt="profile" class="w-8 h-8 rounded-full hover:cursor-pointer">
            </div>
        </header>


        <main class="flex flex-row w-full h-full overflow-y-hidden">
            <loki-sidebar :open="sidebarOpen"></loki-sidebar>


        <div class="bg-background-lightest w-full h-full min-h-full md:rounded-tl-3xl overflow-y-auto p-8">
            <!-- TODO : Main content here -->



            <!-- Hero Image -->
            <div class="relative w-full h-[380px] overflow-hidden rounded-xl shadow-lg object-cover object-center mb-6">
                <loki-image src="/images/test/black-panther-background.jpg" class="w-full h-full object-cover object-center" style="user-select: none;"></loki-image>
                <div class="absolute top-0 left-0 bottom-0 right-0 banner-image"></div>

                <div class="absolute top-1/2 -translate-y-1/2 ml-8">
                    <h1 class="movie-title mb-8">Black Panther: Wakanda Forever</h1>

                    <div class="flex flex-row gap-2 mb-2">
                        <!-- Star-Rating -->
                        <div class="text-xs">
                            <font-awesome-icon icon="star" class="text-primary"></font-awesome-icon>
                            <font-awesome-icon icon="star" class="text-primary"></font-awesome-icon>
                            <font-awesome-icon icon="star" class="text-primary"></font-awesome-icon>
                            <font-awesome-icon icon="star" class="text-primary"></font-awesome-icon>
                            <font-awesome-icon icon="star-half" class="text-primary"></font-awesome-icon>
                        </div>

                        <div class="text-sm text-text">7.5</div>
                        <div class="rounded text-text bg-background-lightest px-1 py-0.5 text-xs font-medium">12+</div>
                        <div class="text-sm text-text">2h 42m</div>
                        <div class="text-sm text-text">2022</div>
                    </div>

                    <div class="movie-description">
                        Der König ist tot! König T'Challa, der als Black Panther auch Mitglied der Avengers-Heldentruppe war, stirbt an einer unbekannten Krankheit und ganz Wakanda ist in Trauer. Die Weltgemeinschaft sieht ihre Chance gekommen, um das vermeintlich geschwächte Königreich endlich zu Zugeständnissen bei der Lieferung des mächtigen Minerals Vibranium zu bewegen - und scheut dabei auch vor bewaffneten Überfällen nicht zurück. Doch Königin Ramonda bleibt standhaft und weist die Staatsoberhäupter in ihre Schranken. Wakanda wird auch ohne König T'Challa und den Black Panther weiter existieren und nicht vor anderen Nationen buckeln. Zur selben Zeit haben die USA mithilfe der erst 19 Jahre alten MIT-Studentin Riri Williams ein Gerät zur Aufspürung von Vibranium entwickelt und werden auch auf dem Grund des Meeres fündig. Angeführt von König Namor, bereitet sich das unter dem Meer lebende Volk der Talokanil aus dem Königreich Talokan darauf vor, einen Krieg mit den Landbewohnern zu beginnen.
                    </div>

                    <!-- Buttons -->
                    <div class="flex flex-row">
                        <a class="bg-primary duration-200 hover:bg-primary-darker text-text px-4 py-2 rounded hover:cursor-pointer flex items-center mr-4" href="#">
                            <font-awesome-icon icon="play" class="mr-4"></font-awesome-icon>
                            Abspielen
                        </a>

                        <a class="bg-transparent duration-200 hover:underline underline-offset-4 text-text px-4 py-2 rounded hover:cursor-pointer" href="#">
                            Mehr Details
                        </a>
                    </div>
                </div>
            </div>

            <!-- Movies -->
            <div class="flex items-center bg-background rounded-lg w-full h-12 px-4 my-8 shadow shadow-background">
                <h2 class="text-gray-lighter text-lg font-bold">Neu in Filme</h2>
            </div>

            <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 2xl:grid-cols-10 gap-4">
                <div v-for="movie in continueMovies" class="flex flex-col duration-200 hover:-translate-y-2 cursor-default hover:cursor-pointer">
                    <div class="aspect-w-2 aspect-h-3">
                        <img :src="movie.image" alt="" class="rounded-lg" loading="lazy">
                    </div>

                    <div class="flex flex-col justify-center px-1 py-2">
                        <p class="w-full text-xs text-white mb-0.5 truncate">{{ movie.name }}</p>
                        <p class="text-xs text-gray">{{ movie.publicationYear }}</p>
                    </div>
                </div>
            </div>

            <!-- Series -->
            <div class="flex items-center bg-background rounded-lg w-full h-12 px-4 my-8 shadow shadow-background">
                <h2 class="text-gray-lighter text-lg font-bold">Neu in Serien</h2>
            </div>

            <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 2xl:grid-cols-10 gap-4">
                <div v-for="movie in continueMovies" class="flex flex-col duration-200 hover:-translate-y-2 cursor-default hover:cursor-pointer">
                    <div class="aspect-w-2 aspect-h-3">
                        <img :src="movie.image" alt="" class="rounded-lg" loading="lazy">
                    </div>

                    <div class="flex flex-col justify-center px-1 py-2">
                        <p class="w-full text-xs text-white mb-0.5 truncate">{{ movie.name }}</p>
                        <p class="text-xs text-gray">{{ movie.publicationYear }}</p>
                    </div>
                </div>
            </div>
        </div>
        </main>

    </div>
</template>

<script setup lang="ts">
// import { inject } from "vue";
import { ref } from "vue";
import { LokiImage } from "../components/loki-image";
import { LokiSidebar } from "../components/loki-sidebar";
// import type { AxiosInstance } from "axios";
//
// const axios = inject<AxiosInstance>('axios');

const sidebarOpen = ref<boolean>(false);

const toggleSidebar = () => {
    sidebarOpen.value = !sidebarOpen.value;
    console.log("toggle to " + sidebarOpen.value);
}

const continueMovies = [
    {
        image: "/images/cover/avengers.jpg",
        name: "Avengers",
        publicationYear: "2022"
    },
    {
        image: "/images/cover/1917.jpg",
        name: "1917",
        publicationYear: "2021"
    },
    {
        image: "/images/cover/captain-marvel.jpg",
        name: "Captain Marvel",
        publicationYear: "2021"
    },
    {
        image: "/images/cover/casino-royale.jpg",
        name: "Casino Royal",
        publicationYear: "2021"
    },
    {
        image: "/images/cover/dark-knight.jpg",
        name: "The Dark Knight",
        publicationYear: "2021"
    },
    {
        image: "/images/cover/dune.jpg",
        name: "Dune",
        publicationYear: "2022"
    },
    {
        image: "/images/cover/ghost-in-the-shell.jpg",
        name: "Ghost in the Shell",
        publicationYear: "2017"
    },
    {
        image: "/images/cover/soul.jpg",
        name: "Soul",
        publicationYear: "2022"
    },
    {
        image: "/images/cover/venom.jpg",
        name: "Venom",
        publicationYear: "2021"
    },
    {
        image: "/images/cover/shang-chi.jpg",
        name: "Shang Shi: The Legend of the Ten Rings",
        publicationYear: "2022"
    }
]
</script>

<style scoped lang="postcss">
.sidebar {
    @apply absolute bg-background z-20 top-[4rem] bottom-0 overflow-y-auto p-8 w-full;
    @apply border-t-1 md:border-none border-t-background-lightest;
    @apply md:static invisible md:visible;
    left: -250px;
    max-width: 250px;
    transition: 300ms ease-in-out;

    &.active {
        @apply translate-x-[250px] md:transform-none visible;
    }
}

.sidebar::-webkit-scrollbar-thumb, .sidebar::-webkit-scrollbar-track {
    @apply bg-transparent;
}

.sidebar:is(:hover, :focus-within)::-webkit-scrollbar-thumb {
    @apply bg-background-lightest;
}

.sidebar-item {
    @apply flex flex-col;

    p {
        @apply text-white tracking-wide;
    }

    a {
        @apply text-text-darkest duration-200 hover:text-white mt-1;
    }
}

.banner-image {
    background-image: linear-gradient(90deg, hsl(220, 17%, 7%) 0%, hsla(220, 17%, 7%, 0.5) 100%);
}

.movie-title {
    @apply text-transparent font-bold uppercase;
    @apply text-3xl sm:text-4xl md:text-4xl lg:text-5xl;
    @apply font-loki;
    background: url('/images/wall-texture.jpg') repeat-x 100% 100%;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

.movie-description {
    @apply hidden sm:line-clamp-2 text-text-darker max-w-[50%] overflow-hidden mb-4;
}
</style>
