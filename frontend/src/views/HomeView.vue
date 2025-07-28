<template>
    <div class="flex flex-col h-screen">
        <!--        <img src="/images/the-purge-anarchy-bg.jpg" alt="" class="aspect-w-16 aspect-h-9">-->

        <loki-header></loki-header>

        <main class="flex-1 py-8">
            <div class="mx-auto max-w-[87rem]">
                <!-- ADD CONTENT HERE -->
                <h3 class="font-bold mb-2">Media Files</h3>


                <div class="flex flex-col mb-4">
                    <a v-for="media in mediaFiles" :key="media.name" @click="selectMedia(media)"
                       class="transition-all duration-200 hover:cursor-pointer hover:ml-4">
                        > {{ media.name }} <span class="text-gray-500">({{
                            formatFileSize(media.size)
                        }}) ({{ getVideoFormat(media) }}) ({{ getMainAudioTrack(media) }})</span>
                    </a>
                </div>

                <p class="font-bold mb-4">Selected: <span class="font-normal">{{ selectedMedia ? selectedMedia.name : '/' }}</span> <a v-if="selectedMedia"
                                                                                                 class="text-red-300 font-normal hover:cursor-pointer"
                                                                                                 @click="cancelStream">(X)</a>
                </p>

                <h3 class="font-bold mb-2">Sessions</h3>
                <ul class="flex mb-4">
                    <li v-for="session in getSessions()">- {{ session.id }} [{{ session.file.name }}] [segments: /]</li>
                </ul>

                <div class="w-full bg-black/30 rounded-xl">
                    <video
                        ref="videoRef"
                        class="w-full rounded shadow-lg"
                        controls
                        autoplay
                        @timeupdate="onTimeUpdate"
                        @seeked="onSeeked"
                        @seeking="onSeeking"
                        @loadedmetadata="onLoadedMetadata"
                        @waiting="onWaiting"
                        @playing="onPlaying"
                        @error="onError"
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
import { inject, onMounted, onUnmounted, ref } from "vue";
import { LokiHeader } from "../components/loki-header";
import type { AxiosInstance } from "axios";
import Hls from "hls.js";

const axios = inject<AxiosInstance>('axios');

interface MediaFile {
    id: string;
    name: string;
    path: string;
    size: number;
    extension: string;
    metadata: any | null;
    modified: Date;
}

interface StreamSession {
    id: string;
    file: MediaFile;
}

const isLoading = ref(true);
const hls = ref<Hls | null>(null)
const mediaFiles = ref<MediaFile[]>([]);
const selectedMedia = ref<MediaFile | null>(null);
const videoRef = ref<HTMLVideoElement | null>(null)

let sessionInterval: number | undefined;
const sessions = ref<StreamSession[]>([]);

const loadMediaFiles = async () => {
    isLoading.value = true;

    try {
        const response = await axios?.get<MediaFile[]>('/media');
        mediaFiles.value = response?.data || [];
    } catch (err) {
        console.error('Failed to load media files:', err);
    } finally {
        isLoading.value = false;
    }
}

const loadSessions = async () => {
    try {
        const response = await axios?.get<any[]>('/sessions');
        sessions.value = response?.data || [];
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
    return `/api/streaming/${selectedMedia.value.id}/playlist.m3u8`;
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

function getSessions() {
    return sessions.value;
}

function cancelStream(): void {
    selectedMedia.value = null;
    if (hls.value) {
        hls.value.destroy()
        hls.value = null
    }
    if (videoRef.value) {
        videoRef.value.src = ''
    }
}

function onTimeUpdate(): void {

}

function onSeeked(): void {

}

function onSeeking(): void {

}

function onLoadedMetadata(): void {

}

function onWaiting(): void {

}

function onPlaying(): void {

}

function onError(): void {

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

function getVideoFormat(media: MediaFile): string {
    if (media.metadata.video.length == 1) {
        const hdrFormat = (media.metadata.video[0]?.HDR_Format || '').toLowerCase();
        const hdrFormatCompatibility = (media.metadata.video[0]?.HDR_Format_Compatibility || '').toLowerCase();
        const hdrFormatProfile = (media.metadata.video[0]?.HDR_Format_Profile || '').toLowerCase();

        const isDolbyVision = hdrFormat.includes('dolby vision')
        const isHDR10 = hdrFormatCompatibility.includes('hdr10+')
        const isHDR = hdrFormatCompatibility.includes('hdr')

        const isSDR = !isDolbyVision && !isHDR10 && !isHDR
        const profile = hdrFormatProfile.replace(/dvhe\.0*(\d+)\s*\/.*/, '$1')

        const format = isSDR ? 'SDR' : `${isDolbyVision ? `Dolby Vision (Profile ${profile}) / ` : ''}${isHDR10 ? 'HDR10+ / ' : ''}${isHDR ? 'HDR' : ''}`
        return `${media.metadata.video[0].Format}, ${format}`
    }

    return 'Multiple video tracks'
}

function getMainAudioTrack(media: MediaFile): string {
    const track = media.metadata?.audio[0]

    const title = (track?.Title || '').toLowerCase()
    const codecId = (track.CodecID || track.Format || '').toLowerCase()
    const format = (track.Format || '').toLowerCase()
    const additionalFeatures = (track.Format_AdditionalFeatures || '').toLowerCase()
    const isAtmos = additionalFeatures.includes('joc')
        || additionalFeatures.includes('16-ch')
        || title.includes('atmos')
    const channels = track.Channels === 2 ? track.Channels : (track.Channels - 1)

    let name = ''

    // TrueHD
    if (codecId.includes('truehd')) {
        if (isAtmos) {
            name = 'Dolby TrueHD Atmos'
        } else {
            name = 'Dolby TrueHD'
        }
    }

    // EAC3 (Dolby Digital Plus)
    else if (codecId.includes('eac3') || codecId.includes('ec-3')) {
        if (isAtmos) {
            name = 'Dolby Digital Plus Atmos'
        } else {
            name = 'Dolby Digital Plus'
        }
    }

    // AC3 (Dolby Digital)
    else if (codecId.includes('ac3')) {
        name = 'Dolby Digital'
    }

    // DTS Varianten
    else if (codecId.includes('dts')) {
        const commercialIfAny = (track?.Format_Commercial_IfAny || '').toLowerCase()

        if (additionalFeatures.includes('xxl x') || commercialIfAny.includes('dts:x')) {
            name = 'DTS:X'
        } else if (codecId.includes('dts-hd ma') || commercialIfAny.includes('dts-hd master audio')) {
            name = 'DTS-HD MA'
        } else if (codecId.includes('dts-hd hr') || commercialIfAny.includes('dts-hd high resolution')) {
            name = 'DTS-HD HR'
        } else {
            name = 'DTS'
        }
    }

    // AAC
    else if (codecId.includes('aac') || format.includes('aac')) {
        name = 'AAC'
    }
    if (channels == 2) {
        return `${name} Stereo`
    }
    return `${name} ${channels}.1`
}

onMounted(() => {
    loadMediaFiles();

    sessionInterval = window.setInterval(() => {
        loadSessions();
    }, 3000)
})

onUnmounted(() => {
    if (sessionInterval) {
        clearInterval(sessionInterval)
    }
})
</script>

<style scoped lang="postcss">

</style>
