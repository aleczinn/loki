<template>
    <Teleport to="body">
        <section v-if="isOpen"
                 class="fixed inset-0 bg-black-800 z-videoplayer">
            <div class="relative flex flex-row justify-center w-full h-full">
                <div class="aspect-video bg-black-900">
                    <video ref="videoRef"
                           class="w-full h-full"
                           @play="isPlaying = true"
                           @pause="isPlaying = false"
                           @loadstart="isLoading = true"
                           @canplay="isLoading = false"
                           @waiting="isBuffering = true"
                           @playing="isBuffering = false"
                           @timeupdate="updateProgress"
                           @ended="onVideoEnd"
                    >
                    </video>
                </div>

                <div class="absolute inset-0 player-gradient" @mousemove="showControls" @mouseleave="showControls"
                     @click="togglePlayPause"></div>

                <loki-loading-spinner v-if="isLoading || isBuffering"
                                      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                </loki-loading-spinner>

                <!-- Top-Bar -->
                <div class="absolute top-0 left-0 right-0 p-6 opacity-0 transition-opacity duration-200 ease-in-out"
                     :class="{'opacity-100': controlsVisible}">
                    <div class="flex flex-row justify-between">
                        <div
                            class="flex flex-row gap-2.5 items-center text-white transition-colors duration-300 ease-in-out hover:text-primary hover:cursor-pointer"
                            @click="closePlayer">
                            <span class="">
                                <icon-arrow-left class="w-6 h-6"></icon-arrow-left>
                            </span>
                            <p class="">Title (2013)</p>
                        </div>

                        <div class="flex flex-row gap-2.5 items-center">
                            <icon-chromecast class="text-white transition-colors duration-300 ease-in-out hover:text-primary hover:cursor-pointer"></icon-chromecast>
                            <icon-fullscreen class="text-white transition-colors duration-300 ease-in-out hover:text-primary hover:cursor-pointer" @click="toggleFullscreen"></icon-fullscreen>
                        </div>
                    </div>
                </div>

                <!-- Bottom-Bar -->
                <div
                    class="absolute bottom-0 left-0 right-0 px-6 py-12 opacity-0 transition-opacity duration-200 ease-in-out"
                    :class="{'opacity-100': controlsVisible}">
                    <!-- Timeline -->
                    <div class="relative w-full h-1 mb-12 rounded-full bg-black-700
                                after:absolute after:h-full after:w-[30%] after:bg-primary after:rounded-full
                                before:absolute before:h-full before:w-[33%] before:bg-primary-darkest before:rounded-full"
                    ></div>

                    <div class="grid grid-cols-3">
                        <div class="flex flex-row justify-start items-center"></div>

                        <div class="flex flex-row gap-4 justify-center items-center">
                            <span @click.stop="skip(-30)"
                                  class="hit-area-sm text-white transition-colors duration-300 ease-in-out hover:text-primary hover:cursor-pointer">
                                <icon-player-rewind class="w-6 h-6"></icon-player-rewind>
                            </span>

                            <span @click.stop="skip(-10)"
                                  class="hit-area-sm text-white transition-colors duration-300 ease-in-out hover:text-primary hover:cursor-pointer">
                                <icon-player-rewind10 class="w-6 h-6"></icon-player-rewind10>
                            </span>

                            <span @click="togglePlayPause"
                                  class="hit-area-sm text-white transition-colors duration-300 ease-in-out hover:text-primary hover:cursor-pointer">
                                <icon-player-play v-if="!isPlaying" class="w-8 h-8"/>
                                <icon-player-pause v-if="isPlaying" class="w-8 h-8"></icon-player-pause>
                            </span>

                            <span @click.stop="skip(10)"
                                  class="hit-area-sm text-white transition-colors duration-300 ease-in-out hover:text-primary hover:cursor-pointer">
                                <icon-player-forward30 class="w-6 h-6"></icon-player-forward30>
                            </span>

                            <span @click.stop="skip(30)"
                                  class="hit-area-sm text-white transition-colors duration-300 ease-in-out hover:text-primary hover:cursor-pointer">
                                <icon-player-forward class="w-6 h-6"></icon-player-forward>
                            </span>
                        </div>

                        <div class="flex flex-row gap-2 justify-end items-center">
                            <icon-info class="text-white w-6 h-6 transition-colors duration-300 ease-in-out hover:text-primary hover:cursor-pointer"></icon-info>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </Teleport>
</template>

<script setup lang="ts">
import Hls from "hls.js";
import { nextTick, onUnmounted, ref, watch } from "vue";
import { LokiLoadingSpinner } from "../loki-loading-spinner";
import IconChromecast from "../../icons/icon-chromecast.vue";
import IconArrowLeft from "../../icons/icon-arrow-left.vue";
import IconPlayerPlay from "../../icons/player/icon-player-play.vue";
import IconPlayerRewind from "../../icons/player/icon-player-rewind.vue";
import IconPlayerForward from "../../icons/player/icon-player-forward.vue";
import IconPlayerPause from "../../icons/player/icon-player-pause.vue";
import IconPlayerRewind10 from "../../icons/player/icon-player-rewind-10.vue";
import IconPlayerForward30 from "../../icons/player/icon-player-forward-30.vue";
import IconInfo from "../../icons/icon-info.vue";
import type { MediaFile } from "../../types/media.ts";
import IconFullscreen from "../../icons/icon-fullscreen.vue";

interface VideoPlayerProps {
    file?: MediaFile;
    quality?: string;
    audioTrack?: number;
    subtitleTrack?: number;
    startTime?: number;
}

const props = withDefaults(defineProps<VideoPlayerProps>(), {
    quality: 'original',
    audioTrack: 0,
    subtitleTrack: -1,
    startTime: 0,
});

const isOpen = ref(false);
const isLoading = ref(true);
const isBuffering = ref(false);
const isPlaying = ref(false);
const controlsVisible = ref(true);
let controlsTimer: NodeJS.Timeout | null = null;

const hls = ref<Hls | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)

function initHLS(url: string) {
    console.log("call init hls with ", url);

    if (hls.value) {
        hls.value.destroy();
        hls.value = null;
    }

    console.log("loading... ", videoRef.value);

    if (!videoRef.value) return;

    if (Hls.isSupported()) {
        console.log("create hls instance");

        hls.value = new Hls({
            debug: false,
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 60,
            maxBufferLength: 120,
            autoStartLoad: true,
            xhrSetup: (xhr: XMLHttpRequest, requestUrl: string) => {
                const token = getToken();
                if (token) {
                    xhr.setRequestHeader('X-Stream-Token', token);
                }
            }
        });

        hls.value.loadSource(url);
        hls.value.attachMedia(videoRef.value);
        hls.value.on(Hls.Events.MANIFEST_PARSED, () => {
            videoRef.value!.play();
        });
    } else if (videoRef.value.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.value.src = url;
        videoRef.value.play();
    }
}

function generateToken(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${random}`;
}

function getToken(): string {
    let token = sessionStorage.getItem('streamToken');
    if (!token) {
        token = generateToken();
        sessionStorage.setItem('streamToken', token);
    }
    return token;
}

function startPlayback() {
    if (props.file) {
        console.log("start playback");
        const quality = "1080p_20mbps";
        initHLS(`/api/streaming/${props.file.id}/${quality}/playlist.m3u8`);
    }
}

function closePlayer() {
    if (hls.value) {
        hls.value.destroy();
        hls.value = null;
    }

    isOpen.value = false;
}

function skip(seconds: number) {
    if (!videoRef.value) return;
    videoRef.value.currentTime = Math.max(0, videoRef.value.currentTime + seconds);
}

function handleKeyboard(e: KeyboardEvent) {
    switch(e.key) {
        case ' ':
        case 'Space':
            togglePlayPause();
            break;
        case 'ArrowLeft':
            skip(-10);
            break;
        case 'ArrowRight':
            skip(30);
            break;
        case 'f':
            toggleFullscreen();
            break;
        case 'Escape':
            closePlayer();
            break;
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

function showControls() {
    controlsVisible.value = true;

    if (controlsTimer) {
        clearTimeout(controlsTimer);
        controlsTimer = null;
    }

    // if (isPlaying.value && isLoading.value && !isBuffering.value) {
    controlsTimer = setTimeout(() => {
        controlsVisible.value = false;
    }, 3000)
    // }
}

function togglePlayPause() {
    console.log("togglePlayPause");
    if (!videoRef.value) return;

    if (videoRef.value.paused) {
        videoRef.value.play();
        isPlaying.value = true;
    } else {
        videoRef.value.pause();
        isPlaying.value = false;
    }
}

function updateProgress() {

}

function onVideoEnd() {

}

onUnmounted(() => {
    if (hls.value) {
        hls.value.destroy();
    }
});

// Watch for prop changes
watch(() => props.file, async (newFile) => {
    if (newFile) {
        isOpen.value = true;

        await nextTick();

        startPlayback();
    } else {
        closePlayer();
    }
}, { immediate: true });
</script>

<style scoped lang="css">

</style>