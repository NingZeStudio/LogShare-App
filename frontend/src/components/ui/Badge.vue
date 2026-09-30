<script setup lang="ts">
import { computed } from 'vue'

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'destructive'
  | 'success'
  | 'warning'

const props = withDefaults(
  defineProps<{
    variant?: BadgeVariant
  }>(),
  {
    variant: 'default'
  }
)

const variantClass = computed(() => {
  switch (props.variant) {
    case 'secondary':
      return 'bg-secondary text-secondary-foreground border-transparent'
    case 'outline':
      return 'border-border text-foreground bg-transparent'
    case 'destructive':
      return 'bg-destructive/10 text-destructive border-destructive/20'
    case 'success':
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
    case 'warning':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
    default:
      return 'bg-primary text-primary-foreground border-transparent'
  }
})
</script>

<template>
  <div
    class="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors select-none"
    :class="variantClass"
  >
    <slot />
  </div>
</template>
