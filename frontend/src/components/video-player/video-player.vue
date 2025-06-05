<template>
    <div class="video-player-container">
        <video
            ref="videoElement"
            class="video-player"
            controls
            @loadedmetadata="onLoadedMetadata"
            @error="onError"
        ></video>
        <div v-if="loading" class="loading-overlay">
            <div class="spinner"></div>
            <p>Transkodierung läuft...</p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import Hls from 'hls.js';

interface Props {
    sessionId: string;
    playlistUrl: string;
}

const props = defineProps<Props>();
const videoElement = ref<HTMLVideoElement>();
const loading = ref(true);

let hls: Hls | null = null;

const initializePlayer = () => {
    if (!videoElement.value) return;

    if (Hls.isSupported()) {
        hls = new Hls({
            debug: false,
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            maxBufferLength: 30,
            maxMaxBufferLength: 600,
            maxBufferSize: 60 * 1000 * 1000, // 60 MB
            maxBufferHole: 0.5,
            startLevel: -1,
            autoStartLoad: true,
            startPosition: -1
        });

        hls.loadSource(props.playlistUrl);
        hls.attachMedia(videoElement.value);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            loading.value = false;
            videoElement.value?.play();
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        console.error('Fatal network error encountered, try to recover');
                        hls?.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.error('Fatal media error encountered, try to recover');
                        hls?.recoverMediaError();
                        break;
                    default:
                        console.error('Fatal error, cannot recover');
                        hls?.destroy();
                        break;
                }
            }
        });
    } else if (videoElement.value.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        videoElement.value.src = props.playlistUrl;
        videoElement.value.addEventListener('loadedmetadata', () => {
            loading.value = false;
            videoElement.value?.play();
        });
    }
};

const onLoadedMetadata = () => {
    console.log('Video metadata loaded');
};

const onError = (e: Event) => {
    console.error('Video error:', e);
};

onMounted(() => {
    initializePlayer();
});

onUnmounted(() => {
    if (hls) {
        hls.destroy();
    }
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
</style>