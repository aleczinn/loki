<template>
    <Teleport v-if="isOpen"
              to="body">
        <section class="fixed inset-0 bg-black z-videoplayer">
            <div class="relative flex flex-row justify-center w-full h-full">
                <div class="aspect-video bg-black">
                    <video ref="videoRef"
                           class="w-full h-full"
                           @play="isPlaying = true"
                           @pause="isPlaying = false"
                           @loadstart="isLoading = true"
                           @canplay="isLoading = false"
                           @waiting="isBuffering = true"
                           @playing="isBuffering = false"
                           @timeupdate="updateProgress"
                           @progress="updateBuffer"
                           @ended="onVideoEnd">
                    </video>
                </div>

                <!-- Controls -->
                <div class="absolute inset-0"
                     :class="controlsVisible ? 'cursor-default' : 'cursor-none'"
                     @mousemove="handleMouseMove"
                     @mouseleave="handleMouseLeave">

                    <!-- Controls Container -->
                    <div class="relative w-full h-full flex flex-col p-12 opacity-0 transition-opacity player-gradient"
                         :class="{'opacity-100': controlsVisible}"
                    >
                        <!-- Top Bar -->
                        <div class="relative">
                            <div class="flex justify-between">
                                <div class="flex flex-row gap-2 items-center">
                                    <button @click="closePlayer" class="hit-area-sm flex items-center gap-2 text-white transition-colors duration-300 ease-in-out hover:cursor-pointer hover:text-primary">
                                        <icon-arrow-left class="w-6 h-6"/>
                                    </button>

                                    <span class="text-white">{{ currentFile?.name || 'Video' }}</span>
                                </div>

                                <div class="flex gap-6">
                                    <button class="text-white hover:cursor-pointer transition-colors duration-300 ease-in-out hover:text-primary">
                                        <icon-chromecast class="w-6 h-6"/>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Middle Click Area -->
                        <div class="flex-1 relative" @click="togglePlayPause"></div>

                        <!-- Bottom Bar -->
                        <div class="">
                            <!-- Timeline -->
                            <div class="flex flex-row items-center gap-3 text-white text-sm mb-4">
                                <span class="text-left">{{ formatTime(currentTime) }}</span>

                                <loki-progress-bar class="w-full h-1"
                                                   :value="currentTime"
                                                   :value-secondary="buffered"
                                                   :min-value="0"
                                                   :max-value="duration"
                                                   mode="time"
                                                   draggable-mode="delayed"
                                                   @update:value="handleSeek">
                                </loki-progress-bar>

                                <span class="text-right">{{ formatTime(duration) }}</span>
                            </div>

                            <!-- Buttons -->
                            <div class="grid grid-cols-3">
                                <div class="flex flex-col justify-start select-none">
                                    <span class="text-sm text-white">{{ currentFile?.name || 'Video' }}</span>
                                    <span class="text-sm text-gray mb-1">2007</span>
                                    <span class="text-sm text-gray">{{ $t('player.ends-at') }}: {{ endTime }}</span>
                                </div>

                                <div class="flex flex-row gap-4 justify-center items-center">
                                    <button class="hit-area-sm w-6 h-6 text-white transition-colors duration-300 ease-in-out hover:text-primary hover:cursor-pointer"
                                            :title="$t('player.chapter.previous')"
                                            @click="">
                                        <icon-player-rewind class="w-full h-full"></icon-player-rewind>
                                    </button>

                                    <button class="hit-area-sm w-6 h-6 text-white transition-colors duration-300 ease-in-out hover:text-primary hover:cursor-pointer"
                                            :title="$t('player.rewind.title')"
                                            :aria-label="$t('player.rewind.label')"
                                            @click="skip(-10)">
                                        <icon-player-rewind10 class="w-full h-full"></icon-player-rewind10>
                                    </button>

                                    <button class="hit-area-sm text-white transition-colors duration-300 ease-in-out hover:text-primary hover:cursor-pointer"
                                            :title="$t(isPlaying ? 'player.pause.title' : 'player.play.title')"
                                            :aria-label="$t(isPlaying ? 'player.pause.label' : 'player.play.label')"
                                            @click="togglePlayPause">
                                        <icon-player-play v-if="!isPlaying" class="w-5 h-5"/>
                                        <icon-player-pause v-if="isPlaying" class="w-5 h-5"></icon-player-pause>
                                    </button>

                                    <button class="hit-area-sm w-6 h-6 text-white transition-colors duration-300 ease-in-out hover:text-primary hover:cursor-pointer"
                                            :title="$t('player.forward.title')"
                                            :aria-label="$t('player.forward.label')"
                                            @click="skip(30)">
                                        <icon-player-forward30 class="w-full h-full"></icon-player-forward30>
                                    </button>

                                    <button class="hit-area-sm w-6 h-6 text-white transition-colors duration-300 ease-in-out hover:text-primary hover:cursor-pointer"
                                            :title="$t('player.chapter.next')"
                                            @click="">
                                        <icon-player-forward class="w-full h-full"></icon-player-forward>
                                    </button>
                                </div>

                                <div class="flex flex-row gap-6 justify-end items-center">

                                    <button class="hit-area-sm text-white w-6 h-6 transition-colors duration-300 ease-in-out hover:text-primary hover:cursor-pointer"
                                            :title="$t('player.soundtrack')"
                                            @click="">
                                        <icon-music-note class="w-full h-full" aria-hidden="true"></icon-music-note>
                                    </button>

                                    <button class="hit-area-sm text-white w-7 h-7 transition-colors duration-300 ease-in-out hover:text-primary hover:cursor-pointer"
                                            :title="$t('player.captions')"
                                            @click="">
                                        <icon-captions class="w-full h-full" aria-hidden="true"></icon-captions>
                                    </button>

                                    <button class="hit-area-sm text-white w-6 h-6 transition-colors duration-300 ease-in-out hover:text-primary hover:cursor-pointer"
                                            :title="$t(videoRef?.muted ? 'player.unmute.title' : 'player.mute.title')"
                                            :aria-label="$t(videoRef?.muted ? 'player.unmute.label' : 'player.mute.label')"
                                            @click="toggleMute">
                                        <icon-player-volume v-if="! videoRef?.muted" lass="w-full h-full" aria-hidden="true"></icon-player-volume>
                                        <icon-player-muted v-if="videoRef?.muted" lass="w-full h-full" aria-hidden="true"></icon-player-muted>
                                    </button>

                                    <!-- Volume -->
                                    <loki-progress-bar class="w-32 h-1"
                                                       :value="volume"
                                                       :min-value="0"
                                                       :max-value="1"
                                                       mode="percent"
                                                       draggable-mode="instant"
                                                       @update:value="handleVolume">
                                    </loki-progress-bar>

<!--                                    <span class="text-white text-right min-w-[2.75rem]">{{ Math.round(volume * 100) }}%</span>-->

                                    <button class="hit-area-sm text-white w-6 h-6 transition-colors duration-300 ease-in-out hover:text-primary hover:cursor-pointer"
                                            :title="$t('player.settings')">
                                        <icon-gear class="w-full h-full" aria-hidden="true"></icon-gear>
                                    </button>

                                    <button class="hit-area-sm text-white w-6 h-6 transition-colors duration-300 ease-in-out hover:text-primary hover:cursor-pointer"
                                            :title="$t('player.fullscreen.title')"
                                            :aria-label="$t('player.fullscreen.label')"
                                            @click="toggleFullscreen">
                                        <icon-fullscreen class="w-5 h-5" aria-hidden="true"></icon-fullscreen>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Loading Spinner -->
                    <loki-loading-spinner v-if="isLoading || isBuffering"
                                          class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                    </loki-loading-spinner>

                    <icon-player-pause class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/20 w-30 h-30 pointer-events-none opacity-0 transition-opacity duration-300 ease-in-out" :class="{'opacity-100': !isPlaying && !isBuffering && !isLoading}"></icon-player-pause>
                </div>
            </div>
        </section>
    </Teleport>
</template>

<script setup lang="ts">
import Hls from "hls.js";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { LokiLoadingSpinner } from "../loki-loading-spinner";
import IconChromecast from "../../icons/icon-chromecast.vue";
import IconArrowLeft from "../../icons/icon-arrow-left.vue";
import IconPlayerPlay from "../../icons/player/icon-player-play.vue";
import IconPlayerRewind from "../../icons/player/icon-player-rewind.vue";
import IconPlayerForward from "../../icons/player/icon-player-forward.vue";
import IconPlayerPause from "../../icons/player/icon-player-pause.vue";
import IconPlayerRewind10 from "../../icons/player/icon-player-rewind-10.vue";
import IconPlayerForward30 from "../../icons/player/icon-player-forward-30.vue";
import type { MediaFile } from "../../types/media.ts";
import IconFullscreen from "../../icons/icon-fullscreen.vue";
import { clamp } from "../../lib/utils.ts";
import IconGear from "../../icons/icon-gear.vue";
import IconPlayerVolume from "../../icons/player/icon-player-volume.vue";
import IconPlayerMuted from "../../icons/player/icon-player-muted.vue";
import { LokiProgressBar } from "../loki-progress-bar";
import IconCaptions from "../../icons/icon-captions.vue";
import IconMusicNote from "../../icons/icon-music-note.vue";
import { LOKI_VOLUME } from "../../variables.ts";

interface VideoPlayerProps {
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

const emit = defineEmits<{
    closed: [];
    ended: [];
}>();

// State
const isOpen = ref(false);
const isLoading = ref(true);
const isBuffering = ref(false);
const isPlaying = ref(false);
const controlsVisible = ref(true);
let controlsTimer: NodeJS.Timeout | null = null;
let lastMousePosition = { x: 0, y: 0 };

// Progress
const currentTime = ref(0);
const duration = ref(0);
const buffered = ref(0);
const volume = ref(1);

// Refs
const hls = ref<Hls | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null);
const currentFile = ref<MediaFile | null>(null);

// Computed end time
const endTime = computed(() => {
    if (!duration.value) return '00:00';

    const now = new Date();
    const remainingSeconds = duration.value - currentTime.value;
    const endDate = new Date(now.getTime() + remainingSeconds * 1000);

    return endDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
});

function initHLS(url: string) {
    if (hls.value) {
        hls.value.destroy();
        hls.value = null;
    }

    if (!videoRef.value) return;

    if (Hls.isSupported()) {
        hls.value = new Hls({
            debug: false,
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 60,
            maxBufferLength: 60,
            autoStartLoad: true,
            xhrSetup: (xhr: XMLHttpRequest, _: string) => {
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

        // Handle HLS errors
        hls.value.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
                console.error('Fatal HLS error:', data);
            }
        });

        if (videoRef.value) {
            videoRef.value.volume = volume.value;
        }
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

function openPlayer(file: MediaFile) {
    currentFile.value = file;
    isOpen.value = true;

    currentTime.value = 0;
    buffered.value = 0;

    nextTick(() => {
        const url = `/api/streaming/${file.id}/${props.quality}/playlist.m3u8`
        initHLS(url);
    })
}

function getToken(): string {
    let token = sessionStorage.getItem('loki-token');
    if (!token) {
        token = generateToken();
        sessionStorage.setItem('loki-token', token);
    }
    return token;
}

function closePlayer() {
    if (hls.value) {
        hls.value.destroy();
        hls.value = null;
    }

    isOpen.value = false;
    currentFile.value = null;
    isPlaying.value = false;

    emit('closed');
}

function togglePlayPause() {
    if (!videoRef.value) return;

    if (videoRef.value.paused) {
        videoRef.value.play();

        showControls();
    } else {
        videoRef.value.pause();

        controlsVisible.value = true;
        if (controlsTimer) {
            clearTimeout(controlsTimer);
            controlsTimer = null;
        }
    }
}

function skip(seconds: number) {
    if (!videoRef.value) return;

    const value = videoRef.value.currentTime + seconds;
    videoRef.value.currentTime = clamp(value, 0, videoRef.value.duration);
}

function handleSeek(newValue: number) {
    if (!videoRef.value) return;

    videoRef.value.currentTime = newValue;
}

function handleVolume(newValue: number) {
    if (!videoRef.value) return;

    volume.value = newValue;
    videoRef.value.volume  = newValue;
}

// Progress updates
function updateProgress() {
    if (!videoRef.value) return;

    currentTime.value = videoRef.value.currentTime;
    duration.value = videoRef.value.duration || 0;
}

function updateBuffer() {
    if (!videoRef.value || !duration.value) return;

    const b = videoRef.value.buffered;
    if (b.length > 0) {
        // Get the end of the last buffered range
        buffered.value = b.end(b.length - 1);
    }
}

// Format time helper
function formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Keyboard navigation
function handleKeyboard(e: KeyboardEvent) {
    // Ignore if typing in input
    if ((e.target as HTMLElement).tagName === 'INPUT') return;

    switch(e.key) {
        case ' ':
            e.preventDefault();
            togglePlayPause();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            skip(-10);
            break;
        case 'ArrowRight':
            e.preventDefault();
            skip(30);
            break;
        case 'f':
        case 'F':
            e.preventDefault();
            toggleFullscreen();
            break;
        case 'Escape':
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                closePlayer();
            }
            break;
        case 'm':
        case 'M':
            e.preventDefault();
            toggleMute();
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

function toggleMute() {
    if (!videoRef.value) return;

    videoRef.value.muted = !videoRef.value.muted;
    // Optional
    if (videoRef.value.muted) {
        volume.value = 0;
    } else {
        volume.value = videoRef.value.volume;
    }
}

function handleMouseMove(event: MouseEvent) {
    // Check if mouse actually moved
    const moved = event.clientX !== lastMousePosition.x || event.clientY !== lastMousePosition.y;

    if (moved) {
        lastMousePosition = { x: event.clientX, y: event.clientY };
        showControls();
    }
}

function handleMouseLeave() {
    // Instantly hide when leaving the player area
    if (isPlaying.value) {
        controlsVisible.value = false;
        if (controlsTimer) {
            clearTimeout(controlsTimer);
            controlsTimer = null;
        }
    }
}

function showControls() {
    controlsVisible.value = true;

    if (controlsTimer) {
        clearTimeout(controlsTimer);
    }

    if (isPlaying.value && !isLoading.value && !isBuffering.value) {
        controlsTimer = setTimeout(() => {
            controlsVisible.value = false;
        }, 2000);
    }
}

// Window focus handling
function handleWindowBlur() {
    // Instant hide
    controlsVisible.value = false;
    if (controlsTimer) {
        clearTimeout(controlsTimer);
        controlsTimer = null;
    }
}

function handleWindowFocus() {
    // Instant show
    controlsVisible.value = true;
    showControls(); // Start timer
}

function onVideoEnd() {
    isPlaying.value = false;
    emit('ended');
}

// Lifecycle
onMounted(() => {
    document.addEventListener('keydown', handleKeyboard);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    
    const storedVolume = localStorage.getItem(LOKI_VOLUME);
    if (storedVolume) {
        volume.value = parseFloat(storedVolume);
    } else {
        localStorage.setItem(LOKI_VOLUME, volume.value.toString());
    }
});

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyboard);
    window.removeEventListener('blur', handleWindowBlur);
    window.removeEventListener('focus', handleWindowFocus);

    if (controlsTimer) {
        clearTimeout(controlsTimer);
    }

    if (hls.value) {
        hls.value.destroy();
    }
});

// Watch playing state
watch(isPlaying, (playing) => {
    if (!playing) {
        // Always show controls when paused
        controlsVisible.value = true;
        if (controlsTimer) {
            clearTimeout(controlsTimer);
            controlsTimer = null;
        }
    } else {
        // Start hide timer when playing
        showControls();
    }
});

watch(volume, (newVal) => {
    localStorage.setItem(LOKI_VOLUME, newVal.toString());
});

defineExpose({
    play(file: MediaFile) {
        openPlayer(file);
    },
    pause() {
        videoRef.value?.pause();
    },
    resume() {
        videoRef.value?.play();
    },
    close() {
        closePlayer();
    },
    isPlaying() {
        return isPlaying.value;
    },
    setVolume(value: number) {
        if (!videoRef.value) return;
        videoRef.value.volume = value;
        volume.value = value;
    }
})
</script>

<style scoped lang="css">

</style>