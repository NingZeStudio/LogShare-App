<script setup lang="ts">
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'
import { siteConfig } from '@/lib/config'
import {
  PhInfo as InfoIcon,
  PhGithubLogo as GithubIcon,
  PhGlobe as GlobeIcon,
  PhChatCircle as ChatIcon,
  PhDesktop as DesktopIcon,
  PhCode as CodeIcon
} from '@phosphor-icons/vue'

const isElectron = typeof window !== 'undefined' && window.logshareAPI?.isElectron === true
const platform = typeof window !== 'undefined' ? window.logshareAPI?.platform : undefined

const techStack = [
  'Vue 3.5', 'TypeScript', 'Tailwind CSS', 'Phosphor Icons',
  'Vite 7', 'Electron', 'Vue Router'
]

const features = [
  { title: '日志上传', desc: '支持拖拽、粘贴、文件选择多种方式上传 Minecraft 日志' },
  { title: '本地分析', desc: '基于 Codex 引擎的本地结构化分析，毫秒级响应' },
  { title: 'AI 深度排障', desc: '三种模式（深度/启动器/极速），SSE 流式实时输出' },
  { title: '隐私保护', desc: '自动过滤 IP、UUID、Token 等敏感信息' },
  { title: '历史记录', desc: '本地保存上传记录，支持查看、删除、管理' },
  { title: '跨平台', desc: '基于 Electron，支持 Windows、macOS、Linux' }
]
</script>

<template>
  <div class="container mx-auto max-w-3xl px-4 sm:px-6 py-6 space-y-6">
    <div class="text-center space-y-3">
      <div class="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-2xl font-black">
        L
      </div>
      <h1 class="text-2xl font-bold">LogShare.CN</h1>
      <p class="text-sm text-muted-foreground">{{ siteConfig.description }}</p>
      <div v-if="isElectron" class="flex items-center justify-center gap-2">
        <Badge variant="success">
          <DesktopIcon weight="duotone" class="h-3 w-3" />
          桌面端运行中
        </Badge>
        <Badge variant="outline" class="font-mono">{{ platform }}</Badge>
      </div>
    </div>

    <Card padded class="space-y-3">
      <div class="flex items-center gap-2">
        <InfoIcon weight="duotone" class="h-5 w-5 text-primary" />
        <h2 class="text-base font-bold">功能特性</h2>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div v-for="feat in features" :key="feat.title" class="rounded-lg border border-border/60 p-3 space-y-1">
          <p class="text-sm font-semibold">{{ feat.title }}</p>
          <p class="text-xs text-muted-foreground leading-relaxed">{{ feat.desc }}</p>
        </div>
      </div>
    </Card>

    <Card padded class="space-y-3">
      <div class="flex items-center gap-2">
        <CodeIcon weight="duotone" class="h-5 w-5 text-primary" />
        <h2 class="text-base font-bold">技术栈</h2>
      </div>
      <div class="flex flex-wrap gap-2">
        <Badge v-for="tech in techStack" :key="tech" variant="secondary">{{ tech }}</Badge>
      </div>
    </Card>

    <Card padded class="space-y-3">
      <h2 class="text-base font-bold">链接与社区</h2>
      <div class="flex flex-col gap-2">
        <a
          :href="siteConfig.url"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <GlobeIcon weight="duotone" class="h-4 w-4" />
          官方网站
        </a>
        <a
          :href="siteConfig.github"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <GithubIcon weight="duotone" class="h-4 w-4" />
          GitHub
        </a>
        <a
          :href="siteConfig.qqGroup"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ChatIcon weight="duotone" class="h-4 w-4" />
          QQ 交流群
        </a>
      </div>
    </Card>

    <p class="text-center text-xs text-muted-foreground">
      &copy; {{ new Date().getFullYear() }} LogShare.CN · 基于 LogShare Front Template 构建
    </p>
  </div>
</template>
