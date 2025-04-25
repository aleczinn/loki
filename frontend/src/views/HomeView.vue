<template>
    <div class="flex flex-col h-screen">
        <img src="/images/the-purge-anarchy-bg.jpg" alt="" class="aspect-w-16 aspect-h-9">

        <loki-header></loki-header>

        <main class="flex-1 py-8">
            <div class="mx-auto max-w-[87rem]">
                <!-- ADD CONTENT HERE -->
                <p class="">asdas</p>
            </div>
        </main>

        <footer class="px-4 py-4 bg-background-darker">
            <p class="text-white">Footer</p>
        </footer>
    </div>
</template>

<script setup lang="ts">
import {inject} from "vue";
import {LokiHeader} from "@/components/loki-header";

const axios: any = inject('axios');
</script>

<style scoped lang="postcss">
.container {
    @apply w-full h-full flex justify-center items-center;
}
</style>
