<template>
    <span class="spinner border-4 border-solid border-gray"></span>
</template>

<script setup lang="ts">

</script>

<style scoped lang="css">
.spinner {
    width: 4rem;
    height: 4rem;

    border-bottom-color: transparent;
    border-radius: 50%;
    display: inline-block;
    box-sizing: border-box;
    animation: rotation 1s linear infinite;
}

@keyframes rotation {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}
</style>