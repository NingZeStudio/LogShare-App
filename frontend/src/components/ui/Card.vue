<script setup lang="ts">
withDefaults(
  defineProps<{
    hoverable?: boolean
    padded?: boolean
  }>(),
  {
    hoverable: false,
    padded: true
  }
)
</script>

<template>
  <div
    class="rounded-xl border border-border bg-card text-card-foreground shadow-soft transition-all"
    :class="[
      hoverable ? 'hover:border-primary/40 hover:shadow-card active:scale-[0.995]' : '',
      padded ? 'p-5 sm:p-6' : ''
    ]"
  >
    <slot />
  </div>
</template>
