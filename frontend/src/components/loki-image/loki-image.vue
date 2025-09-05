<template>
    <div ref="container" class="image-container">
        <img ref="img" :src="src" :alt="alt" :width="width" :height="height" loading="lazy" @load="loaded">
    </div>
</template>

<script setup lang="ts">
import {onMounted, ref} from "vue";

const container = ref<HTMLDivElement | null>(null);
const img = ref<HTMLImageElement | null>(null);

interface Props {
    src: string,
    alt?: string,
    width?: string,
    height?: string,
    aspect?: string,
}

const props = withDefaults(defineProps<Props>(), {
    src: "",
    alt: "",
    width: "",
    height: "",
    aspect: "unset"
});

onMounted(() => {
    if (img.value) {
        applyAspectRatio();
    }
})

function applyAspectRatio() {
    if (container.value) {
        if (props.aspect === 'unset') {
            container.value.style.aspectRatio = 'unset';
        } else if (props.aspect) {
            container.value.style.aspectRatio = props.aspect;
        } else if (img.value) {
            const w = img.value.width;
            const h = img.value.height;

            container.value.style.aspectRatio = `${w}/${h}`;
        }
    }
}

function loaded() {
    if (img.value) {
        img.value.classList.add('show');
    }
}
</script>

<style scoped lang="css">
.image-container {
    @apply relative bg-background-darkest rounded-lg w-full h-full;

    img {
        @apply absolute top-0 bottom-0 left-0 right-0 w-full h-full object-center object-cover duration-500 opacity-0;
    }

    .show {
        @apply opacity-100;
    }
}
</style>
