<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'destructive'
  | 'soft-destructive'
  | 'outline'
  | 'ghost'
  | 'soft'
  | 'muted'

export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant
    size?: ButtonSize
    disabled?: boolean
    as?: 'button' | 'a' | 'router-link'
    href?: string
    to?: string
    type?: 'button' | 'submit' | 'reset'
  }>(),
  {
    variant: 'primary',
    size: 'md',
    disabled: false,
    as: 'button',
    href: undefined,
    to: undefined,
    type: 'button'
  }
)

const resolvedTag = computed(() => {
  if (props.as === 'router-link') return RouterLink
  return props.as
})

const variantClass = computed(() => {
  switch (props.variant) {
    case 'secondary':
      return 'bg-secondary/80 text-secondary-foreground hover:bg-secondary active:scale-[0.98]'
    case 'destructive':
      return 'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-[0.98]'
    case 'soft-destructive':
      return 'bg-destructive/10 text-destructive hover:bg-destructive/20 active:scale-[0.98]'
    case 'outline':
      return 'border border-border bg-transparent text-foreground hover:bg-accent active:scale-[0.98]'
    case 'ghost':
      return 'bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
    case 'soft':
      return 'bg-primary/10 text-primary hover:bg-primary/20 active:scale-[0.98]'
    case 'muted':
      return 'bg-muted text-foreground hover:bg-accent active:scale-[0.98]'
    default:
      return 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]'
  }
})

const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'h-7 px-2.5 text-xs gap-1 rounded-md'
    case 'lg':
      return 'h-11 px-6 text-base gap-2 rounded-lg'
    case 'icon':
      return 'h-8 w-8 rounded-md'
    default:
      return 'h-9 px-4 text-sm gap-1.5 rounded-md'
  }
})

const baseClass =
  'inline-flex items-center justify-center font-medium transition-all select-none disabled:opacity-50 disabled:pointer-events-none cursor-pointer'
</script>

<template>
  <component
    :is="resolvedTag"
    :href="as === 'a' ? href : undefined"
    :to="as === 'router-link' ? to : undefined"
    :target="as === 'a' && href?.startsWith('http') ? '_blank' : undefined"
    :rel="as === 'a' && href?.startsWith('http') ? 'noopener noreferrer' : undefined"
    :type="as === 'button' ? type : undefined"
    :disabled="as === 'button' ? disabled : undefined"
    :class="[baseClass, variantClass, sizeClass]"
  >
    <slot />
  </component>
</template>
