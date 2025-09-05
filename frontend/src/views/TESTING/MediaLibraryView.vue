<template>
    <div class="min-h-screen bg-gray-900 text-white">
        <!-- Header -->
        <header class="bg-gray-800 p-4 shadow-lg border-b border-gray-700">
            <div class="container mx-auto flex items-center justify-between">
                <h1 class="text-2xl font-bold text-blue-400">🎬 Loki Media Server</h1>
                <div class="text-sm text-gray-400">
                    {{ mediaFiles.length }} files available
                </div>
            </div>
        </header>

        <!-- Main Content -->
        <main class="container mx-auto p-6">
            <!-- Media Library -->
            <div v-if="!currentStream" class="space-y-6">
                <div class="flex items-center justify-between">
                    <h2 class="text-2xl font-semibold">Media Library</h2>
                    <button
                        @click="loadMediaLibrary(true)"
                        :disabled="loadingLibrary"
                        class="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                    >
                        <svg v-if="loadingLibrary" class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>{{ loadingLibrary ? 'Scanning...' : 'Refresh' }}</span>
                    </button>
                </div>

                <!-- Search -->
                <div class="max-w-md">
                    <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Search media files..."
                        class="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                    />
                </div>

                <!-- Loading State -->
                <div v-if="loadingLibrary" class="flex justify-center py-12">
                    <div class="text-center">
                        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
                        <p class="text-gray-400">Loading media library...</p>
                    </div>
                </div>

                <!-- Media Files Grid -->
                <div v-else-if="filteredFiles.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    <div
                        v-for="file in filteredFiles"
                        :key="file.path"
                        class="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 cursor-pointer transition-all transform hover:scale-105 border border-gray-700 hover:border-blue-500"
                        @click="startStream(file)"
                    >
                        <div class="aspect-video bg-gray-700 rounded-lg mb-3 flex items-center justify-center">
                            <svg class="w-16 h-16 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2 6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
                                <path d="M8 9a1 1 0 011-1h1a1 1 0 110 2H9a1 1 0 01-1-1z"/>
                            </svg>
                        </div>
                        <h3 class="font-medium truncate text-white mb-1">{{ file.name }}</h3>
                        <div class="text-sm text-gray-400 space-y-1">
                            <p>{{ formatFileSize(file.size) }}</p>
                            <p>{{ formatDate(file.modified) }}</p>
                        </div>
                    </div>
                </div>

                <!-- No Files Found -->
                <div v-else-if="!loadingLibrary" class="text-center py-12">
                    <svg class="w-16 h-16 text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 8v10a1 1 0 001 1h8a1 1 0 001-1V12M7 4h10M7 4L5 6m12-2l2 2"/>
                    </svg>
                    <p class="text-gray-400 text-lg">No media files found</p>
                    <p class="text-gray-500 text-sm mt-2">Make sure your media directory is mounted and contains video files</p>
                </div>
            </div>

            <!-- Video Player -->
            <div v-if="currentStream" class="space-y-6">
                <div class="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <!-- Back Button -->
                    <button
                        @click="stopStream"
                        class="mb-6 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                        </svg>
                        Back to Library
                    </button>

                    <!-- Video Container -->
                    <div class="relative bg-black rounded-lg overflow-hidden">
                        <video
                            ref="videoPlayer"
                            class="w-full h-auto"
                            controls
                            @loadedmetadata="onVideoLoaded"
                            @timeupdate="onTimeUpdate"
                            @seeking="onSeeking"
                            @seeked="onSeeked"
                            @error="onVideoError"
                        >
                            Your browser does not support the video tag.
                        </video>

                        <!-- Loading Overlay -->
                        <div
                            v-if="loadingStream"
                            class="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center"
                        >
                            <div class="text-center">
                                <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-400 mx-auto mb-4"></div>
                                <p class="text-lg">Starting stream...</p>
                                <p class="text-sm text-gray-400 mt-2">Preparing video segments</p>
                            </div>
                        </div>

                        <!-- Error Overlay -->
                        <div
                            v-if="videoError"
                            class="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center"
                        >
                            <div class="text-center">
                                <svg class="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                                <p class="text-lg text-red-400">Video Error</p>
                                <p class="text-sm text-gray-400 mt-2">{{ videoError }}</p>
                                <button
                                    @click="retryVideo"
                                    class="mt-4 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
                                >
                                    Retry
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Stream Info -->
                    <div v-if="streamInfo" class="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div class="bg-gray-900 rounded-lg p-4">
                            <h4 class="font-semibold text-blue-400 mb-2">Video Info</h4>
                            <p class="text-gray-300">Duration: {{ formatTime(streamInfo.duration) }}</p>
                            <p class="text-gray-300" v-if="currentTime">Current: {{ formatTime(currentTime) }}</p>
                            <p class="text-gray-400">Session: {{ streamInfo.sessionId.slice(0, 8) }}...</p>
                        </div>

                        <div class="bg-gray-900 rounded-lg p-4" v-if="streamInfo.metadata">
                            <h4 class="font-semibold text-blue-400 mb-2">Technical</h4>
                            <p class="text-gray-300" v-if="streamInfo.metadata.streams">
                                Video: {{ getVideoInfo(streamInfo.metadata) }}
                            </p>
                            <p class="text-gray-300" v-if="streamInfo.metadata.format?.bit_rate">
                                Bitrate: {{ Math.round(streamInfo.metadata.format.bit_rate / 1000) }} kbps
                            </p>
                        </div>

                        <div class="bg-gray-900 rounded-lg p-4">
                            <h4 class="font-semibold text-blue-400 mb-2">Progress</h4>
                            <div class="w-full bg-gray-700 rounded-full h-2 mb-2">
                                <div
                                    class="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    :style="{ width: `${((currentTime / (streamInfo.duration || 1)) * 100)}%` }"
                                ></div>
                            </div>
                            <p class="text-gray-300">{{ Math.round((currentTime / (streamInfo.duration || 1)) * 100) }}% complete</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Error Display -->
            <div v-if="error" class="bg-red-900 border border-red-700 rounded-lg p-4 mb-6">
                <div class="flex items-center gap-3">
                    <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <div>
                        <h3 class="font-semibold text-red-200">Error</h3>
                        <p class="text-red-300">{{ error }}</p>
                    </div>
                    <button
                        @click="error = null"
                        class="ml-auto text-red-400 hover:text-red-300"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import Hls from 'hls.js'

// Types
interface MediaFile {
    name: string
    path: string
    size: number
    modified: string
}

interface StreamInfo {
    sessionId: string
    duration: number
    playlistUrl: string
    metadata?: any
}

// Reactive state
const mediaFiles = ref<MediaFile[]>([])
const currentStream = ref<StreamInfo | null>(null)
const loadingLibrary = ref(false)
const loadingStream = ref(false)
const error = ref<string | null>(null)
const videoError = ref<string | null>(null)
const currentTime = ref(0)
const searchQuery = ref('')
const videoPlayer = ref<HTMLVideoElement | null>(null)
const streamInfo = ref<StreamInfo | null>(null)

// HLS instance
let hls: Hls | null = null

// API base URL - anpassen falls nötig
const API_BASE = 'http://localhost:3000/api'

// Computed
const filteredFiles = computed(() => {
    if (!searchQuery.value) return mediaFiles.value

    const query = searchQuery.value.toLowerCase()
    return mediaFiles.value.filter(file =>
        file.name.toLowerCase().includes(query) ||
        file.path.toLowerCase().includes(query)
    )
})

// Lifecycle
onMounted(() => {
    loadMediaLibrary()
})

onUnmounted(() => {
    if (hls) {
        hls.destroy()
    }
})

// Methods
async function loadMediaLibrary(forceRefresh = false): Promise<void> {
    try {
        loadingLibrary.value = true
        error.value = null

        const url = forceRefresh ? `${API_BASE}/media?refresh=true` : `${API_BASE}/media`
        const response = await fetch(url)

        if (!response.ok) {
            throw new Error('Failed to load media library')
        }

        const data = await response.json()
        mediaFiles.value = data.files
    } catch (err) {
        error.value = err instanceof Error ? err.message : 'Unknown error occurred'
    } finally {
        loadingLibrary.value = false
    }
}

async function startStream(file: MediaFile): Promise<void> {
    try {
        loadingStream.value = true
        error.value = null
        videoError.value = null

        const response = await fetch(`${API_BASE}/stream/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filePath: file.path
            })
        })

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to start stream')
        }

        const data = await response.json() as StreamInfo
        currentStream.value = data
        streamInfo.value = data

        // Initialize HLS player
        await initializePlayer(data.playlistUrl)

    } catch (err) {
        error.value = err instanceof Error ? err.message : 'Failed to start stream'
    } finally {
        loadingStream.value = false
    }
}

async function initializePlayer(playlistUrl: string): Promise<void> {
    if (!videoPlayer.value) return

    const video = videoPlayer.value
    const fullPlaylistUrl = `${API_BASE.replace('/api', '')}${playlistUrl}`

    if (Hls.isSupported()) {
        // Use HLS.js for browsers that support MSE
        hls = new Hls({
            debug: false,
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 90
        })

        hls.loadSource(fullPlaylistUrl)
        hls.attachMedia(video)

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('HLS manifest parsed, ready to play')
        })

        hls.on(Hls.Events.ERROR, (_, data) => {
            console.error('HLS error:', data)
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        console.error('Fatal network error, trying to recover...')
                        hls?.startLoad()
                        break
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.error('Fatal media error, trying to recover...')
                        hls?.recoverMediaError()
                        break
                    default:
                        console.error('Fatal error, cannot recover')
                        videoError.value = 'Failed to load video stream'
                        hls?.destroy()
                        break
                }
            }
        })

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        video.src = fullPlaylistUrl
    } else {
        videoError.value = 'HLS is not supported in this browser'
    }
}

async function stopStream(): Promise<void> {
    if (currentStream.value) {
        try {
            await fetch(`${API_BASE}/stream/${currentStream.value.sessionId}`, {
                method: 'DELETE'
            })
        } catch (err) {
            console.error('Error stopping stream:', err)
        }
    }

    if (hls) {
        hls.destroy()
        hls = null
    }

    currentStream.value = null
    streamInfo.value = null
    currentTime.value = 0
    videoError.value = null
}

async function seekToPosition(time: number): Promise<void> {
    if (!currentStream.value) return

    try {
        const response = await fetch(`${API_BASE}/stream/${currentStream.value.sessionId}/seek`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ time })
        })

        if (!response.ok) {
            throw new Error('Failed to seek')
        }

        console.log('Seek successful')
    } catch (err) {
        console.error('Seek error:', err)
    }
}

function retryVideo(): void {
    videoError.value = null
    if (streamInfo.value) {
        initializePlayer(streamInfo.value.playlistUrl)
    }
}

// Event handlers
function onVideoLoaded(): void {
    console.log('Video metadata loaded')
}

function onTimeUpdate(event: Event): void {
    const video = event.target as HTMLVideoElement
    currentTime.value = video.currentTime
}

function onSeeking(event: Event): void {
    const video = event.target as HTMLVideoElement
    console.log('Seeking to:', video.currentTime)
}

function onSeeked(event: Event): void {
    const video = event.target as HTMLVideoElement
    seekToPosition(video.currentTime)
}

function onVideoError(event: Event): void {
    const video = event.target as HTMLVideoElement
    videoError.value = `Video error: ${video.error?.message || 'Unknown error'}`
}

// Utility functions
function formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

function formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    } else {
        return `${minutes}:${secs.toString().padStart(2, '0')}`
    }
}

function formatDate(dateString: string): string {
    const date = new Date(dateString)
    return date.toLocaleDateString('de-DE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    })
}

function getVideoInfo(metadata: any): string {
    const videoStream = metadata.streams?.find((s: any) => s.codec_type === 'video')
    if (!videoStream) return 'Unknown'

    const width = videoStream.width
    const height = videoStream.height
    const codec = videoStream.codec_name

    return `${width}x${height} (${codec})`
}
</script>