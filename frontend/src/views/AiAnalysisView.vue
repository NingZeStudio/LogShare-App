<script setup lang="ts">
/**
 * AI 深度分析 —— 独立页面（/log/:id/ai）
 *
 * 布局学线上：桌面端**左侧结论与报告、右侧分析过程**（思考链 + 工具调用），
 * 移动端单栏堆叠（过程在上、结果在下）。正文跟随主题配色，不再是深色终端块。
 *
 * 进入页面自动开始分析（模式可从详情页 ?mode= 带入），离开页面自动中止在途的流。
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppButton from '@/components/ui/AppButton.vue'
import AiResultPanel from '@/components/ui/AiResultPanel.vue'
import AiTracePanel from '@/components/ui/AiTracePanel.vue'
import AiDiagnosisCard from '@/components/ui/AiDiagnosisCard.vue'
import { toast } from '@/lib/toast'
import { getAiDefaultMode } from '@/lib/settings'
import {
  aiAnalyzeStored,
  parseDiagnosis,
  describeApiError,
  type AIMode,
  type AIAnalysisStatus,
  type AIDiagnosis
} from '@/lib/api'
import {
  PhArrowLeft as ArrowLeftIcon,
  PhRobot as RobotIcon,
  PhSpinnerGap as SpinnerIcon,
  PhLightning as QuickIcon,
  PhMagnifyingGlass as DeepIcon,
  PhRocketLaunch as LauncherIcon,
  PhFileText as FileTextIcon,
  PhBrain as BrainIcon
} from '@phosphor-icons/vue'

const route = useRoute()
const router = useRouter()
const logId = route.params.id as string

// 状态
const aiMode = ref<AIMode>(normalizeMode(route.query.mode))
const aiRunning = ref(false)
const aiContent = ref('')
const aiStatus = ref('')
const aiStatusList = ref<AIAnalysisStatus[]>([])
const aiError = ref('')
const aiDone = ref(false)
const diagnosis = ref<AIDiagnosis | null>(null)

// AI 流取消控制器
let aiController: AbortController | null = null

function normalizeMode(v: unknown): AIMode {
  if (v === 'quick' || v === 'launcher' || v === 'deep') return v
  // 未指定时用「设置」页里的默认分析模式
  return getAiDefaultMode()
}

const modeOptions = [
  { value: 'deep' as AIMode, label: '深度排障', icon: DeepIcon, desc: '全工具链深度分析' },
  { value: 'launcher' as AIMode, label: '启动器优先', icon: LauncherIcon, desc: '启动器崩溃优先匹配' },
  { value: 'quick' as AIMode, label: '极速直答', icon: QuickIcon, desc: '单轮快速回答' }
]

// 已生成字符数（流式时展示进度感）
const contentLength = computed(() => aiContent.value.length)

// 是否从未开始（空状态：给主操作入口）
const idle = computed(
  () => !aiRunning.value && !aiContent.value && !aiError.value && aiStatusList.value.length === 0
)

async function startAI() {
  if (aiRunning.value) return
  aiRunning.value = true
  aiContent.value = ''
  aiStatus.value = ''
  aiStatusList.value = []
  aiError.value = ''
  aiDone.value = false
  diagnosis.value = null

  aiController = new AbortController()
  const signal = aiController.signal

  try {
    await aiAnalyzeStored(logId, aiMode.value, {
      onContent: (text) => { aiContent.value += text },
      onStatus: (status) => {
        aiStatusList.value.push(status)
        if (status.type === 'queued') aiStatus.value = `排队中（位置 ${status.position}）`
        else if (status.type === 'thinking') aiStatus.value = '正在思考...'
        else if (status.type === 'tool') aiStatus.value = `调用工具：${status.name}`
        else if (status.type === 'tool_result') aiStatus.value = `工具返回：${status.name}`
        else if (status.type === 'limit') aiStatus.value = '达到轮次上限'
      },
      onError: (err) => { aiError.value = err; toast.error('AI 分析失败：' + err) },
      onDone: () => {
        aiDone.value = true
        diagnosis.value = parseDiagnosis(aiContent.value)
        toast.success('AI 分析完成')
      }
    }, signal)
  } catch (err) {
    if (!signal.aborted) {
      const msg = describeApiError(err)
      aiError.value = msg
      toast.error(msg)
    }
  } finally {
    aiRunning.value = false
    aiController = null
  }
}

function stopAI() {
  aiController?.abort()
  aiController = null
  aiRunning.value = false
}

onMounted(() => {
  // 进入即自动开始：点「AI 分析」的意图就是要分析，无需再点一次
  startAI()
})
onUnmounted(() => {
  aiController?.abort()
  aiController = null
})
</script>

<template>
  <div class="container mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-4">
    <!-- 顶栏 -->
    <div class="flex items-center gap-3">
      <AppButton size="sm" variant="ghost" class="touch-h" @click="router.back()">
        <ArrowLeftIcon weight="duotone" class="h-4 w-4" />
        返回
      </AppButton>
      <RobotIcon weight="duotone" class="h-5 w-5 text-sky-500" />
      <h1 class="text-lg font-bold">AI 深度分析</h1>
      <span class="flex items-center gap-1 text-xs font-mono text-muted-foreground">
        <FileTextIcon weight="duotone" class="h-3.5 w-3.5" />
        {{ logId }}
      </span>
      <div class="flex-1" />
    </div>

    <!-- 控制条：模式选择 + 主操作 -->
    <div class="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl px-3 py-2.5">
      <div class="grid grid-cols-3 gap-1 sm:flex sm:w-fit rounded-lg border border-border/60 bg-background/60 p-0.5">
        <button
          v-for="mode in modeOptions"
          :key="mode.value"
          class="touch-h flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
          :class="aiMode === mode.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'"
          :title="mode.desc"
          @click="aiMode = mode.value"
        >
          <component :is="mode.icon" weight="duotone" class="h-3.5 w-3.5 shrink-0" />
          {{ mode.label }}
        </button>
      </div>

      <div class="flex-1" />

      <AppButton v-if="aiRunning" size="sm" variant="soft-destructive" class="touch-h" @click="stopAI">
        <SpinnerIcon weight="duotone" class="h-3.5 w-3.5 animate-spin" />
        停止
      </AppButton>
      <AppButton v-else size="sm" variant="soft" class="touch-h" @click="startAI">
        <RobotIcon weight="duotone" class="h-3.5 w-3.5" />
        {{ aiDone || aiError ? '重新分析' : '开始分析' }}
      </AppButton>
    </div>

    <!-- 空状态 -->
    <div
      v-if="idle"
      class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 px-6 text-center"
    >
      <RobotIcon weight="duotone" class="h-14 w-14 text-muted-foreground/50 mb-3" />
      <p class="text-sm text-muted-foreground">选择分析模式后开始，AI 将逐工具排查这份日志</p>
      <AppButton size="lg" class="mt-5" @click="startAI">
        <RobotIcon weight="duotone" class="h-4 w-4" />
        开始分析
      </AppButton>
    </div>

    <!-- 两栏布局：桌面 左=结论/报告 · 右=分析过程；移动 单栏（过程在上，结果在下） -->
    <div v-else class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <!-- 右侧：诊断结论 + 分析过程（思考链 + 工具调用） -->
      <aside class="order-1 space-y-4 lg:order-2 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
        <!-- 核心根因 / 置信度 / 排障步骤 / 证据链 -->
        <AiDiagnosisCard :diagnosis="diagnosis" :done="aiDone" variant="plain" />

        <div class="flex max-h-[55dvh] flex-col overflow-hidden rounded-2xl border border-border bg-card lg:max-h-[calc(100dvh-14rem)]">
          <div class="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
            <BrainIcon weight="duotone" class="h-4 w-4 text-sky-500" />
            <h2 class="text-sm font-bold">分析过程</h2>
            <div class="flex-1" />
            <span v-if="aiRunning" class="flex items-center gap-1 text-xs text-muted-foreground">
              <SpinnerIcon weight="duotone" class="h-3 w-3 animate-spin text-sky-400" />
              进行中<span v-if="contentLength > 0" class="font-mono"> · 已生成 {{ contentLength }} 字</span>
            </span>
            <span v-else-if="aiDone" class="text-xs text-emerald-500">已完成</span>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
            <AiTracePanel
              variant="plain"
              :running="aiRunning"
              :status="aiStatus"
              :status-list="aiStatusList"
              cancellable
              @stop="stopAI"
            />
            <p
              v-if="aiRunning && aiStatusList.length === 0"
              class="text-xs text-muted-foreground"
            >正在建立连接…</p>
          </div>
        </div>
      </aside>

      <!-- 左侧：报告正文 -->
      <div class="order-2 min-w-0 space-y-4 lg:order-1">
        <!-- 分析中且尚无正文：占位 -->
        <div
          v-if="aiRunning && !aiContent"
          class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center"
        >
          <SpinnerIcon weight="duotone" class="h-8 w-8 animate-spin text-muted-foreground mb-3" />
          <p class="text-sm text-muted-foreground">AI 正在逐工具排查这份日志，结论与过程见侧栏</p>
        </div>

        <AiResultPanel
          variant="full"
          :show-trace="false"
          :show-diagnosis="false"
          :content="aiContent"
          :running="aiRunning"
          :status="aiStatus"
          :status-list="aiStatusList"
          :error="aiError"
          :done="aiDone"
          :diagnosis="diagnosis"
          cancellable
          @stop="stopAI"
        />
      </div>
    </div>
  </div>
</template>
