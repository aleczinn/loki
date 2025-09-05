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
            <icon-play></icon-play>
            Weiterschauen
        </loki-button>

        <loki-button variant="primary">
            Weiterschauen
            <icon-play></icon-play>
        </loki-button>

        <loki-button variant="primary" disabled>
            Weiterschauen
        </loki-button>
    </div>
</template>

<script setup lang="ts">

import LokiButton from "../components/loki-button/loki-button.vue";
import IconPlay from "../icons/icon-play.vue";
</script>

<style scoped lang="css">

</style>