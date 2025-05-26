<template>
    <div class="relative w-full overflow-hidden">
        <!-- Carousel Container -->
        <div
            class="relative w-full h-64"
            @mouseenter="pauseAutoplay"
            @mouseleave="resumeAutoplay"
        >
            <!-- Slides Container -->
            <div
                v-if="transitionType !== 'fade'"
                ref="slidesContainer"
                class="flex w-full h-full"
                :class="{
          'transition-transform duration-500 ease-in-out': transitionType === 'slide',
          'transition-none': transitionType === 'none'
        }"
                :style="slideStyles"
            >
                <!-- Slides for slide/none transition -->
                <div
                    v-for="(slide, index) in allSlides"
                    :key="`slide-${index}`"
                    class="flex-shrink-0 h-full relative"
                    :style="getSlideStyle(index)"
                >
                    <slot :name="`slide-${getOriginalSlideIndex(index)}`" :slideIndex="getOriginalSlideIndex(index)">
                        <div class="w-full h-full flex items-center justify-center bg-gradient-to-r from-blue-400 to-purple-500 text-white text-xl font-bold">
                            Slide {{ getOriginalSlideIndex(index) + 1 }}
                        </div>
                    </slot>
                </div>
            </div>

            <!-- Fade Transition Container -->
            <div v-if="transitionType === 'fade'" class="relative w-full h-full">
                <div
                    v-for="(_, index) in originalSlideCount"
                    :key="`fade-slide-${index}`"
                    class="absolute inset-0 w-full h-full transition-opacity duration-500 ease-in-out"
                    :class="{
            'opacity-100 z-10': index === currentSlide,
            'opacity-0 z-0': index !== currentSlide
          }"
                >
                    <slot :name="`slide-${index}`" :slideIndex="index">
                        <div class="w-full h-full flex items-center justify-center bg-gradient-to-r from-blue-400 to-purple-500 text-white text-xl font-bold">
                            Slide {{ index + 1 }}
                        </div>
                    </slot>
                </div>
            </div>

            <!-- Navigation Arrows -->
            <button
                v-if="showArrows"
                @click="previousSlide"
                class="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-2 rounded-full transition-all duration-200 backdrop-blur-sm z-20"
            >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                </svg>
            </button>

            <button
                v-if="showArrows"
                @click="nextSlide"
                class="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-2 rounded-full transition-all duration-200 backdrop-blur-sm z-20"
            >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
            </button>

            <!-- Dots Indicator -->
            <div v-if="showDots" class="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex justify-center space-x-3 z-20">
                <!-- Bei einzelnen Slides: Standard Dots -->
                <template v-if="props.slidesPerView === 1">
                    <button
                        v-for="(_, index) in originalSlideCount"
                        :key="`dot-${index}`"
                        @click="goToSlideByDot(index)"
                        class="w-3 h-3 rounded-full transition-all duration-200 backdrop-blur-sm"
                        :class="{
              'bg-white': index === getCurrentDotIndex(),
              'bg-white bg-opacity-50 hover:bg-opacity-75': index !== getCurrentDotIndex()
            }"
                    />
                </template>

                <!-- Bei mehreren Slides: Gruppierte Slide-Dots -->
                <template v-else>
                    <div
                        v-for="groupIndex in Math.ceil(originalSlideCount / props.slidesPerView)"
                        :key="`group-${groupIndex}`"
                        class="flex items-center space-x-1 px-2 py-1 backdrop-blur-sm bg-opacity-10"
                    >
                        <button
                            v-for="slideIndex in getSlidesInGroup(groupIndex - 1)"
                            :key="`slide-dot-${slideIndex}`"
                            @click="goToSpecificSlide(slideIndex)"
                            class="w-2 h-2 rounded-full transition-all duration-200"
                            :class="{
                'bg-white': isSlideCurrentlyVisible(slideIndex),
                'bg-white bg-opacity-40 hover:bg-opacity-60': !isSlideCurrentlyVisible(slideIndex)
              }"
                        />
                    </div>
                </template>
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
    slidesPerView?: number
    slidesToScroll?: number
    gap?: string
}

const props = withDefaults(defineProps<CarouselProps>(), {
    autoplay: false,
    autoplayDelay: 3000,
    infinite: true,
    transitionType: 'slide',
    showDots: true,
    showArrows: true,
    height: '16rem',
    slidesPerView: 1,
    slidesToScroll: 1,
    gap: '0rem'
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

// Berechne die Slide-Breite basierend auf slidesPerView und Gap
const slideWidth = computed(() => {
    if (props.slidesPerView === 1) return '100%'
    return `calc((100% - ${(props.slidesPerView - 1)} * ${props.gap}) / ${props.slidesPerView})`
})

// Funktion für individuelle Slide-Styles
const getSlideStyle = (index: number) => {
    const isLastSlide = index === allSlides.value.length - 1
    return {
        width: slideWidth.value,
        marginRight: isLastSlide ? '0' : props.gap
    }
}

// Gap zwischen Slides
const slideGap = computed(() => props.gap)

// Für infinite scrolling erstellen wir zusätzliche Slides (nur bei slide/none transition)
const allSlides = computed(() => {
    if (props.transitionType === 'fade') {
        return Array.from({ length: originalSlideCount.value }, (_, i) => i)
    }

    if (!props.infinite) {
        return Array.from({ length: originalSlideCount.value }, (_, i) => i)
    }

    // Für infinite scrolling: Original + Kopien am Anfang und Ende
    const slides = []

    // Genug Slides am Anfang kopieren für smooth transition
    for (let i = 0; i < props.slidesPerView; i++) {
        const index = originalSlideCount.value - props.slidesPerView + i
        slides.push(index >= 0 ? index : originalSlideCount.value + index)
    }

    // Alle Original-Slides
    for (let i = 0; i < originalSlideCount.value; i++) {
        slides.push(i)
    }

    // Genug Slides am Ende kopieren für smooth transition
    for (let i = 0; i < props.slidesPerView; i++) {
        slides.push(i)
    }

    return slides
})

// Berechne den aktuellen Slide-Index für die Anzeige
const getCurrentSlideIndex = () => {
    if (props.transitionType === 'fade') {
        return currentSlide.value
    }
    return props.infinite ? currentSlide.value + props.slidesPerView : currentSlide.value
}

// Hole den ursprünglichen Slide-Index
const getOriginalSlideIndex = (index: number) => {
    return allSlides.value[index]
}

// Berechne die Anzahl der Dots basierend auf slidesPerView und slidesToScroll
const dotCount = computed(() => {
    if (props.transitionType === 'fade') {
        return originalSlideCount.value
    }

    if (props.slidesPerView >= originalSlideCount.value) {
        return 1
    }

    const visibleSlides = originalSlideCount.value - props.slidesPerView + 1
    return Math.ceil(visibleSlides / props.slidesToScroll)
})

// Berechne welcher Dot aktiv sein soll
const getCurrentDotIndex = () => {
    if (props.transitionType === 'fade') {
        return currentSlide.value
    }

    return Math.floor(currentSlide.value / props.slidesToScroll)
}

// Hilfsfunktionen für Multi-Slide Dots
const getSlidesInGroup = (groupIndex: number) => {
    const startSlide = groupIndex * props.slidesPerView
    const slides = []

    for (let i = 0; i < props.slidesPerView; i++) {
        const slideIndex = startSlide + i
        if (slideIndex < originalSlideCount.value) {
            slides.push(slideIndex)
        }
    }

    return slides
}

const isSlideCurrentlyVisible = (slideIndex: number) => {
    const currentStart = currentSlide.value
    const currentEnd = currentStart + props.slidesPerView - 1
    return slideIndex >= currentStart && slideIndex <= currentEnd
}

const goToSpecificSlide = (slideIndex: number) => {
    if (isTransitioning.value) return

    // Berechne die Position so, dass die gewünschte Slide sichtbar ist
    const maxPosition = originalSlideCount.value - props.slidesPerView
    const targetPosition = Math.min(slideIndex, maxPosition)

    currentSlide.value = Math.max(0, targetPosition)
    isTransitioning.value = true

    setTimeout(() => {
        isTransitioning.value = false
    }, props.transitionType === 'slide' ? 500 : 0)
}

const goToSlideByDot = (dotIndex: number) => {
    if (props.slidesPerView === 1) {
        // Bei einzelnen Slides: Direkt zu Slide
        if (props.transitionType === 'fade') {
            currentSlide.value = dotIndex
            return
        }
        goToSpecificSlide(dotIndex)
    }
}

// Berechne die Slide-Styles
const slideStyles = computed(() => {
    if (props.transitionType === 'fade') {
        return {}
    }

    // Einfache Berechnung: Jede Slide + Gap ist eine Einheit
    const slideWidthWithGap = `(${slideWidth.value} + ${props.gap})`
    const translateX = `calc(-${getCurrentSlideIndex()} * ${slideWidthWithGap})`

    return {
        transform: `translateX(${translateX})`
    }
})

const nextSlide = () => {
    if (isTransitioning.value) return

    if (props.transitionType === 'fade') {
        currentSlide.value = (currentSlide.value + 1) % originalSlideCount.value
        return
    }

    isTransitioning.value = true

    const maxSlide = originalSlideCount.value - props.slidesPerView

    if (props.infinite) {
        currentSlide.value += props.slidesToScroll

        // Wenn wir über das Ende hinaus sind
        if (currentSlide.value > maxSlide) {
            setTimeout(() => {
                if (slidesContainer.value) {
                    slidesContainer.value.style.transition = 'none'
                    currentSlide.value = currentSlide.value - originalSlideCount.value

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
        if (currentSlide.value + props.slidesToScroll <= maxSlide) {
            currentSlide.value += props.slidesToScroll
        } else {
            currentSlide.value = maxSlide
        }
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
        currentSlide.value -= props.slidesToScroll

        // Wenn wir unter 0 sind
        if (currentSlide.value < 0) {
            setTimeout(() => {
                if (slidesContainer.value) {
                    slidesContainer.value.style.transition = 'none'
                    currentSlide.value = currentSlide.value + originalSlideCount.value

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
        if (currentSlide.value - props.slidesToScroll >= 0) {
            currentSlide.value -= props.slidesToScroll
        } else {
            currentSlide.value = 0
        }
        setTimeout(() => {
            isTransitioning.value = false
        }, props.transitionType === 'slide' ? 500 : 0)
    }
}

const goToSlide = (dotIndex: number) => {
    if (isTransitioning.value) return

    if (props.transitionType === 'fade') {
        currentSlide.value = dotIndex
        return
    }

    const targetSlide = dotIndex * props.slidesToScroll
    const maxSlide = originalSlideCount.value - props.slidesPerView

    currentSlide.value = Math.min(targetSlide, maxSlide)
    isTransitioning.value = true

    setTimeout(() => {
        isTransitioning.value = false
    }, props.transitionType === 'slide' ? 500 : 0)
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

<style scoped>
/* Zusätzliche Styles falls nötig */
</style>