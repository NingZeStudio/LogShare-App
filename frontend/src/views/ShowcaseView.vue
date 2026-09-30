<script setup lang="ts">
import { ref } from 'vue'
import { useSeoMeta } from '@/lib/useSeoMeta'
import { siteConfig } from '@/lib/config'
import { toast } from '@/lib/toast'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import AiResultPanel from '@/components/ui/AiResultPanel.vue'
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'
import type { AIAnalysisStatus, AIDiagnosis } from '@/lib/api'
import {
  PhCursorClick as Click,
  PhBell as Bell,
  PhBrowsers as Browsers,
  PhCode as CodeIcon,
  PhCheckCircle as CheckCircle,
  PhShieldWarning as ShieldIcon,
  PhRobot as RobotIcon
} from '@phosphor-icons/vue'

useSeoMeta({
  title: '范式展台',
  description: 'LogShare 设计范式常用组件、动效、色彩与细滚动条交互演示。'
}, siteConfig.name)()

const dialogOpen = ref(false)
const confirmOpen = ref(false)
const dangerConfirmOpen = ref(false)

// AI 结果面板演示数据：覆盖排队 / 思考 / 工具 / 结果 / 上限五种状态
const demoStatusList: AIAnalysisStatus[] = [
  { type: 'queued', position: 2 },
  { type: 'thinking', delta: '正在读取日志结构…' },
  { type: 'tool', name: 'search_log', arguments: { keyword: 'Exception' } },
  { type: 'tool_result', name: 'search_log', summary: '命中 3 处堆栈' },
  { type: 'limit', rounds: 8 }
]

const demoDiagnosis: AIDiagnosis = {
  rootCause: '模组 mixin 注入失败，服务端在启动阶段中断',
  confidence: 0.86,
  troubleshooting: ['移除最近新增的冲突模组', '核对 Forge 与模组版本是否匹配'],
  evidence: ['[main/ERROR] mixin apply failed', '[main/ERROR] Exception during mod loading']
}

// 正文走与线上一致的 Markdown 渲染路径（含代码块与列表）
const demoReport = [
  '## 结论',
  '服务端在 **mixin** 注入阶段中断，与日志第 42 行的堆栈一致。',
  '',
  '```json',
  '{ "stage": "mixin", "mod": "example-mod" }',
  '```',
  '',
  '- 先移除冲突模组再重启',
  '- 若仍失败，附上完整 latest.log 重新分析'
].join('\n')

const triggerToast = (type: 'success' | 'error' | 'info' | 'warning') => {
  switch (type) {
    case 'success':
      toast.success('操作执行成功！数据已实时同步。')
      break
    case 'error':
      toast.error('网络请求异常，已自动降级重试。')
      break
    case 'warning':
      toast.warning('当前环境正在运行调试模式，请勿提交敏感数据。')
      break
    default:
      toast.info('这是一条默认的信息提示通知。')
  }
}

const sampleCode = `// 示例：LogShare 社交元标签动态更新
import { updateSeoMeta } from '@/lib/useSeoMeta'

updateSeoMeta({
  title: '日志分析中心',
  description: '支持批量上传、智能脱敏与堆栈溯源分析。',
  image: 'https://example.com/share-cover.jpg'
})`
</script>

<template>
  <div class="container mx-auto max-w-6xl px-4 sm:px-6 py-10 space-y-12">
    <div class="space-y-2 border-b border-border/60 pb-6">
      <h1 class="text-3xl font-extrabold tracking-tight text-foreground">组件与交互展台</h1>
      <p class="text-sm text-muted-foreground">
        零大型 UI 框架绑定，全部组件采用单文件轻量实现，便于按需拷贝或统一扩展。
      </p>
    </div>

    <!-- 按钮规范 (AppButton) -->
    <section class="space-y-4">
      <div class="flex items-center gap-2">
        <Click weight="duotone" class="h-5 w-5 text-primary" />
        <h2 class="text-lg font-bold text-foreground">按钮系统 (AppButton)</h2>
      </div>

      <Card class="space-y-6">
        <div>
          <p class="text-xs text-muted-foreground mb-3 font-semibold uppercase tracking-wider">尺寸阶梯 (Size)</p>
          <div class="flex flex-wrap items-center gap-3">
            <AppButton size="sm">Small (h-7)</AppButton>
            <AppButton size="md">Default (h-9)</AppButton>
            <AppButton size="lg">Large (h-11)</AppButton>
            <AppButton size="icon" aria-label="Icon">
              <CheckCircle weight="duotone" class="h-4 w-4" />
            </AppButton>
          </div>
        </div>

        <div>
          <p class="text-xs text-muted-foreground mb-3 font-semibold uppercase tracking-wider">语义变体 (Variants)</p>
          <div class="flex flex-wrap items-center gap-3">
            <AppButton variant="primary">Primary</AppButton>
            <AppButton variant="secondary">Secondary</AppButton>
            <AppButton variant="soft">Soft</AppButton>
            <AppButton variant="outline">Outline</AppButton>
            <AppButton variant="ghost">Ghost</AppButton>
            <AppButton variant="muted">Muted</AppButton>
            <AppButton variant="destructive">Destructive</AppButton>
            <AppButton variant="soft-destructive">Soft Destructive</AppButton>
          </div>
        </div>
      </Card>
    </section>

    <!-- 弹窗与通知系统 (AppDialog & Toast) -->
    <section class="space-y-4">
      <div class="flex items-center gap-2">
        <Browsers weight="duotone" class="h-5 w-5 text-primary" />
        <h2 class="text-lg font-bold text-foreground">模态弹窗与轻通知 (Dialog & Toast)</h2>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card class="space-y-4">
          <h3 class="text-base font-bold text-foreground">模态弹窗 (AppDialog)</h3>
          <p class="text-sm text-muted-foreground leading-relaxed">
            内置淡入微缩放过渡、遮罩点击关闭、ESC 按键响应及多档宽度配置。
          </p>
          <AppButton @click="dialogOpen = true">打开示例弹窗</AppButton>
        </Card>

        <Card class="space-y-4">
          <div class="flex items-center gap-2">
            <Bell weight="duotone" class="h-4 w-4 text-primary" />
            <h3 class="text-base font-bold text-foreground">无依赖 Toast 通知</h3>
          </div>
          <p class="text-sm text-muted-foreground leading-relaxed">
            极简事件驱动，内置成功、错误、提示、警告四态与平滑堆叠动效。
          </p>
          <div class="flex flex-wrap gap-2">
            <AppButton size="sm" variant="soft" @click="triggerToast('success')">成功提示</AppButton>
            <AppButton size="sm" variant="soft-destructive" @click="triggerToast('error')">错误告警</AppButton>
            <AppButton size="sm" variant="secondary" @click="triggerToast('info')">常规通知</AppButton>
            <AppButton size="sm" variant="outline" @click="triggerToast('warning')">警告提示</AppButton>
          </div>
        </Card>
      </div>
    </section>

    <!-- 确认弹窗 (ConfirmDialog) -->
    <section class="space-y-4">
      <div class="flex items-center gap-2">
        <ShieldIcon weight="duotone" class="h-5 w-5 text-primary" />
        <h2 class="text-lg font-bold text-foreground">确认弹窗 (ConfirmDialog)</h2>
      </div>

      <Card class="space-y-4">
        <p class="text-sm text-muted-foreground leading-relaxed">
          用来取代原生 <code class="rounded bg-muted px-1 py-0.5 font-mono text-xs">window.confirm()</code>
          —— 原生弹窗不跟随应用主题、无法承载说明文字，也没有确认中的加载态，慢网络下容易被重复点击。
        </p>
        <div class="flex flex-wrap gap-2">
          <AppButton size="sm" class="touch-h" @click="confirmOpen = true">常规确认</AppButton>
          <AppButton size="sm" variant="soft-destructive" class="touch-h" @click="dangerConfirmOpen = true">
            危险操作确认
          </AppButton>
        </div>
      </Card>
    </section>

    <!-- 细滚动条与终端代码块演示 -->
    <section class="space-y-4">
      <div class="flex items-center gap-2">
        <CodeIcon weight="duotone" class="h-5 w-5 text-primary" />
        <h2 class="text-lg font-bold text-foreground">终端沉浸代码块与细滚动条</h2>
      </div>

      <Card class="space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="h-3 w-3 rounded-full bg-rose-500/80 inline-block" />
            <span class="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
            <span class="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
            <span class="text-xs font-mono text-muted-foreground ml-2">seo-demo.ts</span>
          </div>
          <Badge variant="outline">SauceCode Mono</Badge>
        </div>

        <div class="overflow-x-auto rounded-lg border border-border/80 bg-zinc-950 p-4 text-zinc-100 text-xs font-mono">
          <pre class="leading-relaxed"><code>{{ sampleCode }}</code></pre>
        </div>
        <p class="text-xs text-muted-foreground">
          提示：横向滚动条已统一为 6px 细窄轨与半透明滑块，在移动端与桌面端保持一致视觉体验。
        </p>
      </Card>
    </section>

    <!-- AI 结果面板 (AiResultPanel) -->
    <section class="space-y-4">
      <div class="flex items-center gap-2">
        <RobotIcon weight="duotone" class="h-5 w-5 text-primary" />
        <h2 class="text-lg font-bold text-foreground">AI 结果面板 (AiResultPanel)</h2>
      </div>

      <Card class="space-y-3">
        <p class="text-sm text-muted-foreground leading-relaxed">
          首页的内联终端面板与日志详情页的卡内区域共用同一套渲染：状态条、工具调用日志、诊断概览与
          Markdown 正文保持一致，不会出现同一份报告在两个页面长得不同的情况。
        </p>
        <AiResultPanel
          variant="card"
          :content="demoReport"
          :status-list="demoStatusList"
          :diagnosis="demoDiagnosis"
          done
        />
      </Card>
    </section>

    <!-- 示例弹窗实例 -->
    <AppDialog :open="dialogOpen" width="md" aria-label="示例弹窗" @close="dialogOpen = false">
      <div class="p-6 space-y-4">
        <h3 class="text-xl font-bold text-foreground">LogShare 弹窗交互范式</h3>
        <p class="text-sm text-muted-foreground leading-relaxed">
          弹窗使用 Teleport 挂载于 body 根节点，具有独立半透明遮罩与微阴影，支持点击外部空白处或按下键盘 Escape 退出。
        </p>
        <div class="flex justify-end gap-2 pt-2">
          <AppButton variant="secondary" @click="dialogOpen = false">取消</AppButton>
          <AppButton @click="dialogOpen = false; toast.success('已确认操作')">确认执行</AppButton>
        </div>
      </div>
    </AppDialog>

    <!-- 确认弹窗实例：常规 / 危险两种语义 -->
    <ConfirmDialog
      :open="confirmOpen"
      title="执行该操作？"
      description="常规确认示例：中性配色，按钮为「取消 / 确认」。"
      @confirm="confirmOpen = false; toast.success('已确认')"
      @close="confirmOpen = false"
    />
    <ConfirmDialog
      :open="dangerConfirmOpen"
      title="删除这条日志？"
      description="危险操作示例：图标与确认按钮转为告警色。演示不会真正删除任何数据。"
      confirm-text="删除"
      danger
      @confirm="dangerConfirmOpen = false; toast.success('演示环境，未执行删除')"
      @close="dangerConfirmOpen = false"
    />
  </div>
</template>
