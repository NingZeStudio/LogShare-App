<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { siteConfig } from '@/lib/config'
import AppButton from '@/components/ui/AppButton.vue'
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import LogViewer from '@/components/log/LogViewer.vue'
import { toast } from '@/lib/toast'
import { shareLink, copyToClipboard, canShare } from '@/lib/share'
import { getAiDefaultMode } from '@/lib/settings'
import {
  getRawLog,
  getRawFile,
  getLogMetadata,
  getInsights,
  deleteLog,
  type AIMode,
  type LogMetadata,
  type AnalysisResult,
  describeApiError
} from '@/lib/api'
import { saveFileLocal, getHistory, removeHistory, type HistoryEntry } from '@/lib/electron'
import {
  PhArrowLeft as ArrowLeftIcon,
  PhCopy as CopyIcon,
  PhDownload as DownloadIcon,
  PhTrash as TrashIcon,
  PhRobot as RobotIcon,
  PhSpinnerGap as SpinnerIcon,
  PhCheck as CheckIcon,
  PhX as XIcon,
  PhFileText as FileTextIcon,
  PhWarning as WarningIcon,
  PhLightbulb as LightbulbIcon,
  PhInfo as InfoIcon,
  PhShareNetwork as ShareIcon
} from '@phosphor-icons/vue'

const route = useRoute()
const router = useRouter()
const logId = route.params.id as string

const metadata = ref<LogMetadata | null>(null)
const rawContent = ref('')
const insights = ref<AnalysisResult | null>(null)
const loading = ref(true)
const error = ref('')

// 附件文件切换：默认主文件，可切换到附加文件查看
const activeFile = ref('')
const viewerRaw = ref('')
const loadingFile = ref(false)

// 摘要句：从服务端元数据派生（版本 / 加载器等），排除 visible=false 的隐藏项
const logSummary = computed(() => {
  const m = metadata.value
  if (!m) return ''
  const parts: string[] = []
  for (const item of m.metadata || []) {
    if (item.visible === false) continue
    if (item.label && item.value) parts.push(`${item.label} ${item.value}`)
  }
  return parts.join(' · ')
})

// 问题统计（来自 Codex 本地分析）：问题总数 / 可解决数
const problemStats = computed(() => {
  const problems = insights.value?.analysis?.problems || []
  return {
    total: problems.length,
    solvable: problems.filter((p) => Array.isArray(p.solutions) && p.solutions.length > 0).length
  }
})

// AI 分析入口：在详情页选好模式，跳转独立分析页（/log/:id/ai）执行
const aiMode = ref<AIMode>(getAiDefaultMode())

// 历史记录中的 token（用于删除）与分享链接
const historyToken = ref('')
const historyUrl = ref('')

// 顶部操作区状态：删除确认弹窗、复制反馈、是否支持系统分享面板
const deleteDialogOpen = ref(false)
const deleting = ref(false)
const copied = ref(false)
const canSystemShare = ref(false)

/** 分享地址：优先用上传时服务端返回的权威链接 */
const shareUrl = computed(() => historyUrl.value || `${siteConfig.url}/${logId}`)

const modeOptions = [
  { value: 'deep' as AIMode, label: '深度', icon: InfoIcon },
  { value: 'launcher' as AIMode, label: '启动器', icon: WarningIcon },
  { value: 'quick' as AIMode, label: '极速', icon: LightbulbIcon }
]

/** 进入独立 AI 分析页（带上所选模式） */
function goAI() {
  router.push(`/log/${logId}/ai?mode=${aiMode.value}`)
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    // 并行加载元信息、原始日志、分析洞察
    const [meta, raw, ins] = await Promise.allSettled([
      getLogMetadata(logId),
      getRawLog(logId),
      getInsights(logId)
    ])

    if (meta.status === 'fulfilled') {
      metadata.value = meta.value
    }
    if (raw.status === 'fulfilled') {
      rawContent.value = raw.value
      viewerRaw.value = raw.value
    }
    if (ins.status === 'fulfilled' && ins.value?.analysis) {
      insights.value = ins.value
    }

    // 从历史记录查找 token
    const history = await getHistory()
    const entry = history.find((h: HistoryEntry) => h.id === logId)
    if (entry) {
      historyToken.value = entry.token
      historyUrl.value = entry.url
    }
  } catch (err: any) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

// 复制链接：走封装实现，file:// 与旧 WebView 下自动回落 execCommand
async function copyUrl() {
  const ok = await copyToClipboard(shareUrl.value)
  if (!ok) {
    toast.error('复制失败，请手动选择链接')
    return
  }
  copied.value = true
  toast.success('链接已复制到剪贴板')
  setTimeout(() => { copied.value = false }, 2000)
}

// 分享：移动端调起系统面板，桌面端不支持时 shareLink 会自动回落剪贴板
async function shareLog() {
  const res = await shareLink(shareUrl.value, 'LogShare 日志分享')

  // 用户在系统面板里主动取消 —— 静默处理，不弹任何提示
  if (res.cancelled) return

  if (res.method === 'clipboard') {
    copied.value = true
    toast.success('当前环境不支持系统分享，链接已复制')
    setTimeout(() => { copied.value = false }, 2000)
    return
  }

  if (!res.ok) {
    toast.error('分享失败，请手动复制链接')
  }
}

async function downloadLog() {
  await saveFileLocal(`${logId}.log`, rawContent.value)
  toast.success('文件已保存')
}

/** 切换查看主文件 / 附加文件 */
async function switchFile(name: string) {
  if (!name) {
    activeFile.value = ''
    viewerRaw.value = rawContent.value
    return
  }
  activeFile.value = name
  loadingFile.value = true
  try {
    viewerRaw.value = await getRawFile(logId, name)
  } catch (err) {
    toast.error('加载附件失败：' + describeApiError(err))
    activeFile.value = ''
    viewerRaw.value = rawContent.value
  } finally {
    loadingFile.value = false
  }
}

function requestDelete() {
  if (!historyToken.value) {
    toast.error('无法删除：缺少删除令牌（Token 仅在上传时返回一次）')
    return
  }
  deleteDialogOpen.value = true
}

// 弹窗确认后的实际删除；失败时保持弹窗打开，由调用方决定重试或取消
async function confirmDelete() {
  deleting.value = true
  try {
    const res = await deleteLog(logId, historyToken.value)
    if (res.success) {
      await removeHistory(logId)
      deleteDialogOpen.value = false
      toast.success('日志已删除')
      router.push('/')
    } else {
      toast.error(res.error || '删除失败')
    }
  } catch (err) {
    toast.error('删除失败：' + describeApiError(err))
  } finally {
    deleting.value = false
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

function formatTime(ts: number): string {
  // 服务端时间戳可能是秒级或毫秒级，小于 1e12 视为秒
  const ms = ts < 1e12 ? ts * 1000 : ts
  return new Date(ms).toLocaleString('zh-CN')
}

onMounted(() => {
  // 是否支持系统分享面板决定顶部要不要多一个「分享」按钮（桌面端没有 navigator.share）
  canSystemShare.value = canShare()
  loadData()
})
</script>

<template>
  <div class="container mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-4">
    <!-- 顶部导航 -->
    <div class="flex flex-wrap items-center gap-1.5 sm:gap-3">
      <AppButton size="sm" variant="ghost" class="touch-h" @click="router.push('/')">
        <ArrowLeftIcon weight="duotone" class="h-4 w-4" />
        返回
      </AppButton>
      <div class="flex-1" />
      <!-- 系统分享面板只在移动端可用；桌面端没有 navigator.share，只保留复制 -->
      <AppButton
        v-if="canSystemShare"
        size="sm"
        variant="ghost"
        class="touch-h"
        @click="shareLog"
      >
        <ShareIcon weight="duotone" class="h-3.5 w-3.5" />
        分享
      </AppButton>
      <AppButton size="sm" variant="ghost" class="touch-h" @click="copyUrl">
        <component :is="copied ? CheckIcon : CopyIcon" weight="duotone" class="h-3.5 w-3.5" />
        {{ copied ? '已复制' : '复制链接' }}
      </AppButton>
      <AppButton v-if="rawContent" size="sm" variant="ghost" class="touch-h" @click="downloadLog">
        <DownloadIcon weight="duotone" class="h-3.5 w-3.5" />
        下载
      </AppButton>
      <AppButton v-if="historyToken" size="sm" variant="soft-destructive" class="touch-h" @click="requestDelete">
        <TrashIcon weight="duotone" class="h-3.5 w-3.5" />
        删除
      </AppButton>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <SpinnerIcon weight="duotone" class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <!-- 错误 -->
    <Card v-else-if="error" class="text-center py-12">
      <XIcon weight="duotone" class="h-10 w-10 mx-auto text-destructive mb-3" />
      <p class="text-sm text-muted-foreground">{{ error }}</p>
    </Card>

    <template v-else>
      <!-- 元信息卡片 -->
      <Card v-if="metadata" padded class="space-y-4">
        <div class="flex items-center gap-2 flex-wrap">
          <FileTextIcon weight="duotone" class="h-5 w-5 text-primary" />
          <h1 class="text-lg font-bold break-all">日志 {{ metadata.id }}</h1>
          <Badge variant="secondary" class="ml-auto">{{ formatSize(metadata.size) }}</Badge>
          <Badge variant="outline">{{ metadata.lines }} 行</Badge>
        </div>

        <!-- 摘要句：从元数据派生（版本/加载器等） -->
        <p v-if="logSummary" class="text-sm text-muted-foreground">{{ logSummary }}</p>

        <!-- 问题统计徽章 -->
        <div v-if="problemStats.total > 0" class="flex items-center gap-2 flex-wrap">
          <Badge variant="destructive">检测到 {{ problemStats.total }} 个问题</Badge>
          <Badge v-if="problemStats.solvable > 0" variant="success">其中 {{ problemStats.solvable }} 个可解决</Badge>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p class="text-xs text-muted-foreground">来源</p>
            <p class="font-mono">{{ metadata.source || '未知' }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">创建时间</p>
            <p class="font-mono">{{ formatTime(metadata.created) }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">过期时间</p>
            <p class="font-mono">{{ formatTime(metadata.expires) }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">附加文件</p>
            <p>{{ metadata.files?.length || 0 }} 个</p>
          </div>
        </div>

        <!-- 附加文件切换器：多文件时可切换查看 -->
        <div v-if="metadata.files && metadata.files.length > 1" class="flex items-center gap-1.5 flex-wrap">
          <button
            class="touch-h flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
            :class="activeFile === '' ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:text-foreground'"
            @click="switchFile('')"
          >
            <FileTextIcon weight="duotone" class="h-3.5 w-3.5" />
            主文件
          </button>
          <button
            v-for="file in metadata.files"
            :key="file.name"
            class="touch-h flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
            :class="activeFile === file.name ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:text-foreground'"
            @click="switchFile(file.name)"
          >
            <FileTextIcon weight="duotone" class="h-3.5 w-3.5" />
            {{ file.name }}
            <span class="text-muted-foreground">{{ formatSize(file.size) }}</span>
          </button>
        </div>
      </Card>

      <!-- Codex 分析结果 -->
      <Card v-if="insights" padded class="space-y-4">
        <div class="flex items-center gap-2">
          <LightbulbIcon weight="duotone" class="h-5 w-5 text-amber-500" />
          <h2 class="text-base font-bold">本地分析结果</h2>
          <Badge variant="secondary" class="ml-auto">{{ insights.title || insights.name }}</Badge>
        </div>

        <!-- 问题 -->
        <div v-if="insights.analysis?.problems?.length > 0" class="space-y-2">
          <p class="text-xs font-semibold text-muted-foreground">检测到的问题</p>
          <div
            v-for="(problem, idx) in insights.analysis.problems"
            :key="idx"
            class="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2"
          >
            <div class="flex items-start gap-2">
              <WarningIcon weight="duotone" class="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p class="text-sm flex-1">{{ problem.message }}</p>
              <Badge variant="warning" class="shrink-0">×{{ problem.counter }}</Badge>
            </div>
            <div v-if="problem.solutions?.length > 0" class="pl-6 space-y-1">
              <p class="text-xs text-muted-foreground">建议方案：</p>
              <ul class="list-disc list-inside space-y-0.5">
                <li v-for="(sol, sIdx) in problem.solutions" :key="sIdx" class="text-sm text-foreground">
                  {{ sol }}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- 信息 -->
        <div v-if="insights.analysis?.information?.length > 0" class="space-y-2">
          <p class="text-xs font-semibold text-muted-foreground">识别信息</p>
          <div class="flex flex-wrap gap-2">
            <Badge
              v-for="(info, idx) in insights.analysis.information"
              :key="idx"
              variant="outline"
            >
              {{ info.label || info.message }}
            </Badge>
          </div>
        </div>
      </Card>

      <!-- AI 分析入口：分析在独立页面执行，详情页只留选模式 + 进入 -->
      <Card padded class="space-y-3">
        <div class="flex items-center gap-2 flex-wrap">
          <RobotIcon weight="duotone" class="h-5 w-5 text-sky-500" />
          <h2 class="text-base font-bold">AI 深度分析</h2>
          <div class="flex-1" />
          <div class="flex items-center gap-1 rounded-lg border border-border/60 bg-background/60 p-0.5">
            <button
              v-for="mode in modeOptions"
              :key="mode.value"
              class="touch-h flex items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors"
              :class="aiMode === mode.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
              @click="aiMode = mode.value"
            >
              <component :is="mode.icon" weight="duotone" class="h-3 w-3" />
              {{ mode.label }}
            </button>
          </div>
          <AppButton size="sm" variant="soft" class="touch-h" @click="goAI">
            <RobotIcon weight="duotone" class="h-3.5 w-3.5" />
            开始分析
          </AppButton>
        </div>
        <p class="text-sm text-muted-foreground">
          在独立页面中逐工具排查这份日志：思考过程、工具调用、诊断结论与完整报告分步呈现，空间充裕不拥挤。
        </p>
      </Card>

      <!-- 日志查看器：行号 / 错误高亮 / § 颜色码 / 搜索 / 字体 / 全屏 -->
      <Card padded class="space-y-2">
        <div class="flex items-center gap-2">
          <FileTextIcon weight="duotone" class="h-5 w-5 text-muted-foreground" />
          <h2 class="text-base font-bold">日志内容</h2>
          <span v-if="loadingFile" class="flex items-center gap-1 text-xs text-muted-foreground">
            <SpinnerIcon weight="duotone" class="h-3 w-3 animate-spin" />
            加载中...
          </span>
        </div>
        <div class="h-[60vh] min-h-[320px]">
          <LogViewer
            :raw="viewerRaw"
            :loading="loadingFile"
            can-analyze
            @analyze="goAI"
            @download="downloadLog"
            @delete="requestDelete"
          />
        </div>
      </Card>
    </template>

    <!-- 删除确认：原生 confirm 在 WebView 里不跟随应用主题，也无法承载说明与加载态 -->
    <ConfirmDialog
      :open="deleteDialogOpen"
      title="删除这条日志？"
      description="日志将从服务端移除，分享链接立即失效，此操作不可撤销。"
      confirm-text="删除"
      danger
      :busy="deleting"
      @confirm="confirmDelete"
      @close="deleteDialogOpen = false"
    />
  </div>
</template>
