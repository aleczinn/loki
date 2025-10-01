<template>
    <div class="timeline relative min-h-1 bg-progressbar-dark rounded-full cursor-pointer group"
         @click="handleClick($event)"
         @mouseenter="handleTimelineMouseEnter"
         @mouseleave="handleTimelineMouseLeave"
         @mousemove="handleTimelineMouseMove($event)"

    >
        <div class="absolute h-full bg-progressbar-light rounded-full" :style="{width: `${secondaryPercent}%`}"></div>

        <div class="absolute h-full bg-primary rounded-full" :style="{width: `${mainPercent}%`}">
            <div class="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
        </div>

        <div v-if="showTooltip"
             class="absolute bottom-full mb-2 px-2 py-2 bg-black-800 text-white text-sm rounded pointer-events-none"
             :style="{left: `${tooltipPosition}px`, transform: 'translateX(-50%)'}">
            {{ tooltipValue }}
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { clamp } from "../../lib/utils.ts";

type ProgressBarMode = 'raw' | 'percent' | 'time';

interface ProgressBarProps {
    value: number;
    valueSecondary?: number;
    minValue: number;
    maxValue: number;
    mode?: ProgressBarMode;
}

const props = withDefaults(defineProps<ProgressBarProps>(), {
    minValue: 0,
    maxValue: 100,
    mode: 'raw',
});

const emit = defineEmits<{
    (e: "update:value", newValue: number): void;
}>();

const showTooltip = ref(false);
const tooltipPosition = ref(0);
const tooltipValue = ref('');

const mainPercent = computed(() => {
    const range = props.maxValue - props.minValue;
    const percent = ((props.value - props.minValue) / range) * 100;
    return clamp(percent, 0, 100);
});

const secondaryPercent = computed(() => {
    if (!props.valueSecondary) return 0;

    const range = props.maxValue - props.minValue;
    const percent = ((props.valueSecondary - props.minValue) / range) * 100;
    return clamp(percent, 0, 100);
});

function handleClick(e: MouseEvent) {
    const element = (e.currentTarget as HTMLElement);
    const rect = element.getBoundingClientRect();
    let x = e.clientX - rect.left;
    x = Math.max(0, Math.min(rect.width, x));
    const percent = x / rect.width;
    const newValue = props.minValue + percent * (props.maxValue - props.minValue);
    emit("update:value", newValue);
}

function handleMouseEnter() {
    showTooltip.value = true;
}

function handleTimelineMouseLeave() {
    showTooltip.value = false;
}

function handleTimelineMouseMove(e: MouseEvent) {
    const element = (e.currentTarget as HTMLElement);
    const rect = element.getBoundingClientRect();
    let x = e.clientX - rect.left;
    tooltipPosition.value = Math.max(0, Math.min(rect.width, x));

    const range = props.maxValue - props.minValue;

    const percent = x / rect.width;
    updateTooltipValue(percent * range)
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
</script>

<style scoped lang="css">
.timeline::after {
    content: '';
    position: absolute;
    inset-inline: 0;
    inset-block: -0.75rem;
}

.thumba::after {
    content: '';
    position: absolute;
    inset: -0.75rem;
    background: rgba(255, 0, 0, 0.4);
}
</style>