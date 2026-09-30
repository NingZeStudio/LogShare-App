<script setup lang="ts">
/**
 * AI 分析结果面板（容器：思考过程 + 诊断概览 + 报告正文）
 *
 * 三种形态：
 * - `panel`：首页内联的深色终端面板，自带滚动与高度上限；
 * - `card`：卡内使用（详情页内联场景）；
 * - `full`：独立 AI 分析整页（无内部高度限制，由页面滚动）。
 *
 * 三段内容可分别拆给外部布局：
 * - `showTrace`：思考链 / 工具日志（AiTracePanel）
 * - `showDiagnosis`：诊断概览（AiDiagnosisCard）
 * 独立 AI 页把这两段移到右侧栏时都传 false，只保留报告正文。
 *
 * 配色：`panel` 沿用日志终端深色；`card`/`full` 一律跟随主题
 * （此前正文用 `--log-bg` 深色块 + 强制 prose-invert，在亮色主题下是一大块黑）。
 */
import { computed } from 'vue'
import AiTracePanel from './AiTracePanel.vue'
import AiDiagnosisCard from './AiDiagnosisCard.vue'
import { renderMarkdown } from '@/lib/markdown'
import type { AIAnalysisStatus, AIDiagnosis } from '@/lib/api'
import {
  PhRobot as RobotIcon,
  PhCheck as CheckIcon,
  PhX as XIcon
} from '@phosphor-icons/vue'

const props = withDefaults(
  defineProps<{
    /** 流式累积的分析正文 */
    content?: string
    running?: boolean
    /** 当前阶段的一句话状态 */
    status?: string
    statusList?: AIAnalysisStatus[]
    error?: string
    done?: boolean
    diagnosis?: AIDiagnosis | null
    /** panel=首页内联（自带滚动上限）· card=卡内 · full=独立整页（无内部高度限制，由页面滚动） */
    variant?: 'panel' | 'card' | 'full'
    /** 运行中是否显示「停止」（调用方需持有 AbortController） */
    cancellable?: boolean
    /** 是否在面板内渲染思考/工具日志（独立页移到右侧栏时传 false） */
    showTrace?: boolean
    /** 是否在面板内渲染诊断概览（独立页移到右侧栏时传 false） */
    showDiagnosis?: boolean
  }>(),
  {
    content: '',
    running: false,
    status: '',
    statusList: () => [],
    error: '',
    done: false,
    diagnosis: null,
    variant: 'panel',
    cancellable: false,
    showTrace: true,
    showDiagnosis: true
  }
)

const emit = defineEmits<{ stop: [] }>()

const isPanel = computed(() => props.variant === 'panel')
const isFull = computed(() => props.variant === 'full')

// 没有任何可展示内容时不占位（首页用它在无分析时让位给日志文本）
const hasAny = computed(
  () =>
    !!props.content ||
    !!props.error ||
    (props.showDiagnosis && !!props.diagnosis) ||
    (props.showTrace && (props.running || props.statusList.length > 0))
)

const rootClass = computed(() =>
  isPanel.value
    ? 'border-t border-border bg-[var(--log-bg)] text-[#e0e0e0] max-h-[38dvh] sm:max-h-[45vh] overflow-y-auto'
    : isFull.value
      ? 'space-y-4'
      : 'space-y-3'
)

const errorClass = computed(() =>
  isPanel.value
    ? 'px-4 py-3 text-sm text-rose-400 flex items-center gap-2'
    : 'flex items-center gap-2 text-sm text-rose-500'
)

// 诊断概览在内联场景下的外层留白（panel 变体需要横向 padding + 底部分隔）
const diagnosisWrapClass = computed(() =>
  isPanel.value ? 'px-4 py-3 border-b border-[var(--log-border)]' : ''
)

// 正文容器：panel 深色终端；card/full 跟随主题（不再是一大块黑）
const bodyClass = computed(() =>
  isPanel.value
    ? 'px-4 py-3'
    : isFull.value
      ? 'rounded-xl border border-border bg-card p-4 sm:p-5'
      : 'rounded-xl border border-border bg-card p-4 max-h-96 overflow-y-auto'
)

// markdown 排版：panel 深色背景需 invert；card/full 跟随主题（暗色主题才 invert）
const proseClass = computed(() =>
  isPanel.value
    ? 'prose prose-invert prose-sm max-w-none text-sm leading-relaxed'
    : 'prose dark:prose-invert prose-sm max-w-none text-sm leading-relaxed'
)
</script>

<template>
  <div v-if="hasAny" :class="rootClass">
    <!-- 思考链 + 工具调用日志（独立页移到右侧栏时 showTrace=false） -->
    <AiTracePanel
      v-if="showTrace"
      variant="panel"
      :running="running"
      :status="status"
      :status-list="statusList"
      :cancellable="cancellable"
      @stop="emit('stop')"
    />

    <!-- 错误信息 -->
    <div v-if="error" :class="errorClass">
      <XIcon weight="duotone" class="h-4 w-4 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <!-- 诊断概览（独立页移到右侧栏时 showDiagnosis=false） -->
    <div v-if="showDiagnosis" :class="diagnosisWrapClass">
      <AiDiagnosisCard :diagnosis="diagnosis" :done="done" variant="panel" />
    </div>

    <!-- AI 报告正文 -->
    <div v-if="content" :class="bodyClass">
      <div class="mb-2 flex items-center gap-2">
        <RobotIcon weight="duotone" class="h-4 w-4 shrink-0 text-sky-500" />
        <span class="text-xs font-bold text-muted-foreground">AI 分析报告</span>
        <CheckIcon
          v-if="done"
          weight="duotone"
          class="ml-auto h-3.5 w-3.5 text-emerald-500"
        />
      </div>
      <!-- renderMarkdown 内部先做 HTML 转义再插标签，AI 回显的日志内容不会形成 XSS -->
      <div :class="proseClass" v-html="renderMarkdown(content)"></div>
      <!-- 流式输出时的闪烁光标 -->
      <span v-if="running" class="ai-streaming-cursor text-sky-500"></span>
    </div>
  </div>
</template>
