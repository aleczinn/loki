<template>
    <main class="flex-1">
        <div class="px-4 h-screen flex flex-col items-center justify-center">
            <h1 class="text-4xl text-gray mb-4">{{ $t("login.who-is-watching") }}</h1>

            <div class="flex flex-wrap items-center justify-center">
                <!-- Profile -->
                <router-link to="/home" v-for="profile in profiles">
                    <div class="w-32 max-w-[8rem] m-4">
                        <img class="rounded-full ring-0 transition duration-200 hover:ring-2 hover:scale-105 ring-gray"
                             :src="profile.image" alt="">
                        <p class="w-full text-gray text-center font-semibold mt-2">{{ profile.name }}</p>
                    </div>
                </router-link>

                <!-- Create profile -->
                <router-link to="/register">
                    <div class="w-32 max-w-[8rem] m-4">
                        <div
                            class="bg-black-900 w-32 h-32 flex items-center justify-center rounded-full ring-0 transition duration-200 hover:ring-2 hover:scale-105 ring-gray">
                            <div class="text-white text-4xl">+</div>
                        </div>
                        <p class="w-full text-gray text-center font-semibold mt-2">{{ $t("login.add-profile") }}</p>
                    </div>
                </router-link>
            </div>
        </div>
    </main>
</template>

<script lang="ts" setup>
const profiles = [
    {
        image: "/images/profile/geko.png",
        name: "Alec"
    },
    {
        image: "/images/profile/black-widow.png",
        name: "PersonA"
    },
    {
        image: "/images/profile/olaf.png",
        name: "PersonB"
    },
    {
        image: "/images/profile/baby-yoda.png",
        name: "PersonC"
    },
]
</script>

<style lang="scss" scoped>

</style>
