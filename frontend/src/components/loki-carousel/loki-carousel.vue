<template>
    <div class="carousel-container">
        <!-- Carousel Container -->
        <div
            class="relative w-full h-full"
            @mouseenter="pauseAutoplay"
            @mouseleave="resumeAutoplay"
            :style="containerStyles"
        >
            <!-- Slides container for 'none/slide' transition -->
            <div v-if="transitionType !== 'fade'" class="slides-container" ref="slidesContainer"
                 :class="{'slide-transition-slide': transitionType === 'slide', 'slide-transition-none': transitionType === 'none'}"
                 :style="slideStyles"
            >
                <div v-for="(slide, index) in allSlides" :key="`slide-${index}`"
                     class="flex-shrink-0 h-full relative"
                     :style="getSlideStyle(index)"
                >
                    <slot :name="`slide-${getOriginalSlideIndex(index)}`" :slideIndex="getOriginalSlideIndex(index)"></slot>
                </div>
            </div>

            <!-- Slides container for 'fade' transition -->
            <div v-if="transitionType === 'fade'" class="relative w-full h-full">
                <!-- Hidden slides für Höhenmessung -->
                <div
                    v-for="(_, index) in originalSlideCount"
                    :key="`measure-slide-${index}`"
                    ref="measureSlides"
                    class="absolute inset-0 w-full opacity-0 pointer-events-none z-[-1]"
                    :style="{ visibility: slideHeightCalculated ? 'hidden' : 'visible' }"
                >
                    <slot :name="`slide-${index}`" :slideIndex="index"></slot>
                </div>

                <!-- Sichtbare slides -->
                <div v-for="(_, index) in originalSlideCount" :key="`fade-slide-${index}`"
                     class="absolute inset-0 w-full h-full transition-opacity ease-in-out"
                     :style="{transitionDuration: `${props.transitionDelay}ms`}"
                     :class="{'opacity-100 z-10': index === currentSlide, 'opacity-0 z-0': index !== currentSlide}"
                >
                    <slot :name="`slide-${index}`" :slideIndex="index"></slot>
                </div>
            </div>

            <!-- Navigation Arrows -->
            <button v-if="arrows" @click="previousSlide" class="btn-arrow-left">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                </svg>
            </button>

            <button v-if="arrows" @click="nextSlide" class="btn-arrow-right">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
            </button>

            <!-- Dot Navigation - Single -->
            <div v-if="dots && props.slidesPerView === 1" class="dots-container-single">
                <button v-for="(_, index) in originalSlideCount" :key="`dot-${index}`"
                        @click="goToSlideByDot(index)"
                        class="dot"
                        :class="{'dot-active': index === getCurrentDotIndex(), 'dot-base': index !== getCurrentDotIndex()}"
                />
            </div>

            <!-- Dot Navigation - Multiple -->
            <div v-if="dots && props.slidesPerView > 1" class="dots-container-multiple">
                <button v-for="(_, index) in originalSlideCount" :key="`dot-${index}`"
                        @click="goToSlideByDot(index)"
                        class="dot"
                        :class="{'dot-active': isSlideCurrentlyVisible(index), 'dot-base': !isSlideCurrentlyVisible(index)}"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, useSlots, nextTick } from 'vue'

export interface CarouselProps {
    autoplayDelay?: number
    infinite?: boolean
    transitionType?: 'slide' | 'fade' | 'none'
    transitionDelay?: number;
    dots?: boolean
    arrows?: boolean
    height?: string
    slidesPerView?: number
    slidesToScroll?: number
    gap?: string
}

const props = withDefaults(defineProps<CarouselProps>(), {
    autoplayDelay: -1,
    infinite: true,
    transitionType: 'slide',
    transitionDelay: 500,
    dots: true,
    arrows: true,
    height: '16rem',
    slidesPerView: 1,
    slidesToScroll: 1,
    gap: '0rem'
})

const slots = useSlots()
const slidesContainer = ref<HTMLElement>()
const measureSlides = ref<HTMLElement[]>([])
const currentSlide = ref(0)
const calculatedHeight = ref<number>(0)
const slideHeightCalculated = ref(false)
let autoplayTimer: NodeJS.Timeout | null = null
let isTransitioning = ref(false)

// Berechne die Anzahl der Original-Slides basierend auf den Slots
const originalSlideCount = computed(() => {
    const slideSlots = Object.keys(slots).filter(key => key.startsWith('slide-'))
    return slideSlots.length || 3 // Fallback für Demo-Zwecke
})

// Container Styles - verwendet berechnete Höhe bei fade transition
const containerStyles = computed(() => {
    if (props.transitionType === 'fade' && slideHeightCalculated.value && calculatedHeight.value > 0) {
        return {
            height: `${calculatedHeight.value}px`
        }
    }
    return {
        height: props.height
    }
})

// Berechne Slide-Höhen für fade transition
const calculateSlideHeights = async () => {
    if (props.transitionType !== 'fade') {
        slideHeightCalculated.value = true
        return
    }

    await nextTick()

    let maxHeight = 0

    if (measureSlides.value && measureSlides.value.length > 0) {
        measureSlides.value.forEach((slideEl) => {
            if (slideEl) {
                // Temporär sichtbar machen für Messung
                slideEl.style.position = 'static'
                slideEl.style.visibility = 'visible'
                slideEl.style.opacity = '1'

                const height = slideEl.offsetHeight
                if (height > maxHeight) {
                    maxHeight = height
                }

                // Zurück zu ursprünglichem Zustand
                slideEl.style.position = 'absolute'
                slideEl.style.visibility = 'hidden'
                slideEl.style.opacity = '0'
            }
        })
    }

    if (maxHeight > 0) {
        calculatedHeight.value = maxHeight
    }

    slideHeightCalculated.value = true
}

// Watch für Slot-Änderungen um Höhe neu zu berechnen
watch(() => originalSlideCount.value, () => {
    if (props.transitionType === 'fade') {
        slideHeightCalculated.value = false
        nextTick(() => {
            calculateSlideHeights()
        })
    }
})

// Watch für transition type Änderungen
watch(() => props.transitionType, () => {
    if (props.transitionType === 'fade') {
        slideHeightCalculated.value = false
        nextTick(() => {
            calculateSlideHeights()
        })
    } else {
        slideHeightCalculated.value = true
    }
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
    let normalizedCurrentSlide = currentSlide.value;

    if (props.infinite) {
        while (normalizedCurrentSlide < 0) {
            normalizedCurrentSlide += originalSlideCount.value;
        }
        normalizedCurrentSlide = normalizedCurrentSlide % originalSlideCount.value;
    }

    const start = normalizedCurrentSlide;
    const end = normalizedCurrentSlide + props.slidesPerView - 1;

    if (end >= originalSlideCount.value && props.infinite) {
        const normalEnd = end % originalSlideCount.value;
        return (slideIndex >= start) || (slideIndex <= normalEnd);
    }
    return slideIndex >= start && slideIndex <= end;
}

const goToSpecificSlide = (slideIndex: number) => {
    if (isTransitioning.value) return

    const maxPosition = originalSlideCount.value - props.slidesPerView
    const targetPosition = Math.min(slideIndex, maxPosition)

    currentSlide.value = Math.max(0, targetPosition)
    isTransitioning.value = true

    setTimeout(() => {
        isTransitioning.value = false
    }, props.transitionType === 'slide' ? props.transitionDelay : 0)
}

const goToSlideByDot = (dotIndex: number) => {
    if (props.slidesPerView === 1) {
        if (props.transitionType === 'fade') {
            currentSlide.value = dotIndex
            return
        }
        goToSpecificSlide(dotIndex)
    } else {
        const maxSlide = originalSlideCount.value - props.slidesPerView
        const targetSlide = Math.max(0, Math.min(dotIndex, maxSlide))

        if (isTransitioning.value) return

        currentSlide.value = targetSlide
        isTransitioning.value = true

        setTimeout(() => {
            isTransitioning.value = false
        }, props.transitionType === 'slide' ? props.transitionDelay : 0)
    }
}

const slideStyles = computed(() => {
    if (props.transitionType === 'fade') {
        return {}
    }

    const slideWidthWithGap = `(${slideWidth.value} + ${props.gap})`
    const translateX = `calc(-${getCurrentSlideIndex()} * ${slideWidthWithGap})`

    return { transform: `translateX(${translateX})`, transitionDuration: `${props.transitionDelay}ms` }
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
            }, props.transitionType === 'slide' ? props.transitionDelay : 0)
        } else {
            setTimeout(() => {
                isTransitioning.value = false
            }, props.transitionType === 'slide' ? props.transitionDelay : 0)
        }
    } else {
        if (currentSlide.value + props.slidesToScroll <= maxSlide) {
            currentSlide.value += props.slidesToScroll
        } else {
            currentSlide.value = maxSlide
        }
        setTimeout(() => {
            isTransitioning.value = false
        }, props.transitionType === 'slide' ? props.transitionDelay : 0)
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
            }, props.transitionType === 'slide' ? props.transitionDelay : 0)
        } else {
            setTimeout(() => {
                isTransitioning.value = false
            }, props.transitionType === 'slide' ? props.transitionDelay : 0)
        }
    } else {
        if (currentSlide.value - props.slidesToScroll >= 0) {
            currentSlide.value -= props.slidesToScroll
        } else {
            currentSlide.value = 0
        }
        setTimeout(() => {
            isTransitioning.value = false
        }, props.transitionType === 'slide' ? props.transitionDelay : 0)
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
    }, props.transitionType === 'slide' ? props.transitionDelay : 0)
}

const startAutoplay = () => {
    if (props.autoplayDelay === -1) return

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
    if (props.autoplayDelay !== -1) {
        stopAutoplay()
    }
}

const resumeAutoplay = () => {
    if (props.autoplayDelay !== -1) {
        startAutoplay()
    }
}

watch(() => props.autoplayDelay, () => {
    stopAutoplay()
    if (props.autoplayDelay !== -1) {
        startAutoplay()
    }
})

onMounted(() => {
    if (props.autoplayDelay !== -1) {
        startAutoplay()
    }

    // Höhe für fade transition berechnen
    if (props.transitionType === 'fade') {
        nextTick(() => {
            calculateSlideHeights()
        })
    } else {
        slideHeightCalculated.value = true
    }
})

onUnmounted(() => {
    stopAutoplay()
})

defineExpose({
    nextSlide,
    previousSlide,
    goToSlide,
    getCurrentSlide: () => currentSlide.value,
    recalculateHeight: calculateSlideHeights
})
</script>

<style scoped lang="postcss">
.carousel-container {
    @apply relative w-full overflow-hidden;
}

.slides-container {
    @apply flex w-full h-full;
}

.slide-transition-none {
    @apply transition-none;
}

.slide-transition-slide {
    @apply transition-transform;
    transition-timing-function: cubic-bezier(0.802, 0.02, 0.39, 1.01) !important;
}

.btn-arrow-left {
    @apply absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-2 rounded-full transition-all duration-200 backdrop-blur-sm z-20;
}

.btn-arrow-right {
    @apply absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-2 rounded-full transition-all duration-200 backdrop-blur-sm z-20;
}

.dots-container-single {
    @apply absolute bottom-4 left-1/2 transform -translate-x-1/2 flex justify-center gap-1.5 z-20;
}

.dots-container-multiple {
    @apply absolute bottom-4 left-1/2 transform -translate-x-1/2 flex justify-center gap-1.5 z-20;
}

.dot {
    @apply w-2.5 h-2.5 rounded-full transition-all duration-200 backdrop-blur-sm;
}

.dot-base {
    @apply bg-white bg-opacity-50 hover:bg-opacity-75;
}

.dot-active {
    @apply bg-white;
}
</style>