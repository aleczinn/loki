<template>
    <div class="relative w-full overflow-hidden">
        <!-- Carousel Container -->
        <div class="relative w-full h-64"
             @mouseenter="pauseAutoplay"
             @mouseleave="resumeAutoplay"
        >
            <!-- Slides Container -->
            <div ref="slidesContainer"
                 class="flex w-full h-full"
                 :class="{'transition-transform duration-500 ease-in-out': transitionType === 'slide', 'transition-none': transitionType === 'none'}"
                 :style="slideStyles"
            >
                <!-- Slides -->
                <div v-for="(slide, index) in allSlides"
                     :key="`slide-${index}`"
                     class="flex-shrink-0 w-full h-full relative"
                     :class="{'opacity-100': transitionType === 'fade' && index === getCurrentSlideIndex(), 'opacity-0': transitionType === 'fade' && index !== getCurrentSlideIndex(), 'transition-opacity duration-500 ease-in-out': transitionType === 'fade'}"
                >
                    <slot :name="`slide-${getOriginalSlideIndex(index)}`" :slideIndex="getOriginalSlideIndex(index)">
                        <div
                            class="w-full h-full flex items-center justify-center bg-gradient-to-r from-blue-400 to-purple-500 text-white text-xl font-bold">
                            Slide {{ getOriginalSlideIndex(index) + 1 }}
                        </div>
                    </slot>
                </div>
            </div>

            <!-- Navigation Arrows -->
            <button v-if="showArrows"
                    @click="previousSlide"
                    class="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-2 rounded-full transition-all duration-200 backdrop-blur-sm"
            >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                </svg>
            </button>

            <button v-if="showArrows"
                    @click="nextSlide"
                    class="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-2 rounded-full transition-all duration-200 backdrop-blur-sm"
            >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
            </button>

            <!-- Dots Indicator -->
            <div v-if="showDots"
                 class="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex justify-center space-x-2">
                <button v-for="(_, index) in originalSlideCount"
                        :key="`dot-${index}`"
                        @click="goToSlide(index)"
                        class="w-3 h-3 rounded-full transition-all duration-200 backdrop-blur-sm"
                        :class="{'bg-white': index === currentSlide, 'bg-white bg-opacity-50 hover:bg-opacity-75': index !== currentSlide}"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, useSlots } from 'vue'

export interface CarouselProps {
    autoplay?: boolean
    autoplayDelay?: number
    infinite?: boolean
    transitionType?: 'slide' | 'fade' | 'none'
    showDots?: boolean
    showArrows?: boolean
    height?: string
}

const props = withDefaults(defineProps<CarouselProps>(), {
    autoplay: false,
    autoplayDelay: 3000,
    infinite: true,
    transitionType: 'slide',
    showDots: true,
    showArrows: true,
    height: '16rem'
})

const slots = useSlots()
const slidesContainer = ref<HTMLElement>()
const currentSlide = ref(0)
let autoplayTimer: NodeJS.Timeout | null = null
let isTransitioning = ref(false)

// Berechne die Anzahl der Original-Slides basierend auf den Slots
const originalSlideCount = computed(() => {
    const slideSlots = Object.keys(slots).filter(key => key.startsWith('slide-'))
    return slideSlots.length || 3 // Fallback für Demo-Zwecke
})

// Für infinite scrolling erstellen wir zusätzliche Slides
const allSlides = computed(() => {
    if (!props.infinite) {
        return Array.from({ length: originalSlideCount.value }, (_, i) => i)
    }

    // Für infinite scrolling: Original + Kopien am Anfang und Ende
    const slides = []

    // Letzte Slide am Anfang (für smooth transition von erste zu letzte)
    slides.push(originalSlideCount.value - 1)

    // Alle Original-Slides
    for (let i = 0; i < originalSlideCount.value; i++) {
        slides.push(i)
    }

    // Erste Slide am Ende (für smooth transition von letzte zu erste)
    slides.push(0)

    return slides
})

// Berechne den aktuellen Slide-Index basierend auf dem Transition-Typ
const getCurrentSlideIndex = () => {
    if (props.transitionType === 'fade') {
        return currentSlide.value
    }
    return props.infinite ? currentSlide.value + 1 : currentSlide.value
}

// Hole den ursprünglichen Slide-Index
const getOriginalSlideIndex = (index: number) => {
    return allSlides.value[index]
}

// Berechne die Slide-Styles
const slideStyles = computed(() => {
    if (props.transitionType === 'fade') {
        return {}
    }

    const translateX = -getCurrentSlideIndex() * 100
    return {
        transform: `translateX(${translateX}%)`
    }
})

const nextSlide = () => {
    if (isTransitioning.value) return

    if (props.transitionType === 'fade') {
        currentSlide.value = (currentSlide.value + 1) % originalSlideCount.value
        return
    }

    isTransitioning.value = true

    if (props.infinite) {
        currentSlide.value++

        // Wenn wir bei der letzten kopierten Slide sind, springe zurück zur ersten originalen
        if (currentSlide.value >= originalSlideCount.value) {
            setTimeout(() => {
                if (slidesContainer.value) {
                    slidesContainer.value.style.transition = 'none'
                    currentSlide.value = 0

                    // Force reflow
                    slidesContainer.value.offsetHeight

                    setTimeout(() => {
                        if (slidesContainer.value) {
                            slidesContainer.value.style.transition = ''
                        }
                        isTransitioning.value = false
                    }, 50)
                }
            }, props.transitionType === 'slide' ? 500 : 0)
        } else {
            setTimeout(() => {
                isTransitioning.value = false
            }, props.transitionType === 'slide' ? 500 : 0)
        }
    } else {
        currentSlide.value = (currentSlide.value + 1) % originalSlideCount.value
        setTimeout(() => {
            isTransitioning.value = false
        }, props.transitionType === 'slide' ? 500 : 0)
    }
}

const previousSlide = () => {
    if (isTransitioning.value) return

    if (props.transitionType === 'fade') {
        currentSlide.value = currentSlide.value === 0 ? originalSlideCount.value - 1 : currentSlide.value - 1
        return
    }

    isTransitioning.value = true

    if (props.infinite) {
        currentSlide.value--

        // Wenn wir bei der ersten kopierten Slide sind, springe zur letzten originalen
        if (currentSlide.value < 0) {
            setTimeout(() => {
                if (slidesContainer.value) {
                    slidesContainer.value.style.transition = 'none'
                    currentSlide.value = originalSlideCount.value - 1

                    // Force reflow
                    slidesContainer.value.offsetHeight

                    setTimeout(() => {
                        if (slidesContainer.value) {
                            slidesContainer.value.style.transition = ''
                        }
                        isTransitioning.value = false
                    }, 50)
                }
            }, props.transitionType === 'slide' ? 500 : 0)
        } else {
            setTimeout(() => {
                isTransitioning.value = false
            }, props.transitionType === 'slide' ? 500 : 0)
        }
    } else {
        currentSlide.value = currentSlide.value === 0 ? originalSlideCount.value - 1 : currentSlide.value - 1
        setTimeout(() => {
            isTransitioning.value = false
        }, props.transitionType === 'slide' ? 500 : 0)
    }
}

const goToSlide = (index: number) => {
    if (isTransitioning.value || index === currentSlide.value) return

    currentSlide.value = index
    isTransitioning.value = true

    setTimeout(() => {
        isTransitioning.value = false
    }, props.transitionType === 'slide' ? 500 : props.transitionType === 'fade' ? 500 : 0)
}

const startAutoplay = () => {
    if (!props.autoplay) return

    autoplayTimer = setInterval(() => {
        nextSlide()
    }, props.autoplayDelay)
}

const stopAutoplay = () => {
    if (autoplayTimer) {
        clearInterval(autoplayTimer)
        autoplayTimer = null
    }
}

const pauseAutoplay = () => {
    if (props.autoplay) {
        stopAutoplay()
    }
}

const resumeAutoplay = () => {
    if (props.autoplay) {
        startAutoplay()
    }
}

// Watch für Autoplay-Änderungen
watch(() => props.autoplay, (newVal) => {
    if (newVal) {
        startAutoplay()
    } else {
        stopAutoplay()
    }
})

watch(() => props.autoplayDelay, () => {
    if (props.autoplay) {
        stopAutoplay()
        startAutoplay()
    }
})

onMounted(() => {
    if (props.autoplay) {
        startAutoplay()
    }
})

onUnmounted(() => {
    stopAutoplay()
})

// Expose methods for parent component
defineExpose({
    nextSlide,
    previousSlide,
    goToSlide,
    getCurrentSlide: () => currentSlide.value
})
</script>

<style scoped lang="postcss">

</style>