<script setup lang="ts">
/**
 * 日志查看器 —— 对齐网页版 LogShare-Web-UI 的日志查看体验
 *
 * 功能：行号、错误/警告行高亮、Minecraft § 颜色码、仅错误过滤、自动换行切换、
 * 字体大小调节、搜索（Ctrl+F 计数 + 上下导航 + mark 高亮）、全屏、回顶。
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import AppButton from '@/components/ui/AppButton.vue'
import { parseLogLines, renderLine, type LogLevel } from '@/lib/logParser'
import { getLogFontSize, getLogWrap, getLogErrorsOnly, FONT_SIZE_MIN, FONT_SIZE_MAX } from '@/lib/settings'
import {
  PhWarning as WarningIcon,
  PhRobot as RobotIcon,
  PhMagnifyingGlass as SearchIcon,
  PhCaretUp as UpIcon,
  PhCaretDown as DownIcon,
  PhArrowsOut as FullscreenIcon,
  PhArrowsIn as ExitFullscreenIcon,
  PhArrowUp as BackTopIcon,
  PhMinus as MinusIcon,
  PhPlus as PlusIcon,
  PhTextT as WrapIcon
} from '@phosphor-icons/vue'

const props = withDefaults(
  defineProps<{
    raw: string
    loading?: boolean
    /** 可选：是否允许 AI 分析按钮 */
    canAnalyze?: boolean
  }>(),
  { loading: false, canAnalyze: true }
)

const emit = defineEmits<{
  analyze: []
  download: []
  delete: []
}>()

// —— 视图状态（初始值来自「设置」页，见 lib/settings.ts） ——
const showErrorsOnly = ref(getLogErrorsOnly())
const wrapLines = ref(getLogWrap())
const fontSize = ref(getLogFontSize())
const isFullscreen = ref(false)
const search = ref('')
const currentMatchIndex = ref(0)
const scrollEl = ref<HTMLElement | null>(null)
const showBackTop = ref(false)

const lines = computed(() => parseLogLines(props.raw))

// 渲染后的行（含 § 颜色码 + 搜索 mark 高亮），搜索变化时全量重算
const renderedLines = computed(() =>
  lines.value.map((l) => ({ n: l.n, level: l.level, html: renderLine(l.text, search.value) }))
)

// 搜索匹配的行号列表（大小写不敏感）
const searchMatches = computed(() => {
  const q = search.value.trim()
  if (!q) return []
  const re = new RegExp(escapeRegExp(q), 'i')
  return lines.value.filter((l) => re.test(l.text)).map((l) => l.n)
})

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function rowClass(level: LogLevel): string {
  if (level === 'error' || level === 'fatal') return 'bg-error-group'
  if (level === 'warning') return 'bg-warning-group'
  return 'entry-no-error'
}

// —— 搜索导航 ——
function jumpToMatch(index: number) {
  const total = searchMatches.value.length
  if (total === 0) return
  const idx = ((index % total) + total) % total
  currentMatchIndex.value = idx
  const lineNo = searchMatches.value[idx]
  document.getElementById(`L${lineNo}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}
function nextMatch() { jumpToMatch(currentMatchIndex.value + 1) }
function prevMatch() { jumpToMatch(currentMatchIndex.value - 1) }

// Ctrl+F 聚焦搜索框
function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault()
    document.getElementById('log-search-input')?.focus()
  }
}

// 回顶按钮显示 + 滚动监听
function onScroll() {
  showBackTop.value = (scrollEl.value?.scrollTop ?? 0) > 600
}
function scrollToTop() {
  scrollEl.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
}

function adjustFont(delta: number) {
  fontSize.value = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, fontSize.value + delta))
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div
    class="log-viewer flex flex-col overflow-hidden rounded-lg border border-[var(--log-border)] bg-[var(--log-bg)]"
    :class="isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''"
    :style="isFullscreen ? 'height: 100dvh' : 'height: 100%'"
  >
    <!-- 工具栏 -->
    <div class="flex flex-wrap items-center gap-1.5 border-b border-[var(--log-border)] px-2 py-1.5">
      <AppButton
        size="sm"
        :variant="showErrorsOnly ? 'soft-destructive' : 'ghost'"
        class="touch-h"
        @click="showErrorsOnly = !showErrorsOnly"
      >
        <WarningIcon weight="duotone" class="h-3.5 w-3.5" />
        {{ showErrorsOnly ? '显示全部' : '仅错误' }}
      </AppButton>
      <AppButton
        size="sm"
        :variant="wrapLines ? 'soft' : 'ghost'"
        class="touch-h"
        title="自动换行"
        @click="wrapLines = !wrapLines"
      >
        <WrapIcon weight="duotone" class="h-3.5 w-3.5" />
        换行
      </AppButton>
      <AppButton v-if="canAnalyze" size="sm" variant="soft" class="touch-h" @click="emit('analyze')">
        <RobotIcon weight="duotone" class="h-3.5 w-3.5" />
        AI 分析
      </AppButton>

      <div class="flex-1" />

      <!-- 字体大小控制 -->
      <div class="flex items-center gap-0.5 rounded-md border border-border/60 bg-background/60 px-0.5 py-0.5">
        <button class="touch-target flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground" aria-label="减小字号" @click="adjustFont(-1)">
          <MinusIcon weight="duotone" class="h-3.5 w-3.5" />
        </button>
        <span class="min-w-[2.5rem] text-center text-xs font-mono text-muted-foreground">{{ fontSize }}px</span>
        <button class="touch-target flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground" aria-label="增大字号" @click="adjustFont(1)">
          <PlusIcon weight="duotone" class="h-3.5 w-3.5" />
        </button>
      </div>

      <AppButton size="sm" variant="ghost" class="touch-h" @click="emit('download')">下载</AppButton>
      <AppButton size="sm" variant="ghost" class="touch-h" @click="emit('delete')">删除</AppButton>
      <AppButton size="sm" variant="ghost" class="touch-h" @click="toggleFullscreen">
        <component :is="isFullscreen ? ExitFullscreenIcon : FullscreenIcon" weight="duotone" class="h-3.5 w-3.5" />
        {{ isFullscreen ? '退出' : '全屏' }}
      </AppButton>
    </div>

    <!-- 搜索栏 -->
    <div class="flex items-center gap-2 border-b border-[var(--log-border)] px-2 py-1.5">
      <SearchIcon weight="duotone" class="h-4 w-4 shrink-0 text-muted-foreground" />
      <input
        id="log-search-input"
        v-model="search"
        class="h-7 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
        placeholder="搜索日志（Ctrl+F）"
        type="text"
      />
      <span v-if="searchMatches.length > 0" class="font-mono text-xs text-muted-foreground">
        {{ currentMatchIndex + 1 }} / {{ searchMatches.length }}
      </span>
      <button class="touch-target flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30" :disabled="searchMatches.length === 0" aria-label="上一个匹配" @click="prevMatch">
        <UpIcon weight="duotone" class="h-4 w-4" />
      </button>
      <button class="touch-target flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30" :disabled="searchMatches.length === 0" aria-label="下一个匹配" @click="nextMatch">
        <DownIcon weight="duotone" class="h-4 w-4" />
      </button>
    </div>

    <!-- 日志内容 -->
    <div ref="scrollEl" class="min-h-0 flex-1 overflow-auto" @scroll="onScroll">
      <div v-if="loading" class="flex items-center justify-center py-16 text-sm text-muted-foreground">加载日志中...</div>
      <table
        v-else
        class="log-table"
        :class="[showErrorsOnly ? 'show-errors-only' : '', wrapLines ? '' : 'log-no-wrap']"
      >
        <tbody>
          <tr
            v-for="line in renderedLines"
            :id="'L' + line.n"
            :key="line.n"
            class="log-row"
            :class="rowClass(line.level)"
          >
            <td class="line-num">{{ line.n }}</td>
            <td class="log-content" :style="{ fontSize: fontSize + 'px' }" v-html="line.html"></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 回顶 -->
    <button
      v-if="showBackTop"
      class="touch-target fixed bottom-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/90 text-muted-foreground shadow-lg backdrop-blur hover:text-foreground"
      aria-label="回到顶部"
      @click="scrollToTop"
    >
      <BackTopIcon weight="duotone" class="h-4 w-4" />
    </button>
  </div>
</template>
