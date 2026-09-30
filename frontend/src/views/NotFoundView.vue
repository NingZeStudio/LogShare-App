<script setup lang="ts">
import { useSeoMeta } from '@/lib/useSeoMeta'
import { siteConfig } from '@/lib/config'
import AppButton from '@/components/ui/AppButton.vue'
import { PhQuestion as Question, PhHouse as House } from '@phosphor-icons/vue'

useSeoMeta({
  title: '404 - 页面未找到',
  description: '您访问的页面不存在或已被移除。'
}, siteConfig.name)()
</script>

<template>
  <div class="container mx-auto max-w-md px-4 py-24 text-center space-y-6">
    <div class="inline-flex p-4 rounded-2xl bg-muted/60 text-muted-foreground border border-border/80">
      <Question weight="duotone" class="h-12 w-12" />
    </div>

    <div class="space-y-2">
      <h1 class="text-3xl font-black tracking-tight text-foreground">404 - 页面未找到</h1>
      <p class="text-sm text-muted-foreground">抱歉，您所请求的路径不存在或已被迁往新地址。</p>
    </div>

    <div>
      <AppButton as="router-link" to="/" size="lg">
        <House weight="duotone" class="h-4 w-4" />
        返回首页
      </AppButton>
    </div>
  </div>
</template>
