<template>
    <div class="flex flex-col h-screen">
        <loki-header></loki-header>

        <main class="flex-1 py-8 px-4">
            <div class="mx-auto max-w-[87rem]">
                <h1 class="text-3xl text-white mb-8">Media Library</h1>

                <!-- Media Grid -->
                <div v-if="!selectedMedia" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    <div v-for="media in mediaFiles" :key="media.id"
                         class="aspect-[16/9] flex flex-col cursor-pointer transition-transform duration-200 hover:scale-105"
                         @click="selectMedia(media)">

                        <div class="flex items-center justify-center bg-background-lightest rounded-lg w-full h-full">
                            <font-awesome-icon :icon="getMediaIcon(media.extension)" class="w-8 h-8 text-gray-darker"/>
                        </div>
                        <p class="mt-2 text-white text-sm truncate">{{ media.name }}</p>
                        <p class="text-xs text-gray">{{ formatFileSize(media.size) }} | {{media.extension}}</p>
                    </div>
                </div>

                <!-- Video Player -->
                <div v-else class="w-full">
                    <div class="flex items-center mb-4">
                        <button @click="closePlayer" class="text-white hover:text-primary mr-4">
                            <font-awesome-icon icon="arrow-left" class="text-xl"/>
                        </button>
                        <h2 class="text-xl text-white">{{ selectedMedia.name }}</h2>
                    </div>

                    <div class="aspect-video bg-black rounded-lg overflow-hidden">
                        <video-player
                            v-if="streamSession"
                            :session-id="streamSession.sessionId"
                            :playlist-url="streamSession.playlistUrl"
                        />
                    </div>
                </div>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, inject } from 'vue';
import { LokiHeader } from '../components/loki-header';
import { VideoPlayer } from '../components/video-player';
import type { AxiosInstance } from 'axios';
import type { MediaFile } from '../types/media';

const axios = inject<AxiosInstance>('axios');

const mediaFiles = ref<MediaFile[]>([]);
const selectedMedia = ref<MediaFile | null>(null);
const streamSession = ref<{ sessionId: string; playlistUrl: string } | null>(null);

const fetchMediaFiles = async () => {
    try {
        const response = await axios?.get('/media');
        mediaFiles.value = response?.data || [];
    } catch (error) {
        console.error('Failed to fetch media files:', error);
    }
};

const selectMedia = async (media: MediaFile) => {
    selectedMedia.value = media;

    try {
        const response = await axios?.post('/stream/start', {
            filePath: media.path
        });

        streamSession.value = response?.data;
    } catch (error) {
        console.error('Failed to start stream:', error);
        selectedMedia.value = null;
    }
};

const closePlayer = () => {
    selectedMedia.value = null;
    streamSession.value = null;
};

const getMediaIcon = (extension: string) => {
    const icons: { [key: string]: string } = {
        '.mp4': 'file-video',
        '.mkv': 'file-video',
        '.avi': 'file-video',
        '.mov': 'file-video',
        '.webm': 'file-video'
    };
    return icons[extension] || 'file';
};

const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

onMounted(() => {
    fetchMediaFiles();
});
</script>

<style scoped lang="postcss">

</style>