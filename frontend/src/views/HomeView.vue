<template>
    <div class="flex flex-col h-screen">
        <!--        <img src="/images/the-purge-anarchy-bg.jpg" alt="" class="aspect-w-16 aspect-h-9">-->

        <loki-header></loki-header>

        <main class="flex-1 py-8">
            <div class="mx-auto max-w-[87rem]">
                <!-- ADD CONTENT HERE -->
                <h3 class="font-bold mb-2">Media Files</h3>


                <div class="flex flex-col">
                    <a v-for="media in mediaFiles" :key="media.id" @click="selectMedia(media)"
                       class="transition-all duration-200 hover:cursor-pointer hover:ml-4">
                        > {{ media.name }} <span class="text-gray-500">({{ formatFileSize(media.size) }})</span>
                    </a>
                </div>

                <hr class="my-8">
                <p v-if="selectedMedia">Selected: {{ selectedMedia.name }}</p>
                <hr>
                <div class="w-full max-w-4xl mx-auto">
                    <video
                        ref="videoRef"
                        class="w-full rounded shadow-lg"
                        controls
                        autoplay
                    ></video>
                </div>
            </div>
        </main>

        <footer class="px-4 py-4 bg-background-darker">
            <p class="text-white">Footer</p>
        </footer>
    </div>
</template>

<script setup lang="ts">
import { inject, onMounted, ref } from "vue";
import { LokiHeader } from "../components/loki-header";
import type { AxiosInstance } from "axios";
import Hls from "hls.js";

const axios = inject<AxiosInstance>('axios');

interface MediaFile {
    id: string;
    name: string;
    path: string;
    size: number;
    modified: Date;
}

const isLoading = ref(true);
const hls = ref<Hls | null>(null)
const mediaFiles = ref<MediaFile[]>([]);
const selectedMedia = ref<MediaFile | null>(null);
const videoRef = ref<HTMLVideoElement | null>(null)

const loadMediaFiles = async () => {
    isLoading.value = true;

    try {
        const response = await axios?.get<MediaFile[]>('/media');
        mediaFiles.value = response?.data || [];
        console.log(response);
    } catch (err) {
        console.error('Failed to load media files:', err);
    } finally {
        isLoading.value = false;
    }
}

const selectMedia = (media: MediaFile) => {
    selectedMedia.value = media;
    initHls(streamUrl());
}

const streamUrl = () => {
    if (!selectedMedia.value) return '';
    return `/api/media/${selectedMedia.value.id}/stream`;
};

function initHls(url: string) {
    if (hls.value) {
        hls.value.destroy()
        hls.value = null
    }

    if (videoRef.value) {
        if (Hls.isSupported()) {
            hls.value = new Hls()
            hls.value.loadSource(url)
            hls.value.attachMedia(videoRef.value)
            hls.value.on(Hls.Events.MANIFEST_PARSED, () => {
                videoRef.value!.play()
            })
        } else if (videoRef.value.canPlayType('application/vnd.apple.mpegurl')) {
            videoRef.value.src = url
            videoRef.value.play()
        }
    }
}

function formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(size < 10 ? 1 : 0)} ${units[unitIndex]}`;
}

onMounted(() => {
    loadMediaFiles();
})
</script>

<style scoped lang="postcss">

</style>
