<template>
    <Teleport v-if="isOpen"
              to="body">
        <section class="fixed inset-0 bg-black z-videoplayer">
            <div class="relative flex flex-row justify-center w-full h-full">
                <div class="aspect-video bg-black w-full">
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

                <!-- Notification Widget -->
<!--                <div class="absolute top-8 left-1/2 -translate-1/2 w-fit bg-black-900 rounded-xl px-4 py-2 z-popup">-->
<!--                    <p class="text-gray">Starte als Transkode</p>-->
<!--                </div>-->

                <div v-if="sessionId && sessionInfo" class="absolute top-28 left-4 bg-black/80 text-white p-4 rounded text-xs  z-popup pointer-events-none flex flex-col gap-4">
                    <span class="">{{ $t('debug.labels.session_id') }}: {{ sessionId }}</span>

                    <div>
                        <h6 class="font-bold mb-1">{{ $t('debug.labels.playback_information') }}</h6>
                        <ul class="ml-2">
                            <li>{{ $t('debug.labels.player') }}: {{ $t('debug.player.html') }}</li>
                            <li>{{ $t('debug.labels.playback_method') }}: {{ $t(`base.methods.${sessionInfo.decision.mode}`) }}</li>
                            <li>{{ $t('debug.labels.stream_type') }}: {{ sessionInfo.decision.mode === 'transcode' ? $t(`debug.streamtype.hls`) : $t(`debug.streamtype.native`) }}</li>
                        </ul>
                    </div>

                    <div>
                        <h6 class="font-bold mb-1">{{ $t('debug.labels.video_information') }}</h6>
                        <ul class="ml-2">
                            <li>{{ $t('debug.labels.player_dimensions') }}: {{ videoRef?.clientWidth }}x{{ videoRef?.clientHeight }}</li>
                            <li>{{ $t('debug.labels.video_dimensions') }}: {{ videoRef?.videoWidth }}x{{ videoRef?.videoHeight }}</li>
                        </ul>
                    </div>

                    <div v-if="sessionInfo?.transcoding">
                        <h6 class="font-bold mb-1">{{ $t('transcoding.title') }}<</h6>
<!--                        <ul class="ml-2 mb-2">-->
<!--                            <li>Container: Der Container wird nicht unterstützt</li>-->
<!--                            <li>-->
<!--                                <span>Video: AV1 -> H265</span>-->
<!--                                <ul class="ml-4 list-disc">-->
<!--                                    <li>Dynamikumfang des Videos wird nicht unterstützt</li>-->
<!--                                </ul>-->
<!--                            </li>-->
<!--                            <li>-->
<!--                                <span>Audio: TrueHD -> AAC</span>-->
<!--                                <ul class="ml-4 list-disc">-->
<!--                                    <li>Der Audiocodec wird nicht unterstützt</li>-->
<!--                                </ul>-->
<!--                            </li>-->
<!--                        </ul>-->

                        <ul class="ml-2">
                            <li>{{ $t('base.progress') }}: {{ transcodingComputed.progress }} %</li>
                            <li>{{ $t('base.framerate') }}: {{ transcodingComputed.fps }} fps ({{ transcodingComputed.speed }}x)</li>
                        </ul>
                    </div>

                    <div>
                        <h6 class="font-bold mb-1">{{ $t('debug.labels.original_media_information') }}</h6>
                        <ul class="ml-2">
                            <li>{{ $t('base.container') }}: {{ containerComputed.container }}</li>
                            <li>{{ $t('base.size') }}: {{ containerComputed.size }}</li>
                            <li>{{ $t('base.video.bitrate') }}: {{ formatBitrate(sessionInfo.file.metadata.video[0].BitRate) }}</li>
                            <li>{{ $t('base.video.codec') }}: {{ videoComputed.codec }}</li>
                            <li>{{ $t('base.video.hdr_profile') }}: {{ videoComputed.hdr_profile }}</li>
                            <li>{{ $t('base.audio.codec') }}: {{ audioComputed.codec }}</li>
                            <li>{{ $t('base.audio.bitrate') }}: {{ audioComputed.bitrate }}</li>
                            <li>{{ $t('base.audio.channel') }}: {{ audioComputed.channel }}</li>
                            <li>{{ $t('base.audio.sample_rate') }}: {{ audioComputed.sample_rate }}</li>
                        </ul>
                    </div>
                </div>

<!--                &lt;!&ndash; Debug Info (optional, nur während Entwicklung) &ndash;&gt;-->
<!--                <div v-if="playbackInfo"-->
<!--                     class="absolute top-20 left-4 bg-black/80 text-white p-4 rounded text-xs">-->
<!--                    <div class="font-bold mb-2">Playback Info</div>-->
<!--                    <div>Mode: {{ playbackInfo.mode }}</div>-->

<!--                    <div>Container: {{ playbackInfo.decision.container.sourceContainer }}</div>-->
<!--                    <div>Video: {{ playbackInfo.decision.video.action }} {{ playbackInfo.decision.video.sourceCodec }} <span v-if="playbackInfo.decision.video.targetCodec"> ->{{ playbackInfo.decision.video.targetCodec }}</span></div>-->
<!--                    <div v-if="playbackInfo.decision.video.hwAccel" class="mb-2">-->
<!--                        HW Accel: {{ playbackInfo.decision.video.hwAccel.toUpperCase() }}-->
<!--                    </div>-->
<!--                    <span v-if="playbackInfo.decision.video.reason" class="ml-4 text-gray">{{ playbackInfo.decision.video.reason }}</span>-->

<!--                    <div>Audio: {{ playbackInfo.decision.audio.action }} {{ playbackInfo.decision.audio.sourceCodec }} <span v-if="playbackInfo.decision.audio.targetCodec"> ->{{ playbackInfo.decision.audio.targetCodec }}</span></div>-->
<!--                    <span v-if="playbackInfo.decision.audio.reason" class="ml-4 text-gray">{{ playbackInfo.decision.audio.reason }}</span>-->
<!--                </div>-->

                <!-- Controls -->
                <div class="absolute inset-0"
                     :class="controlsVisible ? 'cursor-default' : 'cursor-none'"
                     @mousemove="handleMouseMove"
                     @mouseleave="handleMouseLeave">

                    <!-- Controls Container -->
                    <div class="relative w-full h-full flex flex-col p-12 opacity-100 transition-opacity player-gradient"
                         :class="{'opacity-100': controlsVisible}"
                    >
                        <!-- Top Bar -->
                        <div class="relative">
                            <div class="flex justify-between">
                                <div class="flex flex-row gap-2 items-center">
                                    <loki-player-button @click="closePlayer"
                                                        :title="$t('player.back')">
                                        <icon-arrow-left class="w-6 h-6" aria-hidden="true"/>
                                    </loki-player-button>

                                    <span class="text-white">{{ currentFile?.name || 'Video' }}</span>
                                </div>

                                <div class="flex gap-6">
                                    <loki-player-button @click=""
                                                        :title="$t('player.chromecast')">
                                        <icon-chromecast class="w-6 h-6" aria-hidden="true"/>
                                    </loki-player-button>
                                </div>
                            </div>
                        </div>

                        <!-- Middle Click Area -->
                        <div class="flex-1 relative" @click="togglePlayPause"></div>

                        <!-- Bottom Bar -->
                        <div class="">
                            <!-- Timeline -->
                            <div class="flex flex-row items-center gap-3 text-white text-sm p-2 mb-2">
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
                            <div class="flex flex-row">
                                <div class="flex-1 hidden lg:flex flex-col justify-start select-none">
                                    <span class="text-sm text-white">{{ currentFile?.name || 'Video' }}</span>
                                    <span class="text-sm text-gray mb-1">2007</span>
                                    <span class="text-sm text-gray">{{ $t('player.ends-at') }}: {{ endTime }}</span>
                                </div>

                                <div class="flex-1 flex flex-row gap-2 justify-start lg:justify-center items-center">
                                    <loki-player-button @click=""
                                                        :title="$t('player.chapter.previous')"
                                                        class="hidden md:flex"
                                    >
                                        <icon-player-rewind class="w-6 h-6" aria-hidden="true"/>
                                    </loki-player-button>

                                    <loki-player-button @click="skip(-10)"
                                                        :title="$t('player.rewind.title')"
                                                        :aria-label="$t('player.rewind.label')"
                                                        class="hidden md:flex"
                                    >
                                        <icon-player-rewind10 class="w-6 h-6" aria-hidden="true"/>
                                    </loki-player-button>

                                    <loki-player-button @click="togglePlayPause"
                                                        :title="$t(isPlaying ? 'player.pause.title' : 'player.play.title')"
                                                        :aria-label="$t(isPlaying ? 'player.pause.label' : 'player.play.label')"
                                    >
                                        <icon-player-play v-if="!isPlaying" class="w-5 h-5" aria-hidden="true"/>
                                        <icon-player-pause v-if="isPlaying" class="w-5 h-5" aria-hidden="true"/>
                                    </loki-player-button>

                                    <loki-player-button @click="skip(30)"
                                                        :title="$t('player.forward.title')"
                                                        :aria-label="$t('player.forward.label')"
                                                        class="hidden md:flex"
                                    >
                                        <icon-player-forward30 class="w-6 h-6" aria-hidden="true"/>
                                    </loki-player-button>

                                    <loki-player-button @click=""
                                                        :title="$t('player.chapter.next')"
                                                        class="hidden md:flex"
                                    >
                                        <icon-player-forward class="w-6 h-6" aria-hidden="true"/>
                                    </loki-player-button>
                                </div>

                                <div class="flex-1 flex flex-row gap-2 justify-end items-center">
                                    <loki-player-button ref="audioButtonRef"
                                                        @click="openAudioDialog()"
                                                        :title="$t('player.soundtrack')"
                                    >
                                        <icon-music-note class="w-6 h-6" aria-hidden="true"/>
                                    </loki-player-button>

                                    <loki-player-button ref="subtitleButtonRef"
                                                        @click="openSubtitleDialog"
                                                        :title="$t('player.captions')"
                                    >
                                        <icon-captions class="w-6 h-6" aria-hidden="true"/>
                                    </loki-player-button>

                                    <loki-player-button @click="toggleMute"
                                                        :title="$t(videoRef?.muted ? 'player.unmute.title' : 'player.mute.title')"
                                                        :aria-label="$t(videoRef?.muted ? 'player.unmute.label' : 'player.mute.label')"
                                                        class="hidden sm:flex"
                                    >
                                        <icon-player-volume v-if="! videoRef?.muted" lass="w-6 h-6" aria-hidden="true"/>
                                        <icon-player-muted v-if="videoRef?.muted" lass="w-6 h-6" aria-hidden="true"/>
                                    </loki-player-button>

                                    <!-- Volume -->
                                    <loki-progress-bar class="w-32 h-1 hidden sm:flex"
                                                       :value="volume"
                                                       :min-value="0"
                                                       :max-value="1"
                                                       mode="percent"
                                                       draggable-mode="instant"
                                                       @update:value="handleVolume">
                                    </loki-progress-bar>

                                    <loki-player-button @click=""
                                                        :title="$t('player.settings')"
                                    >
                                        <icon-gear class="w-6 h-6" aria-hidden="true"/>
                                    </loki-player-button>

                                    <loki-player-button @click="toggleFullscreen"
                                                        :title="$t('player.fullscreen.title')"
                                                        :aria-label="$t('player.fullscreen.label')"
                                    >
                                        <icon-fullscreen class="w-6 h-6" aria-hidden="true"/>
                                    </loki-player-button>
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

                <!-- POPUP - Audio Tracks -->
                <dialog ref="audioDialog"
                        class="fixed top-[inherit] bottom-8 -translate-x-1/2 bg-black border border-black-900 rounded-lg p-4 dialog-backdrop"
                        @click.self="audioDialog?.close();"
                >
                    <h1 class="font-loki-sub text-xl text-white mb-4">Tonspur</h1>
                    <div class="flex flex-col text-gray">
                        <button v-for="(track, index) in audioTracks"
                                :key="index"
                                class="w-full px-4 py-2 text-left text-gray hover:bg-white/10 transition-colors flex gap-3 cursor-pointer"
                                :class="{ 'bg-white/5': index === currentAudioTrack }"
                                @click="selectAudioTrack(index)"
                        >
                            <span class="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <icon-checkmark v-if="index === currentAudioTrack"
                                              class="text-primary"
                                              aria-hidden="true"
                              />
                            </span>
                            <span class="text-base whitespace-nowrap">{{ track.name }}</span>
                        </button>
                    </div>
                </dialog>

                <!-- POPUP - Subtitle Tracks -->
                <dialog ref="subtitleDialog"
                        class="fixed top-[inherit] bottom-8 -translate-x-1/2 bg-black border border-black-900 rounded-lg p-4 dialog-backdrop"
                        @click.self="subtitleDialog?.close();"
                >
                    <h1 class="font-loki-sub text-xl text-white mb-4">Tonspur</h1>
                    <div class="flex flex-col text-gray">
                        <button v-for="(track, index) in subtitleTracks"
                                :key="index"
                                class="w-full px-4 py-2 text-left text-gray hover:bg-white/10 transition-colors flex gap-3 cursor-pointer"
                                :class="{ 'bg-white/5': index === currentSubtitleTrack }"
                                @click="selectSubtitleTrack(index)"
                        >
                            <span class="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <icon-checkmark v-if="index === currentSubtitleTrack"
                                              class="text-primary"
                                              aria-hidden="true"
                              />
                            </span>
                            <span class="text-base whitespace-nowrap">
                                {{ track.name }}<span v-if="track.format" class="text-gray/30"> - {{ track.format }}</span>
                            </span>
                        </button>
                    </div>
                </dialog>
            </div>
        </section>
    </Teleport>
</template>

<script setup lang="ts">
import Hls from "hls.js";
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
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
import { clamp, formatBitrate, formatFileSize } from "../../lib/utils.ts";
import IconGear from "../../icons/icon-gear.vue";
import IconPlayerVolume from "../../icons/player/icon-player-volume.vue";
import IconPlayerMuted from "../../icons/player/icon-player-muted.vue";
import { LokiProgressBar } from "../loki-progress-bar";
import IconCaptions from "../../icons/icon-captions.vue";
import IconMusicNote from "../../icons/icon-music-note.vue";
import { LOKI_TOKEN, LOKI_VOLUME } from "../../variables.ts";
import { LokiPlayerButton } from "../loki-player-button";
import IconCheckmark from "../../icons/icon-checkmark.vue";
import type { AxiosInstance } from "axios";

interface VideoPlayerProps {
    profile?: string;
    audioIndex?: number;
    subtitleIndex?: number;
    startTime?: number;
}

const props = withDefaults(defineProps<VideoPlayerProps>(), {
    profile: 'original',
    audioTrack: 0,
    subtitleTrack: -1,
    startTime: 0,
});

const emit = defineEmits<{
    closed: [];
    ended: [];
}>();

const axios = inject<AxiosInstance>('axios');

const sessionId = ref<string | null>(null);
const sessionInfo = ref<any | null>(null);
let progressInterval: NodeJS.Timeout | null = null;

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
const videoRef = ref<HTMLVideoElement | null>(null);
const hls = ref<Hls | null>(null)
const currentFile = ref<MediaFile | null>(null);

// Popups
const audioDialog = ref<HTMLDialogElement | null>(null);
const audioButtonRef = ref<HTMLElement | null>(null);
const currentAudioTrack = ref(0);

const subtitleDialog = ref<HTMLDialogElement | null>(null);
const subtitleButtonRef = ref<HTMLElement | null>(null);
const currentSubtitleTrack = ref(0);

// TEMP
const audioTracks = ref([
    { name: 'DTS-HD MA 7.1 [SKELLETON Mix]', language: 'German', codec: 'Standard' },
    { name: 'DTS-HD MA 5.1', language: 'German', codec: '' },
    { name: 'DTS-HD MA 7.1', language: 'English', codec: '' },
    { name: 'Audiokommentar m. Regisseur Chris Weitz DTS Stereo', language: 'English', codec: '' },
]);

const subtitleTracks = ref([
    { name: 'Aus' },
    { name: 'Deutsch Erzwungen', language: 'de', format: 'SubRip' },
    { name: 'Deutsch', language: 'de', format: 'PGS' },
    { name: 'Deutsch SDH', language: 'de', format: 'PGS' },
    { name: 'English Forced', language: 'en', format: 'SubRip' },
    { name: 'English', language: 'en', format: 'PGS' },
    { name: 'English SDH', language: 'en', format: 'PGS' },
    { name: 'French', language: 'fr', format: 'VobSub' }
]);

function selectAudioTrack(index: number) {
    currentAudioTrack.value = index;

    // HLS Audio Track wechseln
    if (hls.value) {
        // hls.value.audioTrack = index;
    }
}

function selectSubtitleTrack(index: number) {
    currentSubtitleTrack.value = index;

    // HLS Audio Track wechseln
    if (hls.value) {
        // hls.value.audioTrack = index;
    }
}

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

const containerComputed = computed(() => {
    if (sessionInfo.value) {
        let container = sessionInfo.value.file?.metadata.general.Format.toLowerCase();

        switch (container) {
            case 'mpeg-4':
                container = 'mp4';
                break;
            case 'matroska':
                container = 'mkv';
                break;
        }

        return {
            container: container,
            size: formatFileSize(sessionInfo.value.file.size)
        }
    }

    return {
        container: 'unknown',
        size: 'unknown'
    }
})

const videoComputed = computed(() => {
    if (sessionInfo.value) {

    }

    return {
        codec: 'unknown',
        hdr_profile: 'unknown'
    }
})

const audioComputed = computed(() => {
    if (sessionInfo.value) {

    }

    return {
        codec: 'unknown',
        bitrate: -1,
        channel: -1,
        sample_rate: -1
    }
})

const transcodingComputed = computed(() => {
    if (sessionInfo.value) {
        console.log("asdasd");

        return {
            progress: sessionInfo.value.transcode.progress,
            fps: sessionInfo.value.transcode.fps,
            speed: sessionInfo.value.transcode.speed
        }
    }

    console.log("not working");

    return {
        progress: -1,
        fps: -1,
        speed: 0.00
    }
})

async function openPlayer(file: MediaFile) {
    currentFile.value = file;
    isOpen.value = true;

    currentTime.value = 0;
    buffered.value = 0;

    await nextTick();

    if (!videoRef.value) {
        console.error("videoRef still null after nextTick()");
        return;
    }

    cleanup();

    const token = sessionStorage.getItem(LOKI_TOKEN);
    const response = await axios?.post('/session/start', {
        mediaId: file.id,
        profile: props.profile
    }, {
        headers: {
            'X-Client-Token': token
        }
    });

    sessionId.value = response?.data.sessionId;

    const url = `/api/videos/${file.id}/master.m3u8?token=${token}&profile=${props.profile}`;

    startProgressReporting();

    videoRef.value.src = url;
    videoRef.value.volume = volume.value;

    videoRef.value.play().catch(() => {
        console.log("Abspielen mit native player fehlgeschlagen! Wechsle zu HLS");
        initHLSPlayer(url);
    });

    axios?.get(`/session/${sessionId.value}`).then(response => {
        sessionInfo.value = response?.data;
    }).catch(error => {
        console.error(`Failed to get session information for ${sessionId}:`, error);
    })
}

function cleanup() {
    sessionId.value = null;

    if (hls.value) {
        hls.value.destroy();
        hls.value = null;
    }

    // if (videoRef.value) {
    //     videoRef.value.pause();
    //     videoRef.value.removeAttribute("src");
    //     videoRef.value.load();
    // }
}

async function closePlayer() {
    if (sessionId.value && videoRef.value) {
        try {
            await axios?.post('/session/stop', {
                sessionId: sessionId.value,
                time: videoRef.value.currentTime
            });
        } catch (error) {
            console.error('Failed to stop session:', error);
        }
    }

    stopProgressReporting();

    if (hls.value) {
        hls.value.destroy();
        hls.value = null;
    }

    isOpen.value = false;
    currentFile.value = null;
    isPlaying.value = false;

    emit('closed');
}

function initHLSPlayer(url: string) {
    if (hls.value) {
        hls.value.destroy();
        hls.value = null;
    }

    if (!videoRef.value) return;

    if (!Hls.isSupported()) {
        console.error("HLS not supported");
        return;
    }

    hls.value = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 60,
        maxBufferLength: 60,
        autoStartLoad: true,
        xhrSetup: (xhr: XMLHttpRequest, _: string) => {
            const token = sessionStorage.getItem(LOKI_TOKEN);

            if (token) {
                xhr.setRequestHeader('X-Client-Token', token);
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
}


function startProgressReporting() {
    if (progressInterval) {
        clearInterval(progressInterval);
    }

    // Send progress every 5 seconds
    progressInterval = setInterval(() => {
        if (!sessionId.value || !videoRef.value) return;

        axios?.post('/session/progress', {
            sessionId: sessionId.value,
            currentTime: videoRef.value.currentTime,
            isPaused: videoRef.value.paused
        }).catch(err => {
            console.error('Failed to report progress:', err);
        });

        axios?.get(`/session/${sessionId.value}`).then(response => {
            sessionInfo.value = response?.data;
        }).catch(error => {
            console.error(`Failed to get session information for ${sessionId}:`, error);
        })

    }, 5000);
}

function stopProgressReporting() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
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

    videoRef.value.pause();

    axios?.post('/session/seek', {
        sessionId: sessionId.value,
        time: newValue
    }).then((result) => {
        // if (result.data.restart && hls.value) {
        //     hls.value.stopLoad();
        //     hls.value.loadSource(currentUrl); // gleiche URL, neuer Inhalt
        //     hls.value.startLoad(time);
        // }
    }).catch(err => {
        console.error('Failed to report seek:', err);
    });

    videoRef.value.currentTime = newValue;
    videoRef.value.play();
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

function handleResize() {
    if (audioButtonRef.value && audioDialog.value) {
        const dialog = audioDialog.value;
        const el = (audioButtonRef.value as any)?.$el;
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + (rect.width / 2);

        dialog.style.left = `${centerX}px`;
    }

    if (subtitleButtonRef.value && subtitleDialog.value) {
        const dialog = subtitleDialog.value;
        const el = (subtitleButtonRef.value as any)?.$el;
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + (rect.width / 2);

        dialog.style.left = `${centerX}px`;
    }
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
            audioDialog.value?.close();
            subtitleDialog.value?.close();

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

function openAudioDialog() {
    audioDialog.value?.showModal();
    handleResize();
}

function openSubtitleDialog() {
    subtitleDialog.value?.showModal();
    handleResize();
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
    window.addEventListener('resize', handleResize);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    const storedVolume = localStorage.getItem(LOKI_VOLUME);
    if (storedVolume) {
        volume.value = parseFloat(storedVolume);
    } else {
        localStorage.setItem(LOKI_VOLUME, volume.value.toString());
    }

    window.addEventListener('beforeunload', () => {
        if (sessionId.value && videoRef.value) {
            // Use sendBeacon for reliable cleanup on page close
            navigator.sendBeacon(
                '/api/session/stop',
                JSON.stringify({
                    sessionId: sessionId.value,
                    time: videoRef?.value?.currentTime
                })
            );
        }
    });
});

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyboard);
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('blur', handleWindowBlur);
    window.removeEventListener('focus', handleWindowFocus);

    if (controlsTimer) {
        clearTimeout(controlsTimer);
    }

    stopProgressReporting();
    closePlayer();
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
.dialog-backdrop::backdrop {

}

.dialog-backdrop[open]::backdrop {

}
</style>