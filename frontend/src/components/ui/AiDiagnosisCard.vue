<script setup lang="ts">
/**
 * AI 诊断概览卡片（核心根因 + 置信度 + 排障步骤 + 证据链 + 原始数据）
 *
 * 从 AiResultPanel 抽出：
 * - 内联场景由 AiResultPanel 组装（`variant="panel"` 深色终端）；
 * - 独立 AI 页把它放到右侧结论栏（`variant="plain"` 跟随主题）。
 *
 * 诊断字段一律走兜底读取，不在模板里直接取 `diagnosis.xxx.length`：
 * 服务端排障步骤字段名从 troubleshooting 改为 steps 时，模板里的
 * `diagnosis.troubleshooting.length` 在 undefined 上抛 TypeError，
 * 会让整块渲染崩溃（AI 面板内容直接消失）。
 */
import { ref, computed } from 'vue'
import type { AIDiagnosis } from '@/lib/api'
import {
  PhBrain as BrainIcon,
  PhTarget as TargetIcon,
  PhListChecks as ListChecksIcon,
  PhLinkSimple as LinkSimpleIcon,
  PhCode as CodeIcon
} from '@phosphor-icons/vue'

const props = withDefaults(
  defineProps<{
    diagnosis?: AIDiagnosis | null
    done?: boolean
    /** panel=深色终端（内嵌 AiResultPanel）· plain=跟随主题（独立页侧栏） */
    variant?: 'panel' | 'plain'
  }>(),
  { diagnosis: null, done: false, variant: 'plain' }
)

const isPanel = computed(() => props.variant === 'panel')

const diagTroubleshooting = computed<string[]>(() =>
  Array.isArray(props.diagnosis?.troubleshooting) ? props.diagnosis.troubleshooting : []
)
const diagEvidence = computed<string[]>(() =>
  Array.isArray(props.diagnosis?.evidence) ? props.diagnosis.evidence : []
)
const diagRootCause = computed(() => props.diagnosis?.rootCause || '')
const diagConfidence = computed(() =>
  typeof props.diagnosis?.confidence === 'number' ? props.diagnosis.confidence : 0
)
const diagConfidencePct = computed(() => Math.round(diagConfidence.value * 100))
const diagRawJson = computed(() => props.diagnosis?.rawJson || '')

const showRawJson = ref(false)

const cardClass = computed(() =>
  isPanel.value
    ? 'rounded-lg bg-[var(--log-code-bg)] border border-[var(--log-border)] p-4 space-y-3'
    : 'rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 space-y-3'
)
</script>

<template>
  <div v-if="diagnosis && done" :class="cardClass">
    <div class="flex items-center gap-2">
      <BrainIcon weight="duotone" class="h-4 w-4 shrink-0 text-sky-500" />
      <span class="text-sm font-bold text-foreground">AI 诊断概览</span>
      <!-- 置信度进度条 -->
      <div class="ml-auto flex items-center gap-2">
        <span class="font-mono text-xs text-muted-foreground">{{ diagConfidencePct }}%</span>
        <div class="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
          <div
            class="h-full rounded-full bg-emerald-500 transition-all duration-500"
            :style="{ width: diagConfidencePct + '%' }"
          ></div>
        </div>
      </div>
    </div>

    <div v-if="diagRootCause">
      <p class="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <TargetIcon weight="duotone" class="h-3.5 w-3.5" />
        核心根因
      </p>
      <p class="text-sm text-foreground">{{ diagRootCause }}</p>
    </div>

    <div v-if="diagTroubleshooting.length > 0">
      <p class="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ListChecksIcon weight="duotone" class="h-3.5 w-3.5" />
        排障步骤
      </p>
      <ol class="list-decimal list-inside space-y-1">
        <li v-for="(step, idx) in diagTroubleshooting" :key="idx" class="text-sm text-foreground">
          {{ step }}
        </li>
      </ol>
    </div>

    <div v-if="diagEvidence.length > 0">
      <p class="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <LinkSimpleIcon weight="duotone" class="h-3.5 w-3.5" />
        证据链
      </p>
      <div class="flex flex-wrap gap-1.5">
        <span
          v-for="(ev, idx) in diagEvidence"
          :key="idx"
          class="rounded-md border border-border/60 bg-background/60 px-2 py-0.5 font-mono text-xs text-muted-foreground"
        >
          {{ ev }}
        </span>
      </div>
    </div>

    <!-- 原始 JSON 元数据折叠 -->
    <div v-if="diagRawJson" class="pt-1">
      <button
        class="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        :aria-expanded="showRawJson"
        @click="showRawJson = !showRawJson"
      >
        <CodeIcon weight="duotone" class="h-3.5 w-3.5" />
        {{ showRawJson ? '收起原始数据' : '查看原始数据' }}
      </button>
      <pre
        v-if="showRawJson"
        class="mt-2 overflow-x-auto rounded-md bg-muted p-2.5 font-mono text-xs text-muted-foreground"
      >{{ diagRawJson }}</pre>
    </div>
  </div>
</template>
