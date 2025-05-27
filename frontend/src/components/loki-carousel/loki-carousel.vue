<template>
    <div class="carousel">
        <div class="carousel-container" @mouseenter="pauseAutoplay" @mouseleave="resumeAutoplay" :style="carouselContainerStyles">
            <!-- slides container for 'none/slide' transition -->
            <div v-if="config.transitionType !== 'fade'" ref="slidesContainer" :class="slideContainerClasses" :style="slideContainerStyles">
                <div v-for="(_, index) in computedSlides" :key="`slide-${index}`" class="slide" :style="slideStyles(index)">
                    <slot :name="`slide-${getOriginalSlideIndex(index)}`" :slideIndex="getOriginalSlideIndex(index)"></slot>
                </div>
            </div>

            <!-- slides container for 'fade' transition -->
            <div v-if="config.transitionType === 'fade'" class="relative w-full h-full">
                <!-- hidden slides for height-measurement -->
                <div v-for="(_, index) in originalSlideCount"
                    :key="`measure-slide-${index}`"
                    ref="measureSlides"
                    class="absolute inset-0 w-full opacity-0 pointer-events-none z-[-1]"
                    :style="{ visibility: slideHeightCalculated ? 'hidden' : 'visible' }"
                >
                    <slot :name="`slide-${index}`" :slideIndex="index"></slot>
                </div>

                <!-- visible slides -->
                <div v-for="(_, index) in originalSlideCount" :key="`fade-slide-${index}`"
                     class="absolute inset-0 w-full h-full transition-opacity ease-in-out"
                     :style="{transitionDuration: `${config.transitionDelay}ms`}"
                     :class="{'opacity-100 z-10': index === currentSlide, 'opacity-0 z-0': index !== currentSlide}"
                >
                    <slot :name="`slide-${index}`" :slideIndex="index"></slot>
                </div>
            </div>

            <!-- navigation arrows -->
            <button v-if="config.arrows" @click="previousSlide" class="btn-arrow-left">
                <icon-arrow-left class="w-6 h-6"></icon-arrow-left>
            </button>

            <button v-if="config.arrows" @click="nextSlide" class="btn-arrow-right">
                <icon-arrow-right class="w-6 h-6"></icon-arrow-right>
            </button>

            <!-- dot bavigation - single -->
            <div v-if="config.dots && config.slidesPerView === 1" class="dots-container">
                <button v-for="(_, index) in originalSlideCount" :key="`dot-${index}`" @click="slideTo(index)" :class="dotClasses(index)"/>
            </div>

            <!-- dot navigation - multiple -->
            <div v-if="config.dots && config.slidesPerView > 1" class="dots-container">
                <button v-for="(_, index) in originalSlideCount" :key="`dot-${index}`" @click="slideTo(index)" :class="dotClasses(index)"/>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, useSlots, nextTick } from 'vue'
import IconArrowLeft from "@/icons/icon-arrow-left.vue";
import IconArrowRight from "@/icons/icon-arrow-right.vue";

export interface ResponsiveConfig {
    autoplayDelay?: number
    infinite?: boolean
    transitionType?: 'slide' | 'fade' | 'none'
    transitionDelay?: number
    dots?: boolean
    arrows?: boolean
    height?: string
    slidesPerView?: number
    slidesToScroll?: number
    gap?: string
}

export interface ResponsiveBreakpoints {
    sm?: ResponsiveConfig   // 640px+
    md?: ResponsiveConfig   // 768px+
    lg?: ResponsiveConfig   // 1024px+
    xl?: ResponsiveConfig   // 1280px+
    '2xl'?: ResponsiveConfig // 1536px+
    '3xl'?: ResponsiveConfig // 1792px+
    '4xl'?: ResponsiveConfig // 2048px+
}

export interface CarouselProps extends ResponsiveConfig {
    responsive?: ResponsiveBreakpoints
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
const windowWidth = ref(0)
let autoplayTimer: NodeJS.Timeout | null = null
let isTransitioning = ref(false)

const breakpoints = {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536,
    '3xl': 1792,
    '4xl': 2048
} as const

type BreakpointKey = keyof typeof breakpoints

// Aktuellen Breakpoint bestimmen (mobile-first approach wie Tailwind)
const currentBreakpoint = computed((): BreakpointKey | 'base' => {
    if (windowWidth.value >= breakpoints['4xl']) return '4xl'
    if (windowWidth.value >= breakpoints['3xl']) return '3xl'
    if (windowWidth.value >= breakpoints['2xl']) return '2xl'
    if (windowWidth.value >= breakpoints.xl) return 'xl'
    if (windowWidth.value >= breakpoints.lg) return 'lg'
    if (windowWidth.value >= breakpoints.md) return 'md'
    if (windowWidth.value >= breakpoints.sm) return 'sm'
    return 'base' // < 640px
})

const config = computed((): Required<ResponsiveConfig> => {
    const baseConfig: Required<ResponsiveConfig> = {
        autoplayDelay: props.autoplayDelay,
        infinite: props.infinite,
        transitionType: props.transitionType,
        transitionDelay: props.transitionDelay,
        dots: props.dots,
        arrows: props.arrows,
        height: props.height,
        slidesPerView: props.slidesPerView,
        slidesToScroll: props.slidesToScroll,
        gap: props.gap
    }

    if (!props.responsive) {
        return baseConfig
    }

    // Mobile-first cascade - jeder Breakpoint erbt von vorherigen
    let mergedConfig = { ...baseConfig }

    // Definiere die Reihenfolge der Breakpoints (mobile-first)
    const breakpointOrder: (BreakpointKey | 'base')[] = ['base', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl']
    const currentIndex = breakpointOrder.indexOf(currentBreakpoint.value)

    // Wende alle Breakpoint-Configs bis zum aktuellen an
    for (let i = 1; i <= currentIndex; i++) {
        const breakpointKey = breakpointOrder[i] as BreakpointKey
        const breakpointConfig = props.responsive[breakpointKey]

        if (breakpointConfig) {
            mergedConfig = {
                ...mergedConfig,
                ...Object.fromEntries(
                    Object.entries(breakpointConfig).filter(([_, value]) => value !== undefined)
                )
            } as Required<ResponsiveConfig>
        }
    }

    return mergedConfig
})

const nextSlide = () => {
    if (isTransitioning.value) return

    if (config.value.transitionType === 'fade') {
        currentSlide.value = (currentSlide.value + 1) % originalSlideCount.value
        return
    }

    isTransitioning.value = true

    const maxSlide = originalSlideCount.value - config.value.slidesPerView

    if (config.value.infinite) {
        currentSlide.value += config.value.slidesToScroll

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
            }, config.value.transitionType === 'slide' ? config.value.transitionDelay : 0)
        } else {
            setTimeout(() => {
                isTransitioning.value = false
            }, config.value.transitionType === 'slide' ? config.value.transitionDelay : 0)
        }
    } else {
        if (currentSlide.value + config.value.slidesToScroll <= maxSlide) {
            currentSlide.value += config.value.slidesToScroll
        } else {
            currentSlide.value = maxSlide
        }
        setTimeout(() => {
            isTransitioning.value = false
        }, config.value.transitionType === 'slide' ? config.value.transitionDelay : 0)
    }
}

const previousSlide = () => {
    if (isTransitioning.value) return

    if (config.value.transitionType === 'fade') {
        currentSlide.value = currentSlide.value === 0 ? originalSlideCount.value - 1 : currentSlide.value - 1
        return
    }

    isTransitioning.value = true

    if (config.value.infinite) {
        currentSlide.value -= config.value.slidesToScroll

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
            }, config.value.transitionType === 'slide' ? config.value.transitionDelay : 0)
        } else {
            setTimeout(() => {
                isTransitioning.value = false
            }, config.value.transitionType === 'slide' ? config.value.transitionDelay : 0)
        }
    } else {
        if (currentSlide.value - config.value.slidesToScroll >= 0) {
            currentSlide.value -= config.value.slidesToScroll
        } else {
            currentSlide.value = 0
        }
        setTimeout(() => {
            isTransitioning.value = false
        }, config.value.transitionType === 'slide' ? config.value.transitionDelay : 0)
    }
}

const slideTo = (dotIndex: number) => {
    if (config.value.slidesPerView === 1) {
        if (config.value.transitionType === 'fade') {
            currentSlide.value = dotIndex
            return
        }
        goToSpecificSlide(dotIndex)
    } else {
        const maxSlide = originalSlideCount.value - config.value.slidesPerView
        const targetSlide = Math.max(0, Math.min(dotIndex, maxSlide))

        if (isTransitioning.value) return

        currentSlide.value = targetSlide
        isTransitioning.value = true

        setTimeout(() => {
            isTransitioning.value = false
        }, config.value.transitionType === 'slide' ? config.value.transitionDelay : 0)
    }
}

const updateWindowWidth = () => {
    windowWidth.value = window.innerWidth
}






// Reset currentSlide when breakpoint changes to avoid out-of-bounds
watch(currentBreakpoint, (newBreakpoint, oldBreakpoint) => {
    if (newBreakpoint !== oldBreakpoint) {
        // Stoppe autoplay temporär
        stopAutoplay()

        // Prüfe, ob aktueller Slide noch gültig ist
        const maxSlide = originalSlideCount.value - config.value.slidesPerView
        if (currentSlide.value > maxSlide) {
            currentSlide.value = Math.max(0, maxSlide)
        }

        // Höhe neu berechnen bei fade transition
        if (config.value.transitionType === 'fade') {
            slideHeightCalculated.value = false
            nextTick(() => {
                calculateSlideHeights()
            })
        }

        // Autoplay neu starten falls aktiv
        if (config.value.autoplayDelay !== -1) {
            startAutoplay()
        }
    }
})

// Berechne die Anzahl der Original-Slides basierend auf den Slots
const originalSlideCount = computed(() => {
    const slideSlots = Object.keys(slots).filter(key => key.startsWith('slide-'))
    return slideSlots.length || 3 // Fallback für Demo-Zwecke
})

const carouselContainerStyles = computed(() => {
    if (config.value.transitionType === 'fade' && slideHeightCalculated.value && calculatedHeight.value > 0) {
        return {
            height: `${calculatedHeight.value}px`
        }
    }
    return { height: config.value.height }
})

const slideContainerClasses = computed(() => ({
    'slides-container': true,
    'slide-transition-slide': config.value.transitionType === 'slide',
    'slide-transition-none': config.value.transitionType === 'none'
}))

const slideContainerStyles = computed(() => {
    if (config.value.transitionType === 'fade') return {}

    const slideWidthWithGap = `(${slideWidth.value} + ${config.value.gap})`
    const translateX = `calc(-${getCurrentSlideIndex()} * ${slideWidthWithGap})`

    return { transform: `translateX(${translateX})`, transitionDuration: `${config.value.transitionDelay}ms` }
})

const slideStyles = (index: number) => {
    const isLastSlide = index === computedSlides.value.length - 1
    return {
        width: slideWidth.value,
        marginRight: isLastSlide ? '0' : config.value.gap
    }
}

const dotClasses = (index: number) => ({
    'dot-base': true,
    'dot-active': isSlideCurrentlyVisible(index),
    'dot-inactive': !isSlideCurrentlyVisible(index),
});


// Berechne Slide-Höhen für fade transition
const calculateSlideHeights = async () => {
    if (config.value.transitionType !== 'fade') {
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
    if (config.value.transitionType === 'fade') {
        slideHeightCalculated.value = false
        nextTick(() => {
            calculateSlideHeights()
        })
    }
})

// Watch für transition type Änderungen
watch(() => config.value.transitionType, () => {
    if (config.value.transitionType === 'fade') {
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
    if (config.value.slidesPerView === 1) return '100%'
    return `calc((100% - ${(config.value.slidesPerView - 1)} * ${config.value.gap}) / ${config.value.slidesPerView})`
})

// Für infinite scrolling erstellen wir zusätzliche Slides (nur bei slide/none transition)
const computedSlides = computed(() => {
    if (config.value.transitionType === 'fade') {
        return Array.from({ length: originalSlideCount.value }, (_, i) => i)
    }

    if (!config.value.infinite) {
        return Array.from({ length: originalSlideCount.value }, (_, i) => i)
    }

    // Für infinite scrolling: Original + Kopien am Anfang und Ende
    const slides: Array<number> = []

    // Genug Slides am Anfang kopieren für smooth transition
    for (let i = 0; i < config.value.slidesPerView; i++) {
        const index = originalSlideCount.value - config.value.slidesPerView + i
        slides.push(index >= 0 ? index : originalSlideCount.value + index)
    }

    // Alle Original-Slides
    for (let i = 0; i < originalSlideCount.value; i++) {
        slides.push(i)
    }

    // Genug Slides am Ende kopieren für smooth transition
    for (let i = 0; i < config.value.slidesPerView; i++) {
        slides.push(i)
    }

    return slides
})

// Berechne den aktuellen Slide-Index für die Anzeige
const getCurrentSlideIndex = () => {
    if (config.value.transitionType === 'fade') {
        return currentSlide.value
    }
    return config.value.infinite ? currentSlide.value + config.value.slidesPerView : currentSlide.value
}

// Hole den ursprünglichen Slide-Index
const getOriginalSlideIndex = (index: number) => {
    return computedSlides.value[index]
}

const isSlideCurrentlyVisible = (slideIndex: number) => {
    let normalizedCurrentSlide = currentSlide.value;

    if (config.value.infinite) {
        while (normalizedCurrentSlide < 0) {
            normalizedCurrentSlide += originalSlideCount.value;
        }
        normalizedCurrentSlide = normalizedCurrentSlide % originalSlideCount.value;
    }

    const start = normalizedCurrentSlide;
    const end = normalizedCurrentSlide + config.value.slidesPerView - 1;

    if (end >= originalSlideCount.value && config.value.infinite) {
        const normalEnd = end % originalSlideCount.value;
        return (slideIndex >= start) || (slideIndex <= normalEnd);
    }
    return slideIndex >= start && slideIndex <= end;
}

const goToSpecificSlide = (slideIndex: number) => {
    if (isTransitioning.value) return

    const maxPosition = originalSlideCount.value - config.value.slidesPerView
    const targetPosition = Math.min(slideIndex, maxPosition)

    currentSlide.value = Math.max(0, targetPosition)
    isTransitioning.value = true

    setTimeout(() => {
        isTransitioning.value = false
    }, config.value.transitionType === 'slide' ? config.value.transitionDelay : 0)
}






const startAutoplay = () => {
    if (config.value.autoplayDelay === -1) return

    autoplayTimer = setInterval(() => {
        nextSlide()
    }, config.value.autoplayDelay)
}

const stopAutoplay = () => {
    if (autoplayTimer) {
        clearInterval(autoplayTimer)
        autoplayTimer = null
    }
}

const pauseAutoplay = () => {
    if (config.value.autoplayDelay !== -1) {
        stopAutoplay()
    }
}

const resumeAutoplay = () => {
    if (config.value.autoplayDelay !== -1) {
        startAutoplay()
    }
}

// Watch für autoplay changes basierend auf aktueller Konfiguration
watch(() => config.value.autoplayDelay, (newDelay, oldDelay) => {
    if (newDelay !== oldDelay) {
        stopAutoplay()
        if (newDelay !== -1) {
            startAutoplay()
        }
    }
})

onMounted(() => {
    // Window width tracking
    updateWindowWidth()
    window.addEventListener('resize', updateWindowWidth)

    if (config.value.autoplayDelay !== -1) {
        startAutoplay()
    }

    // Höhe für fade transition berechnen
    if (config.value.transitionType === 'fade') {
        nextTick(() => {
            calculateSlideHeights()
        })
    } else {
        slideHeightCalculated.value = true
    }
})

onUnmounted(() => {
    stopAutoplay()
    window.removeEventListener('resize', updateWindowWidth)
})

defineExpose({
    nextSlide,
    previousSlide,
    slideTo,
    getCurrentSlide: () => currentSlide.value,
    getCurrentBreakpoint: () => currentBreakpoint.value,
    getCurrentConfig: () => config.value
})
</script>

<style scoped lang="postcss">
.carousel {
    @apply relative w-full overflow-hidden;
}

.carousel-container {
    @apply relative w-full h-full;
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

.slide {
    @apply flex-shrink-0 h-full relative;
}

.btn-arrow-left {
    @apply absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-2 rounded-full transition-all duration-200 backdrop-blur-sm z-20;
}

.btn-arrow-right {
    @apply absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-2 rounded-full transition-all duration-200 backdrop-blur-sm z-20;
}

.dots-container {
    @apply absolute bottom-4 left-1/2 transform -translate-x-1/2 flex justify-center gap-1.5 z-20;
}

.dot-base {
    @apply w-2.5 h-2.5 rounded-full transition-all duration-200 backdrop-blur-sm;
}

.dot-inactive {
    @apply bg-white bg-opacity-50 hover:bg-opacity-75;
}

.dot-active {
    @apply bg-white;
}
</style>