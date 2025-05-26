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
                    :slides-per-view="3"
                    :slides-to-scroll="2"
                    gap="2rem"
                >
                    <template #slide-0>
                        <div class="w-full h-full bg-red-500 flex items-center justify-center text-white text-2xl">
                            1
                        </div>
                    </template>

                    <template #slide-1>
                        <div class="w-full h-full bg-green-500 flex items-center justify-center text-white text-2xl">
                            2
                        </div>
                    </template>

                    <template #slide-2>
                        <div class="w-full h-full bg-yellow-200 flex items-center justify-center text-white text-2xl">
                            3
                        </div>
                    </template>

                    <template #slide-3>
                        <div class="w-full h-full bg-blue-200 flex items-center justify-center text-white text-2xl">
                            4
                        </div>
                    </template>

                    <template #slide-4>
                        <div class="w-full h-full bg-purple-500 flex items-center justify-center text-white text-2xl">
                            5
                        </div>
                    </template>

                    <template #slide-5>
                        <div class="w-full h-full bg-yellow-900 flex items-center justify-center text-white text-2xl">
                            6
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
