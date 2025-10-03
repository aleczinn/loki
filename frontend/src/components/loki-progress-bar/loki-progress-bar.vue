<template>
    <div class="timeline relative min-h-1 bg-progressbar-dark rounded-full cursor-pointer group"
         ref="barRef"
         @click="handleClick"
         @mousedown="handleMouseDown"
         @mouseenter="handleMouseEnter"
         @mouseleave="handleMouseLeave"
    >
        <div class="absolute h-full bg-progressbar-light rounded-full" :style="{width: `${secondaryPercent}%`}"></div>

        <div class="absolute h-full bg-primary rounded-full" :style="{width: `${mainPercent}%`}">
            <div class="thumb absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-100 transition-opacity duration-300 group-hover:opacity-100"></div>
        </div>

        <div v-if="showTooltip"
             class="absolute bottom-full mb-2 px-2 py-2 bg-black-800 text-white text-sm rounded pointer-events-none"
             :style="{left: `${tooltipPosition}px`, transform: 'translateX(-50%)'}">
            {{ tooltipValue }}
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { clamp } from "../../lib/utils.ts";

type ProgressBarMode = 'raw' | 'percent' | 'time';

interface ProgressBarProps {
    value: number;
    valueSecondary?: number;
    minValue: number;
    maxValue: number;
    mode?: ProgressBarMode;
    draggableMode?: 'none' | 'delayed' | 'instant';
}

const props = withDefaults(defineProps<ProgressBarProps>(), {
    minValue: 0,
    maxValue: 100,
    mode: 'raw',
    draggable: false
});

const emit = defineEmits<{
    (e: "update:value", newValue: number): void;
}>();

const barRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const draggingValue = ref(0);

const showTooltip = ref(false);
const isInArea = ref(false);
const tooltipPosition = ref(0);
const tooltipValue = ref('');

const mainPercent = computed(() => {
    const currentValue = isDragging.value ? draggingValue.value : props.value;
    const range = props.maxValue - props.minValue;
    const percent = (((currentValue) - props.minValue) / range) * 100;
    return clamp(percent, 0, 100);
});

const secondaryPercent = computed(() => {
    if (!props.valueSecondary) return 0;

    const range = props.maxValue - props.minValue;
    const percent = ((props.valueSecondary - props.minValue) / range) * 100;
    return clamp(percent, 0, 100);
});

function calculateValueFromMouseX(e: MouseEvent): number {
    if (!barRef.value) return 0;

    const rect = barRef.value.getBoundingClientRect();

    let x = e.clientX - rect.left;
    x = Math.max(0, Math.min(rect.width, x));
    tooltipPosition.value = x;

    const percent = x / rect.width;
    const range = props.maxValue - props.minValue;

    updateTooltipValue(percent * range);
    return props.minValue + (percent * range);
}

function handleClick(e: MouseEvent) {
    if (props.draggableMode === 'none') {
        const newValue = calculateValueFromMouseX(e);
        emit("update:value", newValue);
    }
}

function handleMouseDown(e: MouseEvent) {
    if (props.draggableMode !== 'none') {
        isDragging.value = true;
        showTooltip.value = true;

        draggingValue.value = calculateValueFromMouseX(e);

        window.addEventListener("mouseup", handleMouseUp);
    }
}

function handleMouseMove(e: MouseEvent) {
    const newValue = calculateValueFromMouseX(e);

    if (isDragging.value && props.draggableMode !== 'none') {
        draggingValue.value = newValue;

        if (props.draggableMode === 'instant') {
            emit("update:value", draggingValue.value);
        }
    }
}

function handleMouseUp() {
    if (isDragging.value && props.draggableMode !== 'none') {
        emit("update:value", draggingValue.value);

        isDragging.value = false;
        if (!isInArea.value) {
            showTooltip.value = false;
        }

        window.removeEventListener("mouseup", handleMouseUp);
    }
}

function handleMouseEnter() {
    isInArea.value = true;

    if (!isDragging.value) {
        showTooltip.value = true;
    }
}

function handleMouseLeave() {
    isInArea.value = false;

    if (!isDragging.value) {
        showTooltip.value = false;
    }
}

function updateTooltipValue(value: number) {
    switch (props.mode) {
        case 'raw':
            tooltipValue.value = String(Math.round(value));
            break;
        case 'percent':
            const range = props.maxValue - props.minValue;
            const percent = ((value - props.minValue) / range) * 100;
            tooltipValue.value = `${Math.round(clamp(percent, 0, 100))}%`;
            break;
        case 'time':
            const hours = Math.floor(value / 3600);
            const minutes = Math.floor((value % 3600) / 60);
            const secs = Math.floor(value % 60);
            if (hours > 0) {
                tooltipValue.value = `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            } else {
                tooltipValue.value = `${minutes}:${secs.toString().padStart(2, '0')}`;
            }
            break;
    }
}

onMounted(() => {
    window.addEventListener("mousemove", handleMouseMove);
})

onBeforeUnmount(() => {
    window.removeEventListener("mousemove", handleMouseMove);
})
</script>

<style scoped lang="css">
.timeline::after {
    content: '';
    position: absolute;
    inset-inline: -0.5rem;
    inset-block: -1em;
}
</style>