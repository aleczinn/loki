<template>
    <div class="carousel">
        <div class="carousel-container" @mouseenter="pauseAutoplay" @mouseleave="resumeAutoplay"
             :style="carouselContainerStyles">
            <!-- slides container for 'none/slide' transition -->
            <div v-if="config.transitionType !== 'fade'"
                 ref="slidesContainer"
                 :class="slideContainerClasses"
                 :style="slideContainerStyles"
                 @touchstart="handleDragStart"
                 @touchmove="handleDragMove"
                 @touchend="handleDragEnd"
                 @mousedown="handleDragStart"
                 @mousemove="handleDragMove"
                 @mouseup="handleDragEnd"
                 @mouseleave="handleDragEnd"
            >
                <div v-for="(slideIndex, index) in computedSlides" :key="`slide-${index}`" class="slide"
                     :style="slideStyles(index)">
                    <component :is="slides[slideIndex]"/>
                </div>
            </div>

            <!-- slides container for 'fade' transition -->
            <div v-if="config.transitionType === 'fade'" class="fade-container">
                <!-- hidden slides for height measurement -->
                <div v-for="(slide, index) in slides" :key="`measure-slide-${index}`"
                     ref="measureSlides"
                     class="measure-slide"
                     :style="{ visibility: slideHeightCalculated ? 'hidden' : 'visible' }"
                >
                    <component :is="slide"/>
                </div>

                <!-- visible slides -->
                <div v-for="(slide, index) in slides"
                     :key="`fade-slide-${index}`"
                     :class="['fade-slide', { 'fade-slide-active': index === currentSlide }]"
                     :style="{transitionDuration: `${config.transitionDelay}ms`}"
                >
                    <component :is="slide"/>
                </div>
            </div>

            <!-- navigation arrows -->
            <button v-if="config.arrows" @click="previousSlide(true)"
                    :disabled="isNavigationDisabled.previous"
                    :class="['btn-arrow', 'btn-arrow-left', { 'btn-disabled': isNavigationDisabled.previous }]"
            >
                <icon-arrow-left class="w-6 h-6"/>
            </button>

            <button v-if="config.arrows"
                    @click="nextSlide(true)"
                    :disabled="isNavigationDisabled.next"
                    :class="['btn-arrow', 'btn-arrow-right', { 'btn-disabled': isNavigationDisabled.next }]"
            >
                <icon-arrow-right class="w-6 h-6"/>
            </button>

            <!-- dot navigation -->
            <div v-if="config.dots" class="dots-container">
                <button v-for="(_, index) in slides" :key="`dot-${index}`" @click="slideTo(index)"
                        :class="['dot', { 'dot-active': isSlideCurrentlyVisible(index) }]"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick, VNode } from 'vue'
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
    draggable?: boolean
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
    height: 'auto',
    slidesPerView: 1,
    slidesToScroll: 1,
    gap: '0rem',
    draggable: false
})

// Events
const emit = defineEmits<{
    slideChanged: [slideIndex: number]
    endReached: []
    startReached: []
    autoplayStarted: []
    autoplayStopped: []
}>()

const slots = defineSlots<{
    default(): any
}>()

// Refs
const slidesContainer = ref<HTMLElement>()
const measureSlides = ref<HTMLElement[]>([])
const currentSlide = ref(0)
const calculatedHeight = ref<number>(0)
const slideHeightCalculated = ref(false)
const windowWidth = ref(0)
const isTransitioning = ref(false)

// Timers
let autoplayTimer: NodeJS.Timeout | null = null

// Touch/Mouse drag state
const isDragging = ref(false)
const dragStartX = ref(0)
const dragCurrentX = ref(0)
const dragStartTime = ref(0)

// Constants
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

// Computed: Slides
const slides = computed((): VNode[] => {
    const defaultSlot = slots.default?.()
    if (!defaultSlot) return []

    return defaultSlot.filter(vnode =>
        vnode.type !== Comment &&
        (typeof vnode.type !== 'symbol' || vnode.children)
    )
})

// Computed: Current breakpoint
const currentBreakpoint = computed((): BreakpointKey | 'base' => {
    if (windowWidth.value >= breakpoints['4xl']) return '4xl'
    if (windowWidth.value >= breakpoints['3xl']) return '3xl'
    if (windowWidth.value >= breakpoints['2xl']) return '2xl'
    if (windowWidth.value >= breakpoints.xl) return 'xl'
    if (windowWidth.value >= breakpoints.lg) return 'lg'
    if (windowWidth.value >= breakpoints.md) return 'md'
    if (windowWidth.value >= breakpoints.sm) return 'sm'
    return 'base'
})

// Computed: Merged config
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
        gap: props.gap,
        draggable: props.draggable
    }

    if (!props.responsive) return baseConfig

    let mergedConfig = { ...baseConfig }
    const breakpointOrder: (BreakpointKey | 'base')[] = ['base', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl']
    const currentIndex = breakpointOrder.indexOf(currentBreakpoint.value)

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

// Computed: Styles
const carouselContainerStyles = computed(() => {
    if (config.value.height === 'auto') {
        if (config.value.transitionType === 'fade' && slideHeightCalculated.value && calculatedHeight.value > 0) {
            return { height: `${calculatedHeight.value}px` }
        }
        return { height: 'auto' }
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
    const baseTranslateX = `calc(-${getCurrentSlideIndex()} * ${slideWidthWithGap})`

    // Add drag offset if dragging
    const dragOffset = isDragging.value ? dragCurrentX.value - dragStartX.value : 0
    const translateX = dragOffset ? `calc(${baseTranslateX} + ${dragOffset}px)` : baseTranslateX

    return {
        transform: `translateX(${translateX})`,
        transitionDuration: isDragging.value ? '0ms' : `${config.value.transitionDelay}ms`,
        cursor: config.value.draggable ? (isDragging.value ? 'grabbing' : 'grab') : 'default'
    }
})

const slideWidth = computed(() => {
    if (config.value.slidesPerView === 1) return '100%'
    return `calc((100% - ${(config.value.slidesPerView - 1)} * ${config.value.gap}) / ${config.value.slidesPerView})`
})

// Computed: Navigation state
const isNavigationDisabled = computed(() => ({
    previous: !config.value.infinite && currentSlide.value <= 0,
    next: !config.value.infinite && currentSlide.value >= slides.value.length - config.value.slidesPerView
}))

// Computed: Slides for rendering
const computedSlides = computed(() => {
    if (config.value.transitionType === 'fade' || !config.value.infinite) {
        return Array.from({ length: slides.value.length }, (_, i) => i)
    }

    const slideIndices: number[] = []

    // Copy slides at beginning
    for (let i = 0; i < config.value.slidesPerView; i++) {
        const index = slides.value.length - config.value.slidesPerView + i
        slideIndices.push(index >= 0 ? index : slides.value.length + index)
    }

    // Original slides
    for (let i = 0; i < slides.value.length; i++) {
        slideIndices.push(i)
    }

    // Copy slides at end
    for (let i = 0; i < config.value.slidesPerView; i++) {
        slideIndices.push(i)
    }

    return slideIndices
})

// Helper functions
const getCurrentSlideIndex = () => {
    if (config.value.transitionType === 'fade') return currentSlide.value
    return config.value.infinite ? currentSlide.value + config.value.slidesPerView : currentSlide.value
}

const isSlideCurrentlyVisible = (slideIndex: number) => {
    let normalizedCurrentSlide = currentSlide.value

    if (config.value.infinite) {
        while (normalizedCurrentSlide < 0) {
            normalizedCurrentSlide += slides.value.length
        }
        normalizedCurrentSlide = normalizedCurrentSlide % slides.value.length
    }

    const start = normalizedCurrentSlide
    const end = normalizedCurrentSlide + config.value.slidesPerView - 1

    if (end >= slides.value.length && config.value.infinite) {
        const normalEnd = end % slides.value.length
        return (slideIndex >= start) || (slideIndex <= normalEnd)
    }
    return slideIndex >= start && slideIndex <= end
}

const slideStyles = (index: number) => {
    const isLastSlide = index === computedSlides.value.length - 1
    return {
        width: slideWidth.value,
        marginRight: isLastSlide ? '0' : config.value.gap
    }
}

// Navigation functions
const nextSlide = () => {
    if (isTransitioning.value) return
    if (!config.value.infinite && currentSlide.value >= slides.value.length - config.value.slidesPerView) return

    if (config.value.transitionType === 'fade') {
        currentSlide.value = (currentSlide.value + 1) % slides.value.length
        return
    }

    isTransitioning.value = true
    const maxSlide = slides.value.length - config.value.slidesPerView

    if (config.value.infinite) {
        currentSlide.value += config.value.slidesToScroll

        if (currentSlide.value > maxSlide) {
            setTimeout(() => {
                if (slidesContainer.value) {
                    // Disable transition for instant position reset
                    slidesContainer.value.style.transition = 'none'
                    currentSlide.value = currentSlide.value - slides.value.length
                    // Force reflow to ensure the position change is applied
                    void slidesContainer.value.offsetHeight
                    // Re-enable transition after a frame
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            if (slidesContainer.value) {
                                slidesContainer.value.style.transition = ''
                            }
                            isTransitioning.value = false
                        })
                    })
                }
            }, config.value.transitionType === 'slide' ? config.value.transitionDelay : 0)
        } else {
            setTimeout(() => {
                isTransitioning.value = false
            }, config.value.transitionType === 'slide' ? config.value.transitionDelay : 0)
        }
    } else {
        currentSlide.value = Math.min(currentSlide.value + config.value.slidesToScroll, maxSlide)
        setTimeout(() => {
            isTransitioning.value = false
        }, config.value.transitionType === 'slide' ? config.value.transitionDelay : 0)
    }
}

const previousSlide = () => {
    if (isTransitioning.value) return
    if (!config.value.infinite && currentSlide.value <= 0) return

    if (config.value.transitionType === 'fade') {
        currentSlide.value = currentSlide.value === 0 ? slides.value.length - 1 : currentSlide.value - 1
        return
    }

    isTransitioning.value = true

    if (config.value.infinite) {
        currentSlide.value -= config.value.slidesToScroll

        if (currentSlide.value < 0) {
            setTimeout(() => {
                if (slidesContainer.value) {
                    // Disable transition for instant position reset
                    slidesContainer.value.style.transition = 'none'
                    currentSlide.value = currentSlide.value + slides.value.length
                    // Force reflow to ensure the position change is applied
                    void slidesContainer.value.offsetHeight
                    // Re-enable transition after a frame
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            if (slidesContainer.value) {
                                slidesContainer.value.style.transition = ''
                            }
                            isTransitioning.value = false
                        })
                    })
                }
            }, config.value.transitionType === 'slide' ? config.value.transitionDelay : 0)
        } else {
            setTimeout(() => {
                isTransitioning.value = false
            }, config.value.transitionType === 'slide' ? config.value.transitionDelay : 0)
        }
    } else {
        currentSlide.value = Math.max(currentSlide.value - config.value.slidesToScroll, 0)
        setTimeout(() => {
            isTransitioning.value = false
        }, config.value.transitionType === 'slide' ? config.value.transitionDelay : 0)
    }
}

const slideTo = (slideIndex: number) => {
    if (isTransitioning.value) return

    if (config.value.transitionType === 'fade') {
        currentSlide.value = slideIndex
        return
    }

    const maxSlide = slides.value.length - config.value.slidesPerView
    const targetSlide = Math.max(0, Math.min(slideIndex, maxSlide))

    if (currentSlide.value !== targetSlide) {
        isTransitioning.value = true
        currentSlide.value = targetSlide

        setTimeout(() => {
            isTransitioning.value = false
        }, config.value.transitionType === 'slide' ? config.value.transitionDelay : 0)
    }
}

// Height calculation
const calculateSlideHeights = async () => {
    if (config.value.transitionType !== 'fade' || config.value.height !== 'auto') {
        slideHeightCalculated.value = true
        return
    }

    await nextTick()
    let maxHeight = 0

    if (measureSlides.value && measureSlides.value.length > 0) {
        measureSlides.value.forEach((slideEl) => {
            if (slideEl) {
                slideEl.style.position = 'static'
                slideEl.style.visibility = 'visible'
                slideEl.style.opacity = '1'

                const height = slideEl.offsetHeight
                if (height > maxHeight) {
                    maxHeight = height
                }

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

// Autoplay functions
const startAutoplay = () => {
    if (config.value.autoplayDelay === -1) return
    emit('autoplayStarted')
    autoplayTimer = setInterval(() => {
        nextSlide()
    }, config.value.autoplayDelay)
}

const stopAutoplay = () => {
    if (autoplayTimer) {
        clearInterval(autoplayTimer)
        autoplayTimer = null
        emit('autoplayStopped')
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

// Window resize handler
const updateWindowWidth = () => {
    windowWidth.value = window.innerWidth
}

// Touch/Mouse drag handlers
const handleDragStart = (e: TouchEvent | MouseEvent) => {
    if (!config.value.draggable || config.value.transitionType === 'fade') return

    isDragging.value = true
    dragStartTime.value = Date.now()
    dragStartX.value = 'touches' in e ? e.touches[0].clientX : e.clientX
    dragCurrentX.value = dragStartX.value

    // Prevent text selection
    e.preventDefault()
}

const handleDragMove = (e: TouchEvent | MouseEvent) => {
    if (!isDragging.value) return

    dragCurrentX.value = 'touches' in e ? e.touches[0].clientX : e.clientX
}

const handleDragEnd = (e: TouchEvent | MouseEvent) => {
    if (!isDragging.value) return

    isDragging.value = false

    const dragDistance = dragCurrentX.value - dragStartX.value
    const dragDuration = Date.now() - dragStartTime.value
    const velocity = Math.abs(dragDistance) / dragDuration

    // Determine slide threshold (swipe if moved more than 50px or high velocity)
    const threshold = 50
    const velocityThreshold = 0.3

    if (Math.abs(dragDistance) > threshold || velocity > velocityThreshold) {
        if (dragDistance > 0) {
            previousSlide()
        } else {
            nextSlide()
        }
    }

    // Reset drag values
    dragStartX.value = 0
    dragCurrentX.value = 0
}

// Watch for slide changes and emit events
watch(currentSlide, (newSlide, oldSlide) => {
    if (newSlide !== oldSlide) {
        // Normalize slide index for events
        let normalizedSlide = newSlide
        if (config.value.infinite && normalizedSlide < 0) {
            normalizedSlide = slides.value.length + normalizedSlide
        } else if (config.value.infinite && normalizedSlide >= slides.value.length) {
            normalizedSlide = normalizedSlide % slides.value.length
        }

        emit('slideChanged', normalizedSlide)

        // Check for start/end reached (only for non-infinite mode)
        if (!config.value.infinite) {
            if (normalizedSlide === 0) {
                emit('startReached')
            }
            if (normalizedSlide >= slides.value.length - config.value.slidesPerView) {
                emit('endReached')
            }
        }
    }
})

// Watch for breakpoint changes
watch(currentBreakpoint, (newBreakpoint, oldBreakpoint) => {
    if (newBreakpoint !== oldBreakpoint) {
        stopAutoplay()

        const maxSlide = slides.value.length - config.value.slidesPerView
        if (currentSlide.value > maxSlide) {
            currentSlide.value = Math.max(0, maxSlide)
        }

        if (config.value.transitionType === 'fade') {
            slideHeightCalculated.value = false
            nextTick(() => calculateSlideHeights())
        }

        if (config.value.autoplayDelay !== -1) {
            startAutoplay()
        }
    }
})

// Watch for slide count changes
watch(() => slides.value.length, () => {
    if (config.value.transitionType === 'fade' && config.value.height === 'auto') {
        slideHeightCalculated.value = false
        nextTick(() => calculateSlideHeights())
    }
})

// Watch for transition type changes
watch(() => config.value.transitionType, () => {
    if (config.value.transitionType === 'fade' && config.value.height === 'auto') {
        slideHeightCalculated.value = false
        nextTick(() => calculateSlideHeights())
    } else {
        slideHeightCalculated.value = true
    }
})

// Watch for height changes
watch(() => config.value.height, () => {
    if (config.value.height === 'auto' && config.value.transitionType === 'fade') {
        slideHeightCalculated.value = false
        nextTick(() => calculateSlideHeights())
    } else {
        slideHeightCalculated.value = true
    }
})

// Watch for autoplay changes
watch(() => config.value.autoplayDelay, (newDelay, oldDelay) => {
    if (newDelay !== oldDelay) {
        stopAutoplay()
        if (newDelay !== -1) {
            startAutoplay()
        }
    }
})

// Lifecycle hooks
onMounted(() => {
    updateWindowWidth()
    window.addEventListener('resize', updateWindowWidth)

    if (config.value.autoplayDelay !== -1) {
        startAutoplay()
    }

    if (config.value.transitionType === 'fade' && config.value.height === 'auto') {
        nextTick(() => calculateSlideHeights())
    } else {
        slideHeightCalculated.value = true
    }
})

onUnmounted(() => {
    stopAutoplay()
    window.removeEventListener('resize', updateWindowWidth)
})

// Expose public methods
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

    .carousel-container {
        @apply relative w-full h-full;
    }
}

.slides-container {
    @apply flex w-full h-full;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;

    &.slide-transition-none {
        @apply transition-none;
    }

    &.slide-transition-slide {
        @apply transition-transform;
        transition-timing-function: cubic-bezier(0.802, 0.02, 0.39, 1.01) !important;
    }

    .slide {
        @apply flex-shrink-0 h-full relative;
    }
}

.fade-container {
    @apply relative w-full h-full;

    .measure-slide {
        @apply absolute inset-0 w-full opacity-0 pointer-events-none z-[-1];
    }

    .fade-slide {
        @apply absolute inset-0 w-full h-full transition-opacity ease-in-out opacity-0 z-0;

        &.fade-slide-active {
            @apply opacity-100 z-10;
        }
    }
}

.btn-arrow {
    @apply absolute top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 text-white p-2 rounded-full transition-all duration-200 backdrop-blur-sm z-20;

    &:hover:not(.btn-disabled) {
        @apply bg-opacity-30;
    }

    &.btn-disabled {
        @apply opacity-30 cursor-not-allowed;
    }

    &.btn-arrow-left {
        @apply left-4;
    }

    &.btn-arrow-right {
        @apply right-4;
    }
}

.dots-container {
    @apply absolute bottom-4 left-1/2 transform -translate-x-1/2 flex justify-center gap-1.5 z-20;

    .dot {
        @apply w-2.5 h-2.5 rounded-full transition-all duration-200 backdrop-blur-sm bg-white bg-opacity-50;

        &:hover {
            @apply bg-opacity-75;
        }

        &.dot-active {
            @apply bg-white bg-opacity-100;
        }
    }
}
</style>