<template>
    <div class="video-player-container">
        <video
            ref="videoElement"
            class="video-player"
            controls
            @loadedmetadata="onLoadedMetadata"
            @error="onError"
            @play="onPlay"
            @pause="onPause"
            @seeking="onSeeking"
            @seeked="onSeeked"
            @timeupdate="onTimeUpdate"
            autoplay
        ></video>

        <div v-if="loading" class="loading-overlay">
            <div class="spinner"></div>
            <p>{{ loadingMessage }}</p>
            <div v-if="sessionInfo" class="info-text">
                <p>Verfügbare Segmente: {{ sessionInfo.availableSegments }}/{{ sessionInfo.totalSegments }}</p>
                <p v-if="sessionInfo.isTranscoding">
                    Transkodierung aktiv: {{ sessionInfo.transcodingRange }}
                </p>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, inject } from 'vue';
import Hls from 'hls.js';
import type { AxiosInstance } from 'axios';

interface Props {
    sessionId: string;
    playlistUrl: string;
    duration?: number;
    totalSegments?: number;
    fileName?: string;
}

const props = defineProps<Props>();
const axios = inject<AxiosInstance>('axios');

const videoElement = ref<HTMLVideoElement>();
const loading = ref(true);
const loadingMessage = ref('Initialisiere Stream...');
const sessionInfo = ref<any>(null);

let hls: Hls | null = null;
let positionUpdateInterval: NodeJS.Timeout | null = null;
let sessionInfoInterval: NodeJS.Timeout | null = null;
let lastReportedTime = 0;

const initializePlayer = () => {
    if (!videoElement.value) return;

    if (Hls.isSupported()) {
        hls = new Hls({
            debug: false,
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 30,
            maxBufferLength: 60,
            maxBufferSize: 60 * 1000 * 1000,
            maxBufferHole: 0.5,
            startLevel: -1,
            autoStartLoad: true,
            startPosition: 0
        });

        hls.loadSource(props.playlistUrl);
        hls.attachMedia(videoElement.value);

        hls.on(Hls.Events.MANIFEST_PARSED, (_) => {
            console.log('Manifest parsed');
            loading.value = false;
            loadingMessage.value = 'Stream bereit';

            // Set duration if available
            if (props.duration && videoElement.value) {
                Object.defineProperty(videoElement.value, 'duration', {
                    value: props.duration,
                    writable: false,
                    configurable: true
                });
                videoElement.value.dispatchEvent(new Event('durationchange'));
            }
        });

        hls.on(Hls.Events.FRAG_LOADED, (_, data) => {
            console.log(`Fragment loaded: ${data.frag.sn}`);
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
            console.error('HLS Error:', data);

            if (data.details === 'manifestLoadError' || data.details === 'manifestLoadTimeOut') {
                loading.value = true;
                loadingMessage.value = 'Lade Playlist neu...';
                setTimeout(() => {
                    hls?.loadSource(props.playlistUrl);
                }, 2000);
            } else if (data.details === 'fragLoadError' || data.details === 'fragLoadTimeOut') {
                if (data.response?.code === 404) {
                    loading.value = true;
                    loadingMessage.value = 'Warte auf Transkodierung...';

                    // Update position to trigger transcoding
                    if (videoElement.value) {
                        updateServerPosition(videoElement.value.currentTime);
                    }

                    setTimeout(() => {
                        if (hls) {
                            hls.startLoad();
                        }
                    }, 3000);
                }
            } else if (data.fatal) {
                handleFatalError(data);
            }
        });

    } else if (videoElement.value.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        videoElement.value.src = props.playlistUrl;
        videoElement.value.addEventListener('loadedmetadata', () => {
            loading.value = false;
            if (props.duration && videoElement.value) {
                Object.defineProperty(videoElement.value, 'duration', {
                    value: props.duration,
                    writable: false,
                    configurable: true
                });
                videoElement.value.dispatchEvent(new Event('durationchange'));
            }
        });
    }
};

const handleFatalError = (data: any) => {
    switch (data.type) {
        case 'networkError':
            console.error('Fatal network error encountered, try to recover');
            loading.value = true;
            loadingMessage.value = 'Netzwerkfehler, versuche Wiederherstellung...';
            setTimeout(() => {
                hls?.startLoad();
            }, 1000);
            break;
        case 'mediaError':
            console.error('Fatal media error encountered, try to recover');
            loadingMessage.value = 'Medienfehler, versuche Wiederherstellung...';
            hls?.recoverMediaError();
            break;
        default:
            console.error('Fatal error, cannot recover');
            loading.value = false;
            loadingMessage.value = 'Fehler beim Laden des Videos';
            break;
    }
};

const updateServerPosition = async (currentTime: number) => {
    if (!axios) return;

    try {
        await axios.post(`/stream/${props.sessionId}/position`, {
            currentTime: currentTime
        });
        console.log(`Updated server position to ${currentTime}s`);
    } catch (error) {
        console.error('Error updating position:', error);
    }
};

const startPositionTracking = () => {
    if (positionUpdateInterval) return;

    positionUpdateInterval = setInterval(() => {
        if (videoElement.value && !videoElement.value.paused && !videoElement.value.seeking) {
            const currentTime = videoElement.value.currentTime;

            // Only update if position changed significantly (more than 3 seconds)
            if (Math.abs(currentTime - lastReportedTime) > 3) {
                updateServerPosition(currentTime);
                lastReportedTime = currentTime;
            }
        }
    }, 5000); // Check every 5 seconds (was 10 seconds)
};

const stopPositionTracking = () => {
    if (positionUpdateInterval) {
        clearInterval(positionUpdateInterval);
        positionUpdateInterval = null;
    }
};

const startSessionInfoPolling = () => {
    if (sessionInfoInterval) return;

    sessionInfoInterval = setInterval(async () => {
        if (!axios) return;

        try {
            const response = await axios.get(`/stream/${props.sessionId}/info`);
            sessionInfo.value = response.data;
        } catch (error) {
            console.error('Error fetching session info:', error);
        }
    }, 3000); // Poll every 3 seconds
};

const stopSessionInfoPolling = () => {
    if (sessionInfoInterval) {
        clearInterval(sessionInfoInterval);
        sessionInfoInterval = null;
    }
};

const onLoadedMetadata = () => {
    console.log('Video metadata loaded');
    if (props.duration && videoElement.value) {
        Object.defineProperty(videoElement.value, 'duration', {
            value: props.duration,
            writable: false,
            configurable: true
        });
        videoElement.value.currentTime = 0;
        console.log(`Duration set to: ${props.duration} seconds`);
    }
};

const onError = (e: Event) => {
    console.error('Video error:', e);
    loadingMessage.value = 'Fehler beim Laden des Videos';
};

const onPlay = () => {
    console.log('Video play started');
    loading.value = false;
    startPositionTracking();

    // Update server position when starting playback
    if (videoElement.value) {
        updateServerPosition(videoElement.value.currentTime);
    }
};

const onPause = async () => {
    console.log('Video paused');
    stopPositionTracking();

    // Update final position when pausing
    if (videoElement.value) {
        updateServerPosition(videoElement.value.currentTime);
    }
};

const onSeeking = () => {
    console.log('User is seeking');
    loading.value = true;
    loadingMessage.value = 'Springe zu Position...';
};

const onSeeked = () => {
    console.log('User finished seeking');

    // Update server position immediately after seeking
    if (videoElement.value) {
        const currentTime = videoElement.value.currentTime;
        updateServerPosition(currentTime);
        lastReportedTime = currentTime;
        console.log(`Seeked to ${currentTime}s, updated server position`);
    }

    // Hide loading after seeking
    setTimeout(() => {
        loading.value = false;
    }, 1000);
};

const onTimeUpdate = () => {
    // This runs frequently, but we only update position periodically in the interval
    // We can use this to hide loading when playback is progressing normally
    if (loading.value && videoElement.value && !videoElement.value.seeking) {
        // Hide loading if video is actually playing
        const timeSinceLastUpdate = Date.now() - (videoElement.value as any)._lastTimeUpdate || 0;
        (videoElement.value as any)._lastTimeUpdate = Date.now();

        if (timeSinceLastUpdate < 2000) { // If time is updating regularly
            loading.value = false;
        }
    }
};

const stopStreaming = async () => {
    try {
        if (axios) {
            await axios.post(`/stream/${props.sessionId}/stop`);
            console.log('Streaming stopped');
        }
    } catch (error) {
        console.error('Error stopping stream:', error);
    }
};

onMounted(() => {
    initializePlayer();
    startSessionInfoPolling();
});

onUnmounted(() => {
    if (hls) {
        hls.destroy();
    }
    stopPositionTracking();
    stopSessionInfoPolling();

    // Stop streaming when component is destroyed
    stopStreaming();
});
</script>

<style scoped lang="postcss">
.video-player-container {
    @apply relative w-full h-full bg-black rounded-lg overflow-hidden;
}

.video-player {
    @apply w-full h-full;
}

.loading-overlay {
    @apply absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-75;

    p {
        @apply text-white mt-4;
    }
}

.spinner {
    @apply w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin;
}

.info-text {
    @apply mt-4 text-center;

    p {
        @apply text-sm text-gray-300 mt-1;
    }
}
</style>