<template>
    <div class="flex flex-col h-screen">
        <loki-header></loki-header>

        <main class="flex-1 py-8">
            <div class="mx-auto max-w-[87rem]">
                <!-- ADD CONTENT HERE -->
                <p class="">Carousel's</p>

                <loki-carousel
                    :autoplay-delay="-1"
                    :infinite="true"
                    transition-type="slide"
                    height="auto"
                    :dots="true"
                    :arrows="true"
                    :slides-per-view="1"
                    :slides-to-scroll="1"
                    :draggable="true"
                    class="mb-8"
                >
                    <div class="aspect-w-16 aspect-h-3">
                        <div class="w-full h-full bg-red-500 flex items-center justify-center text-white text-2xl">
                            1
                        </div>
                    </div>

                    <div class="aspect-w-16 aspect-h-3">
                        <div class="w-full h-full bg-green-500 flex items-center justify-center text-white text-2xl">
                            2
                        </div>
                    </div>

                    <div class="aspect-w-16 aspect-h-3">
                        <div class="w-full h-full bg-yellow-500 flex items-center justify-center text-white text-2xl">
                            3
                        </div>
                    </div>

                    <div class="aspect-w-16 aspect-h-3">
                        <div class="w-full h-full bg-blue-500 flex items-center justify-center text-white text-2xl">
                            4
                        </div>
                    </div>

                    <div class="aspect-w-16 aspect-h-3">
                        <div class="w-full h-full bg-purple-500 flex items-center justify-center text-white text-2xl">
                            5
                        </div>
                    </div>
                </loki-carousel>

                <loki-carousel
                    :autoplay-delay="-1"
                    :infinite="true"
                    transition-type="slide"
                    height="auto"
                    :dots="true"
                    :arrows="true"
                    :slides-per-view="2"
                    :slides-to-scroll="1"
                    :draggable="true"
                    class="mb-8"
                >
                    <div class="aspect-w-16 aspect-h-3">
                        <div class="w-full h-full bg-red-500 flex items-center justify-center text-white text-2xl">
                            1
                        </div>
                    </div>

                    <div class="aspect-w-16 aspect-h-3">
                        <div class="w-full h-full bg-green-500 flex items-center justify-center text-white text-2xl">
                            2
                        </div>
                    </div>

                    <div class="aspect-w-16 aspect-h-3">
                        <div class="w-full h-full bg-yellow-500 flex items-center justify-center text-white text-2xl">
                            3
                        </div>
                    </div>
                </loki-carousel>

                <loki-carousel
                    :autoplay-delay="-1"
                    :infinite="true"
                    transition-type="slide"
                    height="auto"
                    :dots="true"
                    :arrows="true"
                    :slides-per-view="1"
                    :slides-to-scroll="1"
                    gap="2rem"
                    class="mb-8"
                    :responsive="{
                        lg: {
                            slidesPerView: 2
                        }
                    }"
                >
                    <div class="aspect-w-16 aspect-h-3">
                        <div class="w-full h-full bg-red-500 flex items-center justify-center text-white text-2xl">
                            1
                        </div>
                    </div>

                    <div class="aspect-w-16 aspect-h-3">
                        <div class="w-full h-full bg-green-500 flex items-center justify-center text-white text-2xl">
                            2
                        </div>
                    </div>

                    <div class="aspect-w-16 aspect-h-3">
                        <div class="w-full h-full bg-yellow-500 flex items-center justify-center text-white text-2xl">
                            3
                        </div>
                    </div>

                    <div class="aspect-w-16 aspect-h-3">
                        <div class="w-full h-full bg-blue-500 flex items-center justify-center text-white text-2xl">
                            4
                        </div>
                    </div>

                    <div class="aspect-w-16 aspect-h-3">
                        <div class="w-full h-full bg-purple-500 flex items-center justify-center text-white text-2xl">
                            5
                        </div>
                    </div>
                </loki-carousel>
            </div>
        </main>

        <footer class="px-4 py-4 bg-background-darker">
            <p class="text-white">Footer</p>
        </footer>
    </div>
</template>

<script setup lang="ts">
// import { inject } from "vue";
import { LokiHeader } from "../components/loki-header";
import { LokiCarousel } from "../components/loki-carousel";
// import type { AxiosInstance } from "axios";
//
// const axios = inject<AxiosInstance>('axios');
</script>

<style scoped lang="postcss">
.container {
    @apply w-full h-full flex justify-center items-center;
}
</style>
