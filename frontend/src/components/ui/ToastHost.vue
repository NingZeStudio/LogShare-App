<script setup lang="ts">
import { toasts, toast } from '@/lib/toast'
import {
  PhCheckCircle as CheckCircle,
  PhXCircle as XCircle,
  PhInfo as Info,
  PhWarning as Warning,
  PhX as X
} from '@phosphor-icons/vue'

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: Warning
}

const colorMap = {
  success: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  error: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
  info: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
  warning: 'text-amber-500 bg-amber-500/10 border-amber-500/20'
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 pointer-events-none max-w-sm w-full px-4 sm:px-0"
    >
      <TransitionGroup
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-4 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0 scale-100"
        leave-to-class="opacity-0 translate-y-2 scale-95"
      >
        <div
          v-for="item in toasts"
          :key="item.id"
          class="pointer-events-auto flex items-center gap-3 p-3.5 rounded-lg border bg-card/95 text-card-foreground shadow-lg backdrop-blur-sm"
        >
          <div :class="['p-1.5 rounded-md border shrink-0', colorMap[item.type]]">
            <component :is="iconMap[item.type]" weight="duotone" class="h-4 w-4" />
          </div>
          <p class="text-sm font-medium flex-1 leading-snug break-words">
            {{ item.message }}
          </p>
          <button
            class="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors cursor-pointer shrink-0"
            aria-label="关闭"
            @click="toast.dismiss(item.id)"
          >
            <X weight="duotone" class="h-3.5 w-3.5" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
