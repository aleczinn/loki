<template>
    <div class="flex flex-col h-screen">
        <header class="text-gray w-full flex items-center justify-between fixed top-0 px-4 py-2 bg-transparent backdrop-blur z-30 shadow-lg shadow-streaming-shadow-light">
            <div class="flex flex-row items-center md:hidden">
                <font-awesome-icon icon="bars" class="duration-100 hover:text-white text-xl mr-4"></font-awesome-icon>
                <router-link to="/">
                    <font-awesome-icon icon="home" class="duration-100 hover:text-white mr-4"></font-awesome-icon>
                </router-link>
                <font-awesome-icon icon="arrow-left" class="invisible duration-100 hover:text-white text-xl"></font-awesome-icon>
            </div>

            <div class="text-3xl font-semibold uppercase text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-lightest">LOKI</div>

            <nav class="uppercase text-base text-gray-lighter hidden md:block">
                <ul>
                    <li class="inline-block mx-4">
                        <router-link to="/" class="duration-100 hover:text-primary-lighter">{{$t("navbar.home")}}</router-link>
                    </li>
                    <li class="inline-block mx-4">
                        <router-link to="/live" class="duration-100 hover:text-primary-lighter">{{$t("navbar.live")}}</router-link>
                    </li>
                    <li class="inline-block mx-4">
                        <router-link to="/movies" class="duration-100 hover:text-primary-lighter">{{$t("navbar.movies")}}</router-link>
                    </li>
                    <li class="inline-block mx-4">
                        <router-link to="/series" class="duration-100 hover:text-primary-lighter">{{$t("navbar.series")}}</router-link>
                    </li>
                    <li class="inline-block mx-4">
                        <router-link to="/images" class="duration-100 hover:text-primary-lighter">{{$t("navbar.images")}}</router-link>
                    </li>
                    <li class="inline-block mx-4">
                        <router-link to="/watchlist" class="duration-100 hover:text-primary-lighter">{{$t("navbar.watchlist")}}</router-link>
                    </li>
                    <li class="inline-block mx-4">
                        <router-link to="/test" class="duration-100 hover:text-primary-lighter">TESTING</router-link>
                    </li>
                </ul>
            </nav>

            <div class="flex items-center justify-center">
                <a class="text-lg text-gray hover:text-white cursor-default hover:cursor-pointer duration-100 hover:scale-105 mr-4">
                    <font-awesome-icon :icon="['fab', 'chromecast']" class=""></font-awesome-icon>
                </a>

                <a class="text-lg text-gray hover:text-white cursor-default hover:cursor-pointer duration-100 hover:scale-105 mr-4">
                    <font-awesome-icon icon="search" class=""></font-awesome-icon>
                </a>
                <img src="/images/profile/geko.png" alt="" class="w-7 h-7 rounded-full">
            </div>
        </header>

        <main class="flex-1">
            <section class="bg-cover bg-center w-full h-screen"
                     :style="{backgroundImage: `url(/images/content/endgame/endgame-5.jpg)`}">
                <div class="w-full h-screen" style="background: linear-gradient(to right, rgba(34, 31, 31, 1) 0%, rgba(34, 31, 31, 0.4) 100%);">
                    <div class="flex flex-col justify-center w-full h-full mx-auto max-w-loki">
                        <!-- Movie title -->
                        <h1 class="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl text-transparent font-semibold uppercase big-title">Avengers Endgame</h1>

                        <!-- Rating line -->
                        <div class="my-2 flex flex-row items-center">
                            <div class="text-xs">
                                <font-awesome-icon icon="star" class="text-primary"></font-awesome-icon>
                                <font-awesome-icon icon="star" class="text-primary"></font-awesome-icon>
                                <font-awesome-icon icon="star" class="text-primary"></font-awesome-icon>
                                <font-awesome-icon icon="star-half" class="text-primary"></font-awesome-icon>
                            </div>

                            <div class="text-sm text-white mr-4">4.7 (IMDb)</div>
                            <div class="rounded bg-gray-darkest px-1 py-0.5 text-xs font-medium text-white mr-4">12</div>
                            <div class="text-sm text-gray-lighter mr-4">3h 1m</div>
                            <div class="text-sm text-gray-lighter">2019</div>
                        </div>

                        <!-- Movie description -->
                        <div class="text-sm w-full sm:w-[40%] text-gray leading-normal my-8 max-h-[9rem] description-overflow">
                            Thanos hat also tatsächlich Wort gehalten, seinen Plan in die Tat umgesetzt und die Hälfte allen Lebens im Universum ausgelöscht. Die Avengers sind Machtlos. Iron Man und Nebula sitzen auf dem Planeten Titan fest, während auf der Erde absolutes Chaos herrscht. Doch dann finden Captain America und die anderen überlebenden Helden auf der Erde heraus, dass Nick Fury vor den verheerenden Ereignissen gerade noch ein Notsignal absetzen konnte, um Verstärkung auf den Plan zu rufen. Die Superhelden-Gemeinschaft bekommt mit Captain Marvel kurzerhand tatkräftige Unterstützung im Kampf gegen ihren vermeintlich übermächtigen Widersacher. Und dann ist da auch noch Ant-Man, der wie aus dem Nichts auftaucht und sich der Truppe erneut anschließt, um die ganze Sache womöglich doch noch zu einem guten Ende zu bringen
                        </div>

                        <!-- Movie details-->
                        <div class="mb-8">
                            <div class="text-gray-lighter font-light text-ellipsis overflow-hidden whitespace-nowrap"><span class="font-bold text-primary-lighter uppercase mr-2">Regie:</span>Anthony Russo, Joe Russo</div>
                            <div class="text-gray-lighter font-light text-ellipsis overflow-hidden whitespace-nowrap"><span class="font-bold text-primary-lighter uppercase mr-2 text-ellipsis overflow-hidden">Hauptrollen:</span>Robert Downey Jr., Chris Evans, Mark Ruffalo</div>
                            <div class="text-gray-lighter font-light text-ellipsis overflow-hidden whitespace-nowrap"><span class="font-bold text-primary-lighter uppercase mr-2">Genre:</span>Action, Abenteuer, Science Fiction, Drama</div>
                        </div>

                        <!-- Play/Details button -->
                        <div class="flex flex-row gap-4">
                            <a href="#" class="font-medium px-4 py-2 relative rounded group overflow-hidden bg-gray-lightest text-black flex items-center">
                                <span class="absolute top-0 left-0 flex w-0 h-full mb-0 transition-all duration-200 ease-out transform translate-y-0 bg-primary group-hover:w-full opacity-90"></span>
                                <span class="relative group-hover:text-white">
               <font-awesome-icon icon="play" class="mr-4"></font-awesome-icon>
              Abspielen
            </span>
                            </a>

                            <a class="font-medium text-white duration-100 hover:text-primary-lighter px-4 py-2 cursor-default hover:cursor-pointer">Mehr Details</a>
                        </div>
                    </div>
                </div>
            </section>

            <div class="mx-auto max-w-loki py-4">
                <section class="py-8">
                    <h2 class="uppercase text-gray-lighter text-lg border-l-4 border-primary-lighter pl-2">Fortsetzen</h2>
                    <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 2xl:grid-cols-12 gap-x-2 sm:gap-x-4 gap-y-2 py-4">
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
                </section>

                <section class="py-8">
                    <h2 class="uppercase text-gray-lighter text-lg border-l-4 border-primary-lighter pl-2">Meine Merkliste</h2>
                    <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 2xl:grid-cols-12 gap-x-2 sm:gap-x-4 gap-y-2 py-4">
                        <!--                    <s-movie :image="movie.image" :name="movie.name" :year="movie.publicationYear" v-for="movie in watchlistMovies"></s-movie>-->

                        <div v-for="movie in watchlistMovies" class="flex flex-col duration-200 hover:-translate-y-2 cursor-default hover:cursor-pointer">
                            <div class="aspect-w-2 aspect-h-3">
                                <img :src="movie.image" alt="" class="rounded-lg" loading="lazy">
                            </div>

                            <div class="flex flex-col justify-center px-1 py-2">
                                <p class="w-full text-xs text-white mb-0.5 truncate">{{ movie.name }}</p>
                                <p class="text-xs text-gray">{{ movie.publicationYear }}</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section class="py-8">
                    <h2 class="uppercase text-gray-lighter text-lg border-l-4 border-primary-lighter pl-2">Kürzlich hinzugefügt</h2>
                    <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 2xl:grid-cols-12 gap-x-2 sm:gap-x-4 gap-y-2 py-4">
                        <!--                    <s-movie :image="movie.image" :name="movie.name" :year="movie.publicationYear" v-for="movie in newMovies"></s-movie>-->
                        <div v-for="movie in newMovies" class="flex flex-col duration-200 hover:-translate-y-2 cursor-default hover:cursor-pointer">
                            <div class="aspect-w-2 aspect-h-3">
                                <img :src="movie.image" alt="" class="rounded-lg" loading="lazy">
                            </div>

                            <div class="flex flex-col justify-center px-1 py-2">
                                <p class="w-full text-xs text-white mb-0.5 truncate">{{ movie.name }}</p>
                                <p class="text-xs text-gray">{{ movie.publicationYear }}</p>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </main>

        <footer class="">
            <p class="text-center py-4 text-xs text-gray bg-background-darker">Copyright © 2025 by <span class="font-bold">Alec</span>. All Rights Reserved.</p>
        </footer>
    </div>
</template>

<script setup lang="ts">
// import { inject } from "vue";
// import type { AxiosInstance } from "axios";
//
// const axios = inject<AxiosInstance>('axios');

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
    },
    {
        image: "/images/cover/rot.jpg",
        name: "Rot",
        publicationYear: "2021"
    },
    {
        image: "/images/cover/panther.jpg",
        name: "Black Panther",
        publicationYear: "2018"
    }
]

const watchlistMovies = [
    {
        image: "/images/cover/interstellar.jpg",
        name: "Interstellar",
        publicationYear: "2021"
    },
    {
        image: "/images/cover/minions.jpg",
        name: "Minions",
        publicationYear: "2021"
    },
    {
        image: "/images/cover/minions-2.jpg",
        name: "Minions: Auf der Suche nach dem Mini-Boss",
        publicationYear: "2021"
    },
    {
        image: "/images/cover/ww84.jpg",
        name: "Wonder Woman",
        publicationYear: "2018"
    },
    {
        image: "/images/cover/spider-man.jpg",
        name: "Spider-Man: Homecoming",
        publicationYear: "2018"
    },
    {
        image: "/images/cover/matrix.jpg",
        name: "Matrix: Resurrections",
        publicationYear: "2021"
    },
    {
        image: "/images/cover/LOTR.jpg",
        name: "Der Herr der Ringe",
        publicationYear: "2021"
    },
    {
        image: "/images/cover/gladiator.jpg",
        name: "Gladiator",
        publicationYear: "2021"
    },
    {
        image: "/images/cover/eternals.jpg",
        name: "Eternals",
        publicationYear: "2022"
    },
    {
        image: "/images/cover/dunkirk.jpg",
        name: "Dunkirk",
        publicationYear: "2022"
    },
    {
        image: "/images/cover/saving-private-ryan.jpg",
        name: "Der Soldat James Ryan",
        publicationYear: "2022"
    },
    {
        image: "/images/cover/red-notice.jpg",
        name: "Red Notice",
        publicationYear: "2021"
    }
]

const newMovies = [
    {
        image: "/images/cover/red-notice.jpg",
        name: "Red Notice",
        publicationYear: "2021"
    },
    {
        image: "/images/cover/doctor-strange.jpg",
        name: "Doctor Strange: Into the Multiverse of Madness",
        publicationYear: "2022"
    },
    {
        image: "/images/cover/avatar.jpg",
        name: "Avatar",
        publicationYear: "2022"
    },
    {
        image: "/images/cover/smile.jpg",
        name: "Smile",
        publicationYear: "2022"
    },
    {
        image: "/images/cover/spider-man-no-way-home.jpg",
        name: "Spider-Man: No Way Home",
        publicationYear: "2022"
    },
    {
        image: "/images/cover/jumanji.jpg",
        name: "Jumanji: Willkommen im Dschungel",
        publicationYear: "2022"
    },
    {
        image: "/images/cover/troja.jpg",
        name: "Troja",
        publicationYear: "2022"
    },
    {
        image: "/images/cover/rambo.jpg",
        name: "Rambo",
        publicationYear: "2022"
    },
    {
        image: "/images/cover/wolf-of-wallstreet.jpg",
        name: "Wolf of Wallstreet",
        publicationYear: "2022"
    },
    {
        image: "/images/cover/spider-man-far-from-home.jpg",
        name: "Spider-Man: Far from Home",
        publicationYear: "2022"
    },
    {
        image: "/images/cover/john-wick-3.jpg",
        name: "John Wick 3",
        publicationYear: "2022"
    },
    {
        image: "/images/cover/conan.jpg",
        name: "Conan",
        publicationYear: "2022"
    }
]
</script>

<style scoped lang="postcss">
.container {
    @apply w-full h-full flex justify-center items-center;
}

.big-title {
    background: url('/images/wall-texture.jpg') repeat-x 100% 100%;
    color: transparent;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

.description-overflow {
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
}
</style>
