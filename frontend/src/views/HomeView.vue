<template>
    <loki-player ref="player" :profile="selectedQuality"></loki-player>

    <div class="flex flex-col h-screen relative">
        <div class="absolute top-4 left-4 text-gray">{{ getClientToken() }}</div>

        <main class="flex-1 py-8">
            <div class="mx-auto max-w-[87rem]">
                <!-- ADD CONTENT HERE -->

                <h3 class="text-white font-bold mb-2">Media Files</h3>
                <div class="flex flex-col mb-4">
                    <a v-for="media in mediaFiles" :key="media.name" @click="playMedia(media)"
                       class="text-white  transition-all duration-200 hover:cursor-pointer hover:ml-4">
                        > {{ media.name }} <span class="text-gray-500">({{formatFileSize(media.size)}}) ({{ getVideoFormat(media) }}) ({{ getMainAudioTrack(media) }})</span>
                    </a>
                </div>

                <label for="quality" class="text-white mr-2">Qualität:</label>
                <select id="quality" v-model="selectedQuality" class="text-white border rounded px-2 py-1">
                    <option class="text-white bg-black-800"
                        v-for="q in qualities"
                        :key="q.value"
                        :value="q.value">
                        {{ q.label }}
                    </option>
                </select>
            </div>
        </main>

        <footer class="px-4 py-4 bg-background-darker">
            <p class="text-white">Footer</p>
        </footer>
    </div>
</template>

<script setup lang="ts">
import { inject, onMounted, onUnmounted, ref } from "vue";
import type { AxiosInstance } from "axios";
import { LokiPlayer } from "../components/loki-player";
import { getClientToken } from "../client-init.ts";

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

const isLoading = ref(true);
const mediaFiles = ref<MediaFile[]>([]);
const player = ref();
const selectedQuality = ref('original');

const qualities = [
    { label: "Original", value: "original" },
    { label: "1080p 20 Mbps", value: "1080p_20mbps" },
    { label: "1080p 8 Mbps", value: "1080p_8mbps" },
    { label: "720p 6 Mbps", value: "720p_6mbps" },
    { label: "480p 3 Mbps", value: "480p_3mbps" },
    { label: "360p 1 Mbps", value: "360p_1mbps" },
];

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

const playMedia = (media: MediaFile) => {
    player.value?.play(media);
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
})

onUnmounted(() => {
    if (sessionInterval) {
        clearInterval(sessionInterval)
    }
})
</script>

<style scoped lang="postcss">

</style>
