<script setup lang="ts">
import { ref } from 'vue'
import { siteConfig } from '@/lib/config'
import { toast } from '@/lib/toast'
import {
  PhChatCircle as MessageCircle,
  PhGithubLogo as Github,
  PhArrowSquareOut as ExternalLink,
  PhSparkle as Sparkle
} from '@phosphor-icons/vue'

const easterEggClicks = ref(0)
let timer: ReturnType<typeof setTimeout> | null = null

const onVersionClick = () => {
  easterEggClicks.value++
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    easterEggClicks.value = 0
  }, 2000)

  if (easterEggClicks.value >= 3) {
    easterEggClicks.value = 0
    toast.success('感谢使用 LogShare 桌面端！')
  }
}
</script>

<template>
  <footer class="mt-auto border-t border-border/40 bg-muted/20">
    <div class="container mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <div class="grid gap-8 md:grid-cols-3">
        <!-- 左侧：品牌简介 + 联系方式 + 版权备案 -->
        <div class="md:col-span-2">
          <p class="text-base font-bold tracking-tight text-foreground">{{ siteConfig.name }}</p>
          <p class="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
            {{ siteConfig.description }}
          </p>

          <p class="mt-6 text-sm font-semibold text-foreground">联系与社区</p>
          <div class="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            <a
              v-if="siteConfig.qqGroup"
              :href="siteConfig.qqGroup"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              <MessageCircle weight="duotone" class="h-3.5 w-3.5" />
              官方交流群
            </a>
            <a
              v-if="siteConfig.github"
              :href="siteConfig.github"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              <Github weight="duotone" class="h-3.5 w-3.5" />
              GitHub
            </a>
          </div>

          <div class="mt-6 flex flex-col gap-1.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-3">
            <span class="flex items-center gap-2">
              <span>&copy; {{ new Date().getFullYear() }} {{ siteConfig.name }}</span>
              <button
                type="button"
                class="cursor-pointer select-none font-mono text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                aria-label="版本彩蛋"
                @click="onVersionClick"
              >
                <Sparkle weight="duotone" class="h-3 w-3 text-amber-500" />
                <span>v1.0.0</span>
              </button>
            </span>
            <span v-if="siteConfig.beian" class="hidden sm:inline text-border">|</span>
            <span v-if="siteConfig.beian">{{ siteConfig.beian }}</span>
          </div>
        </div>

        <!-- 右侧：友情链接 -->
        <div>
          <p class="text-sm font-semibold text-foreground">友情链接</p>
          <div class="mt-3 flex flex-col gap-2">
            <a
              v-for="link in siteConfig.friendLinks"
              :key="link.url"
              :href="link.url"
              target="_blank"
              rel="noopener noreferrer"
              class="group inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              <span>{{ link.name }}</span>
              <ExternalLink weight="duotone" class="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity" />
            </a>
          </div>
        </div>
      </div>
    </div>
  </footer>
</template>
