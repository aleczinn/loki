<template>
    <div class="video-player-container bg-black rounded-lg overflow-hidden shadow-2xl">
        <!-- Video Element -->
        <div class="relative">
            <video
                ref="videoElement"
                class="w-full h-auto"
                @loadedmetadata="onLoadedMetadata"
                @timeupdate="onTimeUpdate"
                @error="onVideoError"
                controls
            >
                Your browser does not support the video tag.
            </video>

            <!-- Custom Controls Overlay -->
            <div v-if="showControls" class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <!-- Progress Bar -->
                <div class="mb-4">
                    <div class="relative h-1 bg-gray-600 rounded-full cursor-pointer" @click="seek">
                        <div class="absolute h-full bg-red-600 rounded-full" :style="`width: ${progress}%`"></div>
                        <div class="absolute h-3 w-3 bg-white rounded-full -top-1" :style="`left: ${progress}%; transform: translateX(-50%)`"></div>
                    </div>
                </div>

                <!-- Control Buttons -->
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-4">
                        <!-- Play/Pause -->
                        <button @click="togglePlay" class="text-white hover:text-gray-300">
                            <svg v-if="!isPlaying" class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5 3v14l11-7z" />
                            </svg>
                            <svg v-else class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5 3h4v14H5V3zm6 0h4v14h-4V3z" />
                            </svg>
                        </button>

                        <!-- Time Display -->
                        <span class="text-white text-sm">
              {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
            </span>
                    </div>

                    <div class="flex items-center space-x-4">
                        <!-- Audio Track Selector -->
                        <div class="relative" v-if="audioTracks.length > 0">
                            <button @click="showAudioMenu = !showAudioMenu" class="text-white hover:text-gray-300 flex items-center space-x-1">
                                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 3.5a1.5 1.5 0 013 0V4a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-.5a1.5 1.5 0 000 3h.5a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-.5a1.5 1.5 0 00-3 0v.5a1 1 0 01-1 1H6a1 1 0 01-1-1v-3a1 1 0 011-1h.5a1.5 1.5 0 000-3H6a1 1 0 01-1-1V6a1 1 0 011-1h3a1 1 0 001-1v-.5z" />
                                </svg>
                                <span class="text-sm">Audio</span>
                            </button>

                            <div v-if="showAudioMenu" class="absolute bottom-full mb-2 right-0 bg-gray-800 rounded-md shadow-lg py-2 min-w-[200px]">
                                <button
                                    v-for="(track, index) in audioTracks"
                                    :key="index"
                                    @click="selectAudioTrack(index)"
                                    class="block w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700"
                                    :class="{ 'bg-gray-700': currentAudioTrack === index }"
                                >
                                    {{ track.title }} ({{ track.language }})
                                </button>
                            </div>
                        </div>

                        <!-- Subtitle Track Selector -->
                        <div class="relative" v-if="subtitleTracks.length > 0">
                            <button @click="showSubtitleMenu = !showSubtitleMenu" class="text-white hover:text-gray-300 flex items-center space-x-1">
                                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" />
                                </svg>
                                <span class="text-sm">CC</span>
                            </button>

                            <div v-if="showSubtitleMenu" class="absolute bottom-full mb-2 right-0 bg-gray-800 rounded-md shadow-lg py-2 min-w-[200px]">
                                <button
                                    @click="selectSubtitleTrack(-1)"
                                    class="block w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700"
                                    :class="{ 'bg-gray-700': currentSubtitleTrack === -1 }"
                                >
                                    Off
                                </button>
                                <button
                                    v-for="(track, index) in subtitleTracks"
                                    :key="index"
                                    @click="selectSubtitleTrack(index)"
                                    class="block w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700"
                                    :class="{ 'bg-gray-700': currentSubtitleTrack === index }"
                                >
                                    {{ track.title }} ({{ track.language }})
                                </button>
                            </div>
                        </div>

                        <!-- Quality Selector -->
                        <div class="relative">
                            <button @click="showQualityMenu = !showQualityMenu" class="text-white hover:text-gray-300 flex items-center space-x-1">
                                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                    <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
                                </svg>
                                <span class="text-sm">{{ currentQuality }}</span>
                            </button>

                            <div v-if="showQualityMenu" class="absolute bottom-full mb-2 right-0 bg-gray-800 rounded-md shadow-lg py-2">
                                <button
                                    v-for="quality in qualities"
                                    :key="quality"
                                    @click="selectQuality(quality)"
                                    class="block w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700"
                                    :class="{ 'bg-gray-700': currentQuality === quality }"
                                >
                                    {{ quality }}
                                </button>
                            </div>
                        </div>

                        <!-- Fullscreen -->
                        <button @click="toggleFullscreen" class="text-white hover:text-gray-300">
                            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M3 4a1 1 0 011-1h4a1 1 0 010 2H5v3a1 1 0 01-2 0V4z" />
                                <path d="M3 16a1 1 0 001 1h4a1 1 0 000-2H5v-3a1 1 0 00-2 0v4z" />
                                <path d="M16 3a1 1 0 011 1v4a1 1 0 01-2 0V5h-3a1 1 0 010-2h4z" />
                                <path d="M16 17a1 1 0 001-1v-4a1 1 0 00-2 0v3h-3a1 1 0 000 2h4z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Loading Spinner -->
        <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-black/50">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>

        <!-- Error Message -->
        <div v-if="error" class="absolute inset-0 flex items-center justify-center bg-black/80">
            <div class="text-white text-center">
                <p class="text-xl mb-2">Error loading video</p>
                <p class="text-sm text-gray-400">{{ error }}</p>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import Hls from 'hls.js';

interface Props {
    filepath: string;
}

interface Track {
    index: number;
    language: string;
    title: string;
    codec?: string;
}

const props = defineProps<Props>();

// Refs
const videoElement = ref<HTMLVideoElement>();
const hls = ref<Hls | null>(null);

// State
const isPlaying = ref(false);
const isLoading = ref(true);
const currentTime = ref(0);
const duration = ref(0);
const progress = ref(0);
const error = ref<string | null>(null);
const showControls = ref(true);

// Track Management
const audioTracks = ref<Track[]>([]);
const subtitleTracks = ref<Track[]>([]);
const currentAudioTrack = ref(0);
const currentSubtitleTrack = ref(-1);

// Quality Management
const qualities = ref(['1080p', '720p', '360p']);
const currentQuality = ref('720p');

// Menu State
const showAudioMenu = ref(false);
const showSubtitleMenu = ref(false);
const showQualityMenu = ref(false);

// Lifecycle
onMounted(() => {
    initializePlayer();
    loadTracks();
});

onUnmounted(() => {
    if (hls.value) {
        hls.value.destroy();
    }
});

// Initialize HLS Player
const initializePlayer = () => {
    if (!videoElement.value) return;

    const videoUrl = `/api/stream/master/${encodeURIComponent(props.filepath)}`;

    if (Hls.isSupported()) {
        hls.value = new Hls({
            startLevel: 1, // Start with 720p
            maxBufferLength: 60,
            maxMaxBufferLength: 120,
            enableWorker: true,
            lowLatencyMode: false,
        });

        hls.value.loadSource(videoUrl);
        hls.value.attachMedia(videoElement.value);

        hls.value.on(Hls.Events.MANIFEST_PARSED, () => {
            isLoading.value = false;
        });

        hls.value.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
                handleError(data.type);
            }
        });

        // Handle level switching
        hls.value.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
            const level = hls.value!.levels[data.level];
            if (level.height === 1080) currentQuality.value = '1080p';
            else if (level.height === 720) currentQuality.value = '720p';
            else if (level.height === 360) currentQuality.value = '360p';
        });

    } else if (videoElement.value.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        videoElement.value.src = videoUrl;
        isLoading.value = false;
    } else {
        error.value = 'HLS is not supported in this browser';
    }
};

// Load available tracks
const loadTracks = async () => {
    try {
        const response = await fetch(`/api/media/tracks/${encodeURIComponent(props.filepath)}`);
        const data = await response.json();

        audioTracks.value = data.audio || [];
        subtitleTracks.value = data.subtitles || [];
    } catch (err) {
        console.error('Failed to load tracks:', err);
    }
};

// Player Controls
const togglePlay = () => {
    if (!videoElement.value) return;

    if (videoElement.value.paused) {
        videoElement.value.play();
        isPlaying.value = true;
    } else {
        videoElement.value.pause();
        isPlaying.value = false;
    }
};

const seek = (event: MouseEvent) => {
    if (!videoElement.value) return;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = x / rect.width;
    videoElement.value.currentTime = percentage * duration.value;
};

const toggleFullscreen = () => {
    if (!videoElement.value) return;

    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        videoElement.value.parentElement?.requestFullscreen();
    }
};

// Track Selection
const selectAudioTrack = (index: number) => {
    currentAudioTrack.value = index;
    showAudioMenu.value = false;

    // Reload player with new audio track
    const currentTime = videoElement.value?.currentTime || 0;

    // Update the playlist URL with the selected audio track
    const newUrl = `/api/stream/master/${encodeURIComponent(props.filepath)}?audioTrack=${index}`;

    if (hls.value) {
        hls.value.loadSource(newUrl);
        hls.value.once(Hls.Events.MANIFEST_PARSED, () => {
            if (videoElement.value) {
                videoElement.value.currentTime = currentTime;
                videoElement.value.play();
            }
        });
    }
};

const selectSubtitleTrack = (index: number) => {
    currentSubtitleTrack.value = index;
    showSubtitleMenu.value = false;

    // TODO: Implement subtitle track switching
    // This would involve loading VTT files or burning in subtitles
};

const selectQuality = (quality: string) => {
    currentQuality.value = quality;
    showQualityMenu.value = false;

    if (!hls.value) return;

    // Map quality to level
    let targetLevel = -1;
    hls.value.levels.forEach((level, index) => {
        if (quality === '1080p' && level.height === 1080) targetLevel = index;
        else if (quality === '720p' && level.height === 720) targetLevel = index;
        else if (quality === '360p' && level.height === 360) targetLevel = index;
    });

    if (targetLevel !== -1) {
        hls.value.currentLevel = targetLevel;
    }
};

// Event Handlers
const onLoadedMetadata = () => {
    if (!videoElement.value) return;
    duration.value = videoElement.value.duration;
};

const onTimeUpdate = () => {
    if (!videoElement.value) return;
    currentTime.value = videoElement.value.currentTime;
    progress.value = (currentTime.value / duration.value) * 100;
};

const onVideoError = (_: Event) => {
    error.value = 'Failed to load video';
    isLoading.value = false;
};

const handleError = (errorType: string) => {
    switch (errorType) {
        case Hls.ErrorTypes.NETWORK_ERROR:
            error.value = 'Network error occurred';
            break;
        case Hls.ErrorTypes.MEDIA_ERROR:
            error.value = 'Media error occurred';
            if (hls.value) {
                hls.value.recoverMediaError();
            }
            break;
        default:
            error.value = 'An unknown error occurred';
    }
    isLoading.value = false;
};

// Utility Functions
const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
};

// Auto-hide controls
let controlsTimeout: NodeJS.Timeout;
const resetControlsTimeout = () => {
    clearTimeout(controlsTimeout);
    showControls.value = true;
    controlsTimeout = setTimeout(() => {
        if (isPlaying.value) {
            showControls.value = false;
        }
    }, 3000);
};

// Watch for mouse movement
watch(isPlaying, (playing) => {
    if (playing) {
        resetControlsTimeout();
    } else {
        showControls.value = true;
    }
});
</script>

<style scoped>
.video-player-container {
    position: relative;
    max-width: 100%;
    margin: 0 auto;
}

video {
    max-height: 80vh;
}

/* Hide menus when clicking outside */
.video-player-container:not(:hover) .relative > div {
    display: none;
}
</style>