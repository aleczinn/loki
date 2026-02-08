<template>
    <component
        :is="tag"
        :href="href"
        :target="target"
        :rel="computedRel"
        :type="buttonType"
        :disabled="disabled"
        :aria-label="ariaLabel"
        :aria-describedby="ariaDescribedby"
        :aria-pressed="ariaPressed"
        :class="buttonClasses"
        @click="handleClick"
        @keydown="handleKeydown"
        class="border-none ring-alert"
    >
        <slot />
    </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface LokiButtonProps {
    text?: string;
    variant?: 'primary' | 'secondary' | 'hollow';
    disabled?: boolean;
    href?: string;
    target?: '_blank' | '_self' | '_parent' | '_top';
    rel?: string;
    type?: 'button' | 'submit' | 'reset';
    ariaLabel?: string;
    ariaDescribedby?: string;
    ariaPressed?: boolean | 'true' | 'false';
    fullWidth?: boolean;
}

const props = withDefaults(defineProps<LokiButtonProps>(), {
    variant: 'primary',
    disabled: false,
    target: '_self',
    type: 'button',
    fullWidth: false,
});

const emit = defineEmits<{
    click: [event: MouseEvent | KeyboardEvent]
}>()

const tag = computed(() => props.href ? 'a' : 'button')
const buttonType = computed(() => tag.value === 'button' ? props.type : undefined)
const computedRel = computed(() => {
    if (!props.href) return undefined
    if (props.rel) return props.rel
    if (props.target === '_blank') return 'noopener noreferrer'
    return undefined
})

const baseClasses = computed(() => [
    // Layout and positioning
    'flex justify-center items-center gap-2',
    'px-6 py-3',
    'transition-colors duration-300 motion-reduce:transition-none',
    'hover:cursor-pointer',
    'font-bold text-base',
    'rounded-xl border-none ',
    'disabled:cursor-not-allowed disabled:opacity-30 disabled:bg-gray',

    // Full width
    { 'w-full': props.fullWidth }
])

const variantClasses = computed(() => {
    const variants = {
        primary: [
            'bg-primary text-white',
            'hover:bg-primary-darker',
            'active:bg-primary-darkest',
            'focus-visible:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-light',
        ],
        secondary: [
            'bg-black-900 text-white',
            'border-1 border-solid border-white',
            'active:bg-black',
            'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white',
        ],
        hollow: [
            'bg-transparent text-white',
            'border-1 border-solid border-white',
            'active:bg-transparent',
            'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white',
        ]
    }

    return variants[props.variant] || variants.primary
})

const buttonClasses = computed(() => [
    ...baseClasses.value,
    ...variantClasses.value
])

const handleClick = (event: MouseEvent) => {
    if (props.disabled) {
        event.preventDefault()
        return
    }
    emit('click', event)
}


const handleKeydown = (event: KeyboardEvent) => {
    // Enhanced keyboard support
    if (event.key === 'Enter' || event.key === ' ') {
        if (props.disabled) {
            event.preventDefault()
            return
        }

        // For links, let browser handle Enter naturally
        if (tag.value === 'a' && event.key === 'Enter') {
            return
        }

        // For buttons or space key, emit click
        if (tag.value === 'button' || event.key === ' ') {
            event.preventDefault()
            emit('click', event)
        }
    }
}
</script>

<style scoped lang="css">

</style>