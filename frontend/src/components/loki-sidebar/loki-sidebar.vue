<template>
    <nav id="sidebar" :class="['sidebar', {'active': open}]">
        <div class="grid gap-8">
            <!-- Mediatheken -->
            <div class="sidebar-item">
                <p>{{$t('sidebar.media-libraries')}}</p>
                <router-link :to="library.link" v-for="library in getMediaLibraries()">{{library.name}}</router-link>
            </div>

            <!-- Genres -->
            <div class="sidebar-item">
                <p>{{$t('sidebar.genres')}}</p>
                <router-link to="" class="sidebar-link">Action</router-link>
                <router-link to="" class="sidebar-link">Abenteuer</router-link>
                <router-link to="" class="sidebar-link">Animation</router-link>
                <router-link to="" class="sidebar-link">Anime</router-link>
                <router-link to="" class="sidebar-link">Dokumentation</router-link>
                <router-link to="" class="sidebar-link">Drama</router-link>
                <router-link to="" class="sidebar-link">Horror</router-link>
                <router-link to="" class="sidebar-link">Komödien</router-link>
                <router-link to="" class="sidebar-link">Krimi</router-link>
                <router-link to="" class="sidebar-link">Sci-Fi</router-link>
                <router-link to="" class="sidebar-link">Thriller</router-link>
            </div>

            <!-- Sprachen -->
            <div class="sidebar-item">
                <p>{{$t('sidebar.languages')}}</p>
                <router-link :to="language.link" v-for="language in getLanguages()">{{ $t(language.translationKey) }}</router-link>
            </div>
        </div>
    </nav>

    {{ props.open }}
</template>

<script setup lang="ts">
interface Props {
    open: boolean
}

const props = withDefaults(defineProps<Props>(), {
    open: false
});

const getMediaLibraries = () => [
    {
        name: "Filme",
        link: "/movies"
    },
    {
        name: "Serien",
        link: "/series"
    },
];

const getLanguages = () => [
    {
        translationKey: "language.german",
        link: ""
    },
    {
        translationKey: "language.english",
        link: ""
    },
];
</script>

<style scoped lang="postcss">
.sidebar {
    @apply absolute bg-background z-20 top-[4rem] bottom-0 overflow-y-auto p-8 w-full;
    @apply border-t-1 md:border-none border-t-background-lightest;
    @apply md:static invisible md:visible;
    left: -250px;
    max-width: 250px;
    transition: 300ms ease-in-out;

    &.active {
        @apply translate-x-[250px] md:transform-none visible;
    }
}

.sidebar::-webkit-scrollbar-thumb, .sidebar::-webkit-scrollbar-track {
    @apply bg-transparent;
}

.sidebar:is(:hover, :focus-within)::-webkit-scrollbar-thumb {
    @apply bg-background-lightest;
}

.sidebar-item {
    @apply flex flex-col;

    p {
        @apply text-white tracking-wide;
    }

    a {
        @apply text-text-darkest duration-200 hover:text-white mt-1;
    }
}
</style>
