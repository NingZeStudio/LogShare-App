<script setup lang="ts">
/**
 * WAF 拦截说明弹窗
 *
 * 触发场景：服务端前面挂着 OpenLiteWaf，规则命中时返回 403 + 一张 HTML 拦截卡片
 * （特征 class="widget"，判定见 lib/api.ts 的 isWafBlockHtml）。
 *
 * 为什么必须单独弹窗而不是一句 toast：
 * 这类响应体是一整页 HTML，api.ts 只能把它归类成「请求已被安全系统拦截」。
 * 用户看到这句会以为是服务端挂了或者自己网断了，实际是上传内容/频率触发了
 * 防火墙规则 —— 重试、等一会儿、用浏览器完成验证才是有效动作。
 * 一句 toast 装不下这些，所以这里把判定依据和可选动作摊开讲清楚。
 *
 * 为什么不用 iframe 渲染那张卡片：本项目的 CSP 没有放开 frame-src，
 * 且拦截卡片里的脚本/外链在客户端里也跑不起来。真要完成人机验证，
 * 交给系统浏览器比塞进弹窗可靠。
 */
import { computed, ref } from 'vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppButton from '@/components/ui/AppButton.vue'
import Badge from '@/components/ui/Badge.vue'
import { copyToClipboard } from '@/lib/share'
import { closeWafBlock, wafBlock } from '@/lib/waf'
import {
  PhShieldWarning as ShieldIcon,
  PhArrowSquareOut as ExternalIcon,
  PhCopy as CopyIcon,
  PhCaretDown as CaretIcon
} from '@phosphor-icons/vue'

const copied = ref(false)
const showRaw = ref(false)

const open = computed(() => wafBlock.value !== null)
const detail = computed(() => wafBlock.value)

/** 剥掉标签取纯文本，用于给用户看一眼卡片里到底写了什么 */
const plainText = computed(() => {
  const html = detail.value?.html || ''
  if (!html) return ''
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.slice(0, 300)
})

/** 原始 HTML 截断，避免把整页（可能几十 KB）塞进剪贴板/DOM */
const rawSnippet = computed(() => {
  const html = detail.value?.html || ''
  return html.length > 2000 ? `${html.slice(0, 2000)}\n…（已截断，共 ${html.length} 字符）` : html
})

async function copyRaw() {
  if (!detail.value) return
  const ok = await copyToClipboard(rawSnippet.value)
  copied.value = ok
  if (ok) {
    setTimeout(() => { copied.value = false }, 2000)
  }
}

function openInBrowser() {
  if (!detail.value) return
  // Electron 下会走 window.open；若主进程未放行外部导航则静默失败，
  // 因此「复制响应原文」始终作为可达的兜底路径保留。
  try {
    window.open(detail.value.url, '_blank', 'noopener,noreferrer')
  } catch {
    /* 忽略：用户可改用复制 */
  }
}

function onClose() {
  closeWafBlock()
  showRaw.value = false
  copied.value = false
}
</script>

<template>
  <AppDialog
    :open="open"
    width="md"
    aria-label="请求被安全系统拦截"
    @close="onClose"
  >
    <div class="p-5 sm:p-6">
      <!-- 标题区 -->
      <div class="flex items-start gap-3 pr-8">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400"
        >
          <ShieldIcon weight="duotone" class="h-5 w-5" />
        </div>
        <div class="min-w-0">
          <h2 class="text-base font-semibold text-foreground">请求已被安全系统拦截</h2>
          <p class="mt-0.5 text-sm text-muted-foreground">
            服务器返回了防火墙拦截页，而不是正常数据
          </p>
        </div>
      </div>

      <!-- 状态码 / 时间 -->
      <div class="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant="warning">HTTP {{ detail?.status ?? 403 }}</Badge>
        <span class="text-xs text-muted-foreground">Web 应用防火墙（WAF）</span>
      </div>

      <!-- 说明 -->
      <div class="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
        <p>
          本次请求在到达服务端之前被防火墙规则拦下了。这与「网络故障」「服务器宕机」是两回事
          —— 服务端本身可能完全正常。
        </p>
        <p>常见的触发原因：</p>
        <ul class="ml-4 list-disc space-y-1">
          <li>短时间内重复上传，被判定为频率异常</li>
          <li>日志内容里含有命中规则的片段（如大量特殊字符、注入特征串）</li>
          <li>当前网络的出口 IP 被临时风控</li>
        </ul>
        <p>可以试试：等待 1–2 分钟后重试，或改用浏览器打开完成验证再回来上传。</p>
      </div>

      <!-- 请求地址 -->
      <div class="mt-4 rounded-lg border border-border bg-muted/40 px-3 py-2">
        <p class="text-xs text-muted-foreground">请求地址</p>
        <p class="mt-0.5 break-all font-mono text-xs text-foreground">{{ detail?.url }}</p>
      </div>

      <!-- 卡片摘要（折叠） -->
      <div v-if="plainText" class="mt-3">
        <button
          class="flex w-full items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
          @click="showRaw = !showRaw"
        >
          <CaretIcon
            weight="duotone"
            class="h-3.5 w-3.5 transition-transform"
            :class="showRaw ? 'rotate-180' : ''"
          />
          {{ showRaw ? '收起拦截页内容' : '查看拦截页内容' }}
        </button>
        <div
          v-if="showRaw"
          class="mt-2 max-h-40 overflow-y-auto rounded-lg border border-border bg-muted/40 px-3 py-2"
        >
          <p class="whitespace-pre-wrap break-all font-mono text-xs text-foreground/80">
            {{ rawSnippet }}
          </p>
        </div>
      </div>

      <!-- 操作 -->
      <div class="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <AppButton variant="ghost" size="md" @click="copyRaw">
          <CopyIcon weight="duotone" class="h-4 w-4" />
          {{ copied ? '已复制' : '复制响应原文' }}
        </AppButton>
        <AppButton variant="outline" size="md" @click="openInBrowser">
          <ExternalIcon weight="duotone" class="h-4 w-4" />
          在浏览器中打开
        </AppButton>
        <AppButton variant="primary" size="md" @click="onClose">
          我知道了
        </AppButton>
      </div>
    </div>
  </AppDialog>
</template>
