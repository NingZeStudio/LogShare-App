<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  PhHouse as House,
  PhClockCounterClockwise as History,
  PhGear as Gear
} from '@phosphor-icons/vue'

/**
 * 底部 tab 导航——移动端主导航（对齐移动 App 范式），
 * 替代桌面端顶栏链接与旧汉堡弹层菜单（MobileNav 已由其取代）。
 *
 * 仅在标记了 meta.tab 的顶级路由（首页 / 历史 / 设置）显示；
 * 日志详情、AI 分析等子页面隐藏，给内容让出整屏高度。
 * 桌面端（md 及以上）始终隐藏，顶栏导航不变。
 */
const route = useRoute()

// tab 图标与路径集中在此，而非塞进 siteConfig.navLinks——
// 与线上模板同一约定：不为纯视觉信息扩大数据契约。
const tabs = [
  { name: '首页', path: '/', icon: House },
  { name: '历史', path: '/history', icon: History },
  { name: '设置', path: '/settings', icon: Gear }
]

const visible = computed(() => route.meta.tab === true)

function isActive(path: string): boolean {
  return path === '/' ? route.path === '/' : route.path.startsWith(path)
}
</script>

<template>
  <nav
    v-if="visible"
    class="fixed inset-x-0 bottom-0 z-40 md:hidden"
    aria-label="主导航"
  >
    <!-- pb-safe：iPhone Home 指示条 / 安卓手势条区域，浏览器中为 0 不影响布局 -->
    <div class="border-t border-border/60 bg-background/80 backdrop-blur-md pb-safe">
      <div class="mx-auto flex max-w-md">
        <RouterLink
          v-for="tab in tabs"
          :key="tab.path"
          :to="tab.path"
          :aria-current="isActive(tab.path) ? 'page' : undefined"
          class="relative flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-1 py-1.5 transition-colors active:scale-[0.98]"
          :class="isActive(tab.path) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'"
        >
          <span
            class="absolute top-0 h-0.5 w-8 rounded-full bg-primary transition-opacity"
            :class="isActive(tab.path) ? 'opacity-100' : 'opacity-0'"
          />
          <component :is="tab.icon" :size="22" weight="duotone" />
          <span class="text-[10px] font-medium leading-none">{{ tab.name }}</span>
        </RouterLink>
      </div>
    </div>
  </nav>
</template>
