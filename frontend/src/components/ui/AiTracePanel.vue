<script setup lang="ts">
/**
 * AI 分析过程面板（思考链 + 工具调用日志）
 *
 * 从 AiResultPanel 抽出，供两处复用：
 * - 首页 / 详情页内联（`variant="panel"`，深色终端风格，嵌在 AiResultPanel 里）
 * - 独立 AI 分析页的右侧栏（`variant="plain"`，跟随主题）
 *
 * 思考链逐 token 吐，这里把**连续的 thinking delta 聚合成一条完整句子**，
 * 避免一句推理碎成几十条。
 */
import { computed } from 'vue'
import AppButton from './AppButton.vue'
import type { AIAnalysisStatus } from '@/lib/api'
import { PhSpinnerGap as SpinnerIcon, PhStopCircle as StopIcon } from '@phosphor-icons/vue'

// 上限：长分析持续吐状态，不加限制会产生海量 DOM 节点
const MAX_STATUS_LOG = 200

const props = withDefaults(
  defineProps<{
    running?: boolean
    /** 当前阶段的一句话状态 */
    status?: string
    statusList?: AIAnalysisStatus[]
    /** 运行中是否显示「停止」 */
    cancellable?: boolean
    /** panel=深色终端（内嵌 AiResultPanel）· plain=跟随主题（独立页侧栏） */
    variant?: 'panel' | 'plain'
  }>(),
  {
    running: false,
    status: '',
    statusList: () => [],
    cancellable: false,
    variant: 'plain'
  }
)

const emit = defineEmits<{ stop: [] }>()

const isPanel = computed(() => props.variant === 'panel')

const displayStatus = computed<AIAnalysisStatus[]>(() => {
  const out: AIAnalysisStatus[] = []
  for (const s of props.statusList) {
    if (s.type === 'thinking') {
      const last = out[out.length - 1]
      if (last && last.type === 'thinking') {
        last.delta = (last.delta || '') + (s.delta || '')
      } else {
        out.push({ ...s, delta: s.delta || '' })
      }
    } else {
      out.push({ ...s })
    }
  }
  return out
})

const visibleStatus = computed(() =>
  displayStatus.value.length > MAX_STATUS_LOG
    ? displayStatus.value.slice(displayStatus.value.length - MAX_STATUS_LOG)
    : displayStatus.value
)

const statusBarClass = computed(() =>
  isPanel.value
    ? 'flex items-center gap-2 px-4 py-2 border-b border-[var(--log-border)] text-xs text-muted-foreground'
    : 'flex items-center gap-2 text-xs text-muted-foreground'
)

const statusLogClass = computed(() =>
  isPanel.value
    ? 'px-4 py-2 space-y-1 border-b border-[var(--log-border)]'
    : 'space-y-1.5'
)
</script>

<template>
  <!-- 状态条：只在运行中显示 -->
  <div v-if="running && status" :class="statusBarClass">
    <SpinnerIcon weight="duotone" class="h-3.5 w-3.5 shrink-0 animate-spin text-sky-400" />
    <span class="truncate">{{ status }}</span>
    <div class="flex-1" />
    <AppButton
      v-if="cancellable"
      size="sm"
      variant="ghost"
      class="touch-h shrink-0"
      @click="emit('stop')"
    >
      <StopIcon weight="duotone" class="h-3.5 w-3.5" />
      停止
    </AppButton>
  </div>

  <!-- 思考链 + 工具调用日志 -->
  <div v-if="visibleStatus.length > 0" :class="statusLogClass">
    <div v-for="(item, idx) in visibleStatus" :key="idx" class="text-xs font-mono">
      <template v-if="item.type === 'queued'">
        <span class="text-amber-500">[排队]</span>
        <span class="text-muted-foreground"> 位置 {{ item.position }}</span>
      </template>
      <template v-else-if="item.type === 'thinking'">
        <div class="flex items-start gap-1.5">
          <span class="shrink-0 text-purple-500 dark:text-purple-400">[思考]</span>
          <span class="min-w-0 break-words text-muted-foreground">{{ item.delta }}</span>
        </div>
      </template>
      <template v-else-if="item.type === 'tool'">
        <span class="text-sky-500 dark:text-sky-400">[工具]</span>
        <span class="text-sky-600 dark:text-sky-300"> {{ item.name }}</span>
        <span class="text-muted-foreground"> {{ JSON.stringify(item.arguments) }}</span>
      </template>
      <template v-else-if="item.type === 'tool_result'">
        <span class="text-emerald-500 dark:text-emerald-400">[结果]</span>
        <span class="text-emerald-600 dark:text-emerald-300"> {{ item.name }}</span>
        <span class="text-muted-foreground"> {{ item.summary }}</span>
      </template>
      <template v-else-if="item.type === 'limit'">
        <span class="text-rose-500 dark:text-rose-400">[上限] 达到 {{ item.rounds }} 轮</span>
      </template>
    </div>
  </div>
</template>
