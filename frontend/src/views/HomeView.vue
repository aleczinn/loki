<template>
    <div class="flex flex-col h-screen">
<!--        <img src="/images/the-purge-anarchy-bg.jpg" alt="" class="aspect-w-16 aspect-h-9">-->

        <loki-header></loki-header>

        <main class="flex-1 py-8">
            <div class="mx-auto max-w-[87rem]">
                <!-- ADD CONTENT HERE -->
                <p class="">asdas</p>
                <p>Data: {{ da }}</p>
            </div>
        </main>

        <footer class="px-4 py-4 bg-background-darker">
            <p class="text-white">Footer</p>
        </footer>
    </div>
</template>

<script setup lang="ts">
import { inject, onMounted, ref } from "vue";
import { LokiHeader } from "../components/loki-header";
import type { AxiosInstance } from "axios";

const axios = inject<AxiosInstance>('axios');

const da = ref<any>();

const fetchData = async () => {
    try {
        const response = await axios?.get('/test');

        console.log('Response: ', response?.data);
        da.value = response?.data;
    } catch (error) {
        console.error('Error fetching data: ', error);
    }
}

onMounted(() => {
    console.log('Axios base URL:', axios?.defaults.baseURL);
    fetchData();
})
</script>

<style scoped lang="postcss">
.container {
    @apply w-full h-full flex justify-center items-center;
}
</style>
