<template>
    <div class="flex justify-center items-center gap-8 w-full h-full">
        <loki-button variant="primary">
            Weiterschauen
        </loki-button>

        <loki-button variant="secondary">
            Weiterschauen
        </loki-button>

        <loki-button variant="hollow">
            Weiterschauen
        </loki-button>

        <loki-button variant="primary">
            <icon-play-inline></icon-play-inline>
            Weiterschauen
        </loki-button>

        <loki-button variant="primary">
            Weiterschauen
            <icon-play-inline></icon-play-inline>
        </loki-button>

        <loki-button variant="primary" disabled>
            Weiterschauen
        </loki-button>
    </div>
</template>

<script setup lang="ts">
import IconPlayInline from "../../icons/icon-play-inline.vue";
import { LokiButton } from "../../components/loki-button";
</script>

<style scoped lang="css">

</style>