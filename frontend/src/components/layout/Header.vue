<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { siteConfig } from '@/lib/config'
import ThemeToggle from './ThemeToggle.vue'
import { PhGithubLogo as Github } from '@phosphor-icons/vue'

const route = useRoute()
const isScrolled = ref(false)

const onWindowScroll = () => {
  isScrolled.value = window.scrollY > 8
}

onMounted(() => {
  onWindowScroll()
  window.addEventListener('scroll', onWindowScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', onWindowScroll)
})
</script>

<template>
  <!-- pt-safe：PWA 独立窗口或安卓全屏模式下内容会延伸到状态栏/刘海下方，
       浏览器标签页中 safe-area-inset-top 为 0，不影响现有布局 -->
  <header class="sticky top-0 z-30 w-full pointer-events-none pt-safe">
    <div
      class="pointer-events-auto mx-auto transition-all duration-300 ease-out"
      :class="
        isScrolled
          ? 'mt-3 w-[calc(100%-2rem)] max-w-6xl rounded-full border border-border/60 bg-background/80 shadow-lg backdrop-blur-md'
          : 'mt-0 w-full rounded-none border-b border-border/40 bg-background/60 backdrop-blur-sm'
      "
    >
      <div
        class="flex items-center gap-3 px-4 sm:px-6 transition-all duration-300 max-w-6xl mx-auto"
        :class="isScrolled ? 'h-12' : 'h-14'"
      >
        <!-- Logo 与站名 -->
        <RouterLink to="/" class="flex shrink-0 items-center gap-2 font-bold tracking-tight text-foreground">
          <div class="h-6 w-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xs font-mono font-black">
            L
          </div>
          <span>{{ siteConfig.logoText }}</span>
        </RouterLink>

        <!-- 桌面端导航项 -->
        <nav class="ml-4 hidden items-center gap-1 md:flex">
          <RouterLink
            v-for="link in siteConfig.navLinks"
            :key="link.path"
            :to="link.path"
            class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            :class="
              route.path === link.path || (link.path !== '/' && route.path.startsWith(link.path))
                ? 'bg-accent text-accent-foreground font-semibold'
                : 'text-muted-foreground'
            "
          >
            {{ link.name }}
          </RouterLink>
        </nav>

        <div class="flex-1" />

        <!-- 外部链接 (GitHub) -->
        <a
          v-if="siteConfig.github"
          :href="siteConfig.github"
          target="_blank"
          rel="noopener noreferrer"
          class="hidden sm:inline-flex rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
          aria-label="GitHub Repository"
        >
          <Github weight="duotone" class="h-4 w-4" />
        </a>

        <!-- 主题切换胶囊 -->
        <ThemeToggle />
      </div>
    </div>
  </header>
</template>
