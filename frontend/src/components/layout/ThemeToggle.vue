<script setup lang="ts">
import { computed } from 'vue'
import { displayMode, setDisplayMode, type DisplayMode } from '@/lib/settings'
import {
  PhSun as Sun,
  PhMoon as Moon,
  PhMonitor as Monitor
} from '@phosphor-icons/vue'

const themeOptions = [
  { mode: 'light' as DisplayMode, icon: Sun, label: '浅色' },
  { mode: 'dark' as DisplayMode, icon: Moon, label: '深色' },
  { mode: 'system' as DisplayMode, icon: Monitor, label: '跟随系统' }
]

/** 当前模式对应的图标与文案（移动端单按钮用） */
const currentOption = computed(
  () => themeOptions.find(o => o.mode === displayMode.value) ?? themeOptions[2]
)

/**
 * 移动端循环切换：浅色 → 深色 → 跟随系统 → 浅色 …
 * 小屏下三段式分段控件每个按钮只有 28px（低于 44px 触摸目标下限），
 * 且三枚按钮会占掉头部近半宽度，故在小屏收成单个循环按钮。
 */
const cycleDisplayMode = () => {
  const idx = themeOptions.findIndex(o => o.mode === displayMode.value)
  const next = themeOptions[(idx + 1) % themeOptions.length]
  if (next) setDisplayMode(next.mode)
}
</script>

<template>
  <!-- 小屏：单个循环按钮（44px 触摸目标，且只占一个按钮的宽度） -->
  <button
    type="button"
    class="touch-target flex sm:hidden items-center justify-center rounded-full border border-border/60 bg-background/60 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
    :aria-label="`显示模式：${currentOption?.label ?? '跟随系统'}，点击切换`"
    :title="`显示模式：${currentOption?.label ?? '跟随系统'}`"
    @click="cycleDisplayMode"
  >
    <component :is="currentOption?.icon" weight="duotone" class="h-4 w-4" />
  </button>

  <!-- 桌面端：三段式分段控件 -->
  <div
    class="relative hidden sm:flex items-center gap-0.5 rounded-full border border-border/60 bg-background/60 p-0.5"
    role="tablist"
    aria-label="显示模式"
  >
    <span
      aria-hidden="true"
      class="absolute left-0.5 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full bg-muted-foreground/25 shadow-sm transition-transform duration-300 ease-out"
      :style="{
        transform: `translateX(${themeOptions.findIndex(o => o.mode === displayMode) * 30}px) translateY(-50%)`
      }"
    />
    <button
      v-for="option in themeOptions"
      :key="option.mode"
      type="button"
      role="tab"
      :aria-selected="displayMode === option.mode"
      :aria-label="option.label"
      class="relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
      :class="{ '!text-foreground font-semibold': displayMode === option.mode }"
      @click="setDisplayMode(option.mode)"
    >
      <component :is="option.icon" weight="duotone" class="h-4 w-4" />
    </button>
  </div>
</template>
