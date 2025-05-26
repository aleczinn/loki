<template>
    <div class="flex flex-col h-screen">
        <loki-header></loki-header>

        <main class="flex-1 py-8">
            <div class="mx-auto max-w-[87rem]">
                <!-- ADD CONTENT HERE -->
                <p class="">asdas</p>

                <loki-carousel
                    :autoplay="true"
                    :autoplay-delay="4000"
                    :infinite="true "
                    transition-type="fade"
                    :show-dots="true"
                    :show-arrows="true"
                >
                    <template #slide-0>
                        <div class="w-full h-full bg-red-500 flex items-center justify-center text-white text-2xl">
                            Erste Slide
                        </div>
                    </template>

                    <template #slide-1>
                        <div class="w-full h-full bg-green-500 flex items-center justify-center text-white text-2xl">
                            Zweite Slide
                        </div>
                    </template>

                    <template #slide-2>
                        <div class="w-full h-full bg-yellow-200 flex items-center justify-center text-white text-2xl">
                            Dritter Slide
                        </div>
                    </template>
                </loki-carousel>
            </div>
        </main>

        <footer class="px-4 py-4 bg-background-darker">
            <p class="text-white">Footer</p>
        </footer>
    </div>
</template>

<script setup lang="ts">
import { inject } from "vue";
import { AxiosInstance } from "axios";
import { LokiHeader } from "@/components/loki-header";
import { LokiCarousel } from "@/components/loki-carousel";

const axios = inject<AxiosInstance>('axios');
</script>

<style scoped lang="postcss">
.container {
    @apply w-full h-full flex justify-center items-center;
}
</style>
