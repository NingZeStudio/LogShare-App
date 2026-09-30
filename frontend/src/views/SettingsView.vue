<script setup lang="ts">
/**
 * 设置页
 *
 * 各设置项持久化到 localStorage（见 lib/settings.ts），并被对应功能读取生效：
 * - 显示模式 → 全局主题（顶栏 ThemeToggle 共用同一份状态）
 * - 日志字体大小 / 自动换行 / 仅显示错误 → LogViewer 的初始值
 * - 默认 AI 模式 → 详情页与独立 AI 页的默认选中
 */
import { ref, computed, onMounted, type Component } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import Card from '@/components/ui/Card.vue'
import AppButton from '@/components/ui/AppButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { toast } from '@/lib/toast'
import { siteConfig } from '@/lib/config'
import { clearHistory, getHistory } from '@/lib/electron'
import {
  displayMode,
  setDisplayMode,
  getLogFontSize,
  setLogFontSize,
  getLogWrap,
  setLogWrap,
  getLogErrorsOnly,
  setLogErrorsOnly,
  getAiDefaultMode,
  setAiDefaultMode,
  getCustomModel,
  setCustomModel,
  getCrashWatch,
  setCrashWatch,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  type DisplayMode,
  type AiModePref,
  type CustomModelConfig,
  type CrashWatchConfig
} from '@/lib/settings'
import {
  PhSun as SunIcon,
  PhMoon as MoonIcon,
  PhMonitor as MonitorIcon,
  PhTextAa as FontIcon,
  PhTextT as WrapIcon,
  PhWarning as WarningIcon,
  PhRobot as RobotIcon,
  PhTrash as TrashIcon,
  PhArrowSquareOut as ExternalIcon,
  PhGithubLogo as GithubIcon,
  PhLightning as QuickIcon,
  PhMagnifyingGlass as DeepIcon,
  PhRocketLaunch as LauncherIcon,
  PhDatabase as DatabaseIcon,
  PhInfo as InfoIcon,
  PhFlask as FlaskIcon,
  PhCube as CubeIcon,
  PhBug as BugIcon,
  PhFolderOpen as FolderIcon,
  PhCrosshair as ScanIcon,
  PhPalette as PaletteIcon,
  PhCaretRight as CaretIcon
} from '@phosphor-icons/vue'

const APP_VERSION = '1.0.0'

const displayOptions: Array<{ mode: DisplayMode; label: string; icon: Component }> = [
  { mode: 'light', label: '浅色', icon: SunIcon },
  { mode: 'dark', label: '深色', icon: MoonIcon },
  { mode: 'system', label: '跟随系统', icon: MonitorIcon }
]

const aiModeOptions: Array<{ mode: AiModePref; label: string; icon: Component }> = [
  { mode: 'deep', label: '深度排障', icon: DeepIcon },
  { mode: 'launcher', label: '启动器优先', icon: LauncherIcon },
  { mode: 'quick', label: '极速直答', icon: QuickIcon }
]

// 日志查看器设置（改动即生效并持久化）
const logFontSize = ref(getLogFontSize())
const logWrap = ref(getLogWrap())
const logErrorsOnly = ref(getLogErrorsOnly())
const aiMode = ref<AiModePref>(getAiDefaultMode())

// 本地历史
const historyCount = ref(0)
const clearDialogOpen = ref(false)
const clearing = ref(false)

function adjustFont(delta: number) {
  logFontSize.value = setLogFontSize(logFontSize.value + delta)
}
function toggleWrap() {
  logWrap.value = !logWrap.value
  setLogWrap(logWrap.value)
}
function toggleErrorsOnly() {
  logErrorsOnly.value = !logErrorsOnly.value
  setLogErrorsOnly(logErrorsOnly.value)
}
function chooseAiMode(mode: AiModePref) {
  aiMode.value = mode
  setAiDefaultMode(mode)
}

// —— 实验性功能 ——
const router = useRouter()

// 自定义模型
const customModel = ref<CustomModelConfig>(getCustomModel())

function saveCustomModel() {
  setCustomModel(customModel.value)
  toast.success('自定义模型配置已保存')
}

/** 切换自定义模型开关（用方法而非内联多语句，避免只执行部分语句） */
function toggleCustomModel() {
  customModel.value.enabled = !customModel.value.enabled
  saveCustomModel()
}

function openKnowledge() {
  router.push('/knowledge')
}

// JVM 崩溃自动检查（仅桌面端）
const isDesktop = computed(() => !!window.logshareAPI?.isElectron)
const crashCfg = ref<CrashWatchConfig>(getCrashWatch())
const crashScanning = ref(false)
const crashFiles = ref<Array<{ name: string; path: string; size: number }>>([])

async function toggleCrashWatch() {
  const api = window.logshareAPI
  if (!api) return
  if (crashCfg.value.enabled) {
    crashCfg.value.enabled = false
    setCrashWatch(crashCfg.value)
    await api.crashWatchStop()
    toast.success('已停止崩溃监听')
    return
  }
  if (!crashCfg.value.dir) {
    toast.error('请先选择要监听的目录')
    return
  }
  crashCfg.value.enabled = true
  setCrashWatch(crashCfg.value)
  const res = await api.crashWatchStart(crashCfg.value.dir)
  if (res.ok) toast.success('已开始监听崩溃日志')
  else {
    toast.error(res.error || '启动监听失败')
    crashCfg.value.enabled = false
    setCrashWatch(crashCfg.value)
  }
}

async function pickCrashDir() {
  const api = window.logshareAPI
  if (!api) return
  const dir = await api.crashPickDir()
  if (!dir) return
  const wasEnabled = crashCfg.value.enabled
  crashCfg.value.dir = dir
  setCrashWatch(crashCfg.value)
  if (wasEnabled) await api.crashWatchStart(dir)
}

async function scanNow() {
  const api = window.logshareAPI
  if (!api || !crashCfg.value.dir) return
  crashScanning.value = true
  try {
    crashFiles.value = await api.crashScan(crashCfg.value.dir)
    if (crashFiles.value.length === 0) toast.success('未发现崩溃日志')
  } catch {
    toast.error('扫描失败')
  } finally {
    crashScanning.value = false
  }
}

function fmtCrashSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

async function refreshHistoryCount() {
  try {
    historyCount.value = (await getHistory()).length
  } catch {
    historyCount.value = 0
  }
}

async function doClearHistory() {
  clearing.value = true
  try {
    await clearHistory()
    historyCount.value = 0
    clearDialogOpen.value = false
    toast.success('本地历史记录已清除')
  } catch {
    toast.error('清除失败')
  } finally {
    clearing.value = false
  }
}

onMounted(() => {
  refreshHistoryCount()
  // 恢复崩溃监听（主进程重启后监听会丢失）
  const api = window.logshareAPI
  if (api && crashCfg.value.enabled && crashCfg.value.dir) {
    api.crashWatchStart(crashCfg.value.dir)
  }
})
</script>

<template>
  <div class="container mx-auto max-w-3xl px-4 sm:px-6 py-6 space-y-4">
    <div class="flex items-center gap-2">
      <h1 class="text-lg font-bold">设置</h1>
    </div>

    <!-- 外观 -->
    <Card padded class="space-y-3">
      <h2 class="flex items-center gap-2 text-sm font-bold">
        <SunIcon weight="duotone" class="h-4 w-4 text-primary" />
        外观
      </h2>
      <div class="flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start">
        <div class="min-w-0">
          <p class="text-sm">显示模式</p>
          <p class="text-xs text-muted-foreground">切换浅色 / 深色，或跟随系统偏好</p>
        </div>
        <div class="grid grid-cols-3 gap-1 rounded-lg border border-border/60 bg-background/60 p-0.5 shrink-0 max-sm:w-full">
          <button
            v-for="opt in displayOptions"
            :key="opt.mode"
            class="touch-h flex items-center justify-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
            :class="displayMode === opt.mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
            @click="setDisplayMode(opt.mode)"
          >
            <component :is="opt.icon" weight="duotone" class="h-3.5 w-3.5" />
            {{ opt.label }}
          </button>
        </div>
      </div>
    </Card>

    <!-- 日志查看器 -->
    <Card padded class="space-y-4">
      <h2 class="flex items-center gap-2 text-sm font-bold">
        <FontIcon weight="duotone" class="h-4 w-4 text-primary" />
        日志查看器
      </h2>

      <!-- 默认字体大小 -->
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm">默认字体大小</p>
          <p class="text-xs text-muted-foreground">打开日志时使用的初始字号</p>
        </div>
        <div class="flex items-center gap-0.5 rounded-md border border-border/60 bg-background/60 px-0.5 py-0.5 shrink-0">
          <button
            class="touch-target flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
            :disabled="logFontSize <= FONT_SIZE_MIN"
            aria-label="减小字号"
            @click="adjustFont(-1)"
          >−</button>
          <span class="min-w-[3rem] text-center text-xs font-mono text-muted-foreground">{{ logFontSize }}px</span>
          <button
            class="touch-target flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
            :disabled="logFontSize >= FONT_SIZE_MAX"
            aria-label="增大字号"
            @click="adjustFont(1)"
          >+</button>
        </div>
      </div>

      <!-- 自动换行 -->
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="flex items-center gap-1.5 text-sm"><WrapIcon weight="duotone" class="h-3.5 w-3.5" />自动换行</p>
          <p class="text-xs text-muted-foreground">长行折行显示，关闭后横向滚动</p>
        </div>
        <button
          role="switch"
          :aria-checked="logWrap"
          class="touch-target relative h-6 w-11 shrink-0 rounded-full transition-colors"
          :class="logWrap ? 'bg-primary' : 'bg-muted'"
          @click="toggleWrap"
        >
          <span
            class="absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform"
            :class="logWrap ? 'translate-x-[22px]' : 'translate-x-0.5'"
          />
        </button>
      </div>

      <!-- 默认仅显示错误 -->
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="flex items-center gap-1.5 text-sm"><WarningIcon weight="duotone" class="h-3.5 w-3.5" />默认仅显示错误</p>
          <p class="text-xs text-muted-foreground">打开日志时默认过滤掉信息行</p>
        </div>
        <button
          role="switch"
          :aria-checked="logErrorsOnly"
          class="touch-target relative h-6 w-11 shrink-0 rounded-full transition-colors"
          :class="logErrorsOnly ? 'bg-primary' : 'bg-muted'"
          @click="toggleErrorsOnly"
        >
          <span
            class="absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform"
            :class="logErrorsOnly ? 'translate-x-[22px]' : 'translate-x-0.5'"
          />
        </button>
      </div>
    </Card>

    <!-- AI 分析 -->
    <Card padded class="space-y-3">
      <h2 class="flex items-center gap-2 text-sm font-bold">
        <RobotIcon weight="duotone" class="h-4 w-4 text-primary" />
        AI 分析
      </h2>
      <div class="flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start">
        <div class="min-w-0">
          <p class="text-sm">默认分析模式</p>
          <p class="text-xs text-muted-foreground">进入 AI 分析时默认选中的模式</p>
        </div>
        <div class="grid grid-cols-3 gap-1 rounded-lg border border-border/60 bg-background/60 p-0.5 shrink-0 max-sm:w-full">
          <button
            v-for="opt in aiModeOptions"
            :key="opt.mode"
            class="touch-h flex items-center justify-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
            :class="aiMode === opt.mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
            @click="chooseAiMode(opt.mode)"
          >
            <component :is="opt.icon" weight="duotone" class="h-3.5 w-3.5" />
            {{ opt.label }}
          </button>
        </div>
      </div>
    </Card>

    <!-- 实验性功能 -->
    <Card padded class="space-y-4">
      <h2 class="flex items-center gap-2 text-sm font-bold">
        <FlaskIcon weight="duotone" class="h-4 w-4 text-amber-500" />
        实验性功能
        <span class="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-normal text-amber-600 dark:text-amber-400">可能变动</span>
      </h2>

      <!-- 自定义模型 -->
      <div class="space-y-2">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="flex items-center gap-1.5 text-sm"><CubeIcon weight="duotone" class="h-3.5 w-3.5" />自定义模型</p>
            <p class="text-xs text-muted-foreground">配置自建的 OpenAI 兼容端点（服务端暂不支持客户端指定模型，此处为预留）</p>
          </div>
          <button
            role="switch"
            :aria-checked="customModel.enabled"
            class="touch-target relative h-6 w-11 shrink-0 rounded-full transition-colors"
            :class="customModel.enabled ? 'bg-primary' : 'bg-muted'"
            @click="toggleCustomModel"
          >
            <span class="absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform" :class="customModel.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'" />
          </button>
        </div>
        <div v-if="customModel.enabled" class="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
          <input
            v-model="customModel.baseUrl"
            class="h-9 w-full rounded-md border border-border bg-background px-3 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Base URL（如 https://api.openai.com/v1）"
            @change="saveCustomModel"
          />
          <input
            v-model="customModel.model"
            class="h-9 w-full rounded-md border border-border bg-background px-3 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="模型名（如 gpt-4o-mini）"
            @change="saveCustomModel"
          />
          <input
            v-model="customModel.apiKey"
            type="password"
            class="h-9 w-full rounded-md border border-border bg-background px-3 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="API Key（仅保存在本机）"
            @change="saveCustomModel"
          />
        </div>
      </div>

      <!-- 知识库管理 -->
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="flex items-center gap-1.5 text-sm"><DatabaseIcon weight="duotone" class="h-3.5 w-3.5" />知识库管理</p>
          <p class="text-xs text-muted-foreground">查看 / 检索知识库文档（需服务端 Admin Token）</p>
        </div>
        <AppButton size="sm" variant="outline" class="touch-h shrink-0" @click="openKnowledge">打开</AppButton>
      </div>

      <!-- JVM 崩溃自动检查（桌面端） -->
      <div v-if="isDesktop" class="space-y-2">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="flex items-center gap-1.5 text-sm"><BugIcon weight="duotone" class="h-3.5 w-3.5" />JVM 崩溃自动检查</p>
            <p class="text-xs text-muted-foreground">监听目录中出现 hs_err_pid / crash-report 日志时提醒（仅桌面端）</p>
          </div>
          <button
            role="switch"
            :aria-checked="crashCfg.enabled"
            class="touch-target relative h-6 w-11 shrink-0 rounded-full transition-colors"
            :class="crashCfg.enabled ? 'bg-primary' : 'bg-muted'"
            @click="toggleCrashWatch"
          >
            <span class="absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform" :class="crashCfg.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'" />
          </button>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="min-w-0 flex-1 truncate rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 font-mono text-xs text-muted-foreground" :title="crashCfg.dir">{{ crashCfg.dir || '未选择监听目录' }}</span>
          <AppButton size="sm" variant="ghost" class="touch-h" @click="pickCrashDir">
            <FolderIcon weight="duotone" class="h-3.5 w-3.5" />
            选择目录
          </AppButton>
          <AppButton size="sm" variant="ghost" class="touch-h" :disabled="!crashCfg.dir || crashScanning" @click="scanNow">
            <ScanIcon weight="duotone" class="h-3.5 w-3.5" :class="crashScanning ? 'animate-spin' : ''" />
            立即扫描
          </AppButton>
        </div>
        <div v-if="crashFiles.length > 0" class="space-y-1 rounded-lg border border-border/60 bg-muted/30 p-2.5">
          <p class="text-xs text-muted-foreground">发现 {{ crashFiles.length }} 个崩溃日志</p>
          <div v-for="(f, i) in crashFiles" :key="i" class="flex items-center gap-2">
            <BugIcon weight="duotone" class="h-3.5 w-3.5 shrink-0 text-rose-500" />
            <span class="min-w-0 flex-1 truncate font-mono text-xs" :title="f.path">{{ f.name }}</span>
            <span class="shrink-0 text-xs text-muted-foreground">{{ fmtCrashSize(f.size) }}</span>
          </div>
        </div>
      </div>
      <p v-else class="text-xs text-muted-foreground">JVM 崩溃自动检查仅桌面端可用</p>
    </Card>

    <!-- 数据 -->
    <Card padded class="space-y-3">
      <h2 class="flex items-center gap-2 text-sm font-bold">
        <DatabaseIcon weight="duotone" class="h-4 w-4 text-primary" />
        数据
      </h2>
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm">本地历史记录</p>
          <p class="text-xs text-muted-foreground">当前保存 {{ historyCount }} 条上传记录</p>
        </div>
        <AppButton
          size="sm"
          variant="soft-destructive"
          class="touch-h shrink-0"
          :disabled="historyCount === 0"
          @click="clearDialogOpen = true"
        >
          <TrashIcon weight="duotone" class="h-3.5 w-3.5" />
          清除
        </AppButton>
      </div>
    </Card>

    <!-- 关于 -->
    <Card padded class="space-y-3">
      <h2 class="flex items-center gap-2 text-sm font-bold">
        <InfoIcon weight="duotone" class="h-4 w-4 text-primary" />
        关于
      </h2>
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted-foreground">版本</span>
        <span class="font-mono">v{{ APP_VERSION }}</span>
      </div>
      <!-- 移动端主导航在底部（首页 / 历史 / 设置），其余页面入口统一收纳到这里 -->
      <div class="space-y-0.5">
        <RouterLink
          to="/about"
          class="touch-h flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-accent/50"
        >
          <InfoIcon weight="duotone" class="h-4 w-4 text-muted-foreground" />
          <span class="flex-1">关于 LogShare</span>
          <CaretIcon weight="duotone" class="h-3.5 w-3.5 text-muted-foreground" />
        </RouterLink>
        <RouterLink
          to="/showcase"
          class="touch-h flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-accent/50"
        >
          <PaletteIcon weight="duotone" class="h-4 w-4 text-muted-foreground" />
          <span class="flex-1">范式展台</span>
          <span class="text-xs text-muted-foreground">组件设计规范</span>
          <CaretIcon weight="duotone" class="h-3.5 w-3.5 text-muted-foreground" />
        </RouterLink>
        <a
          :href="`${siteConfig.url}/api-docs`"
          target="_blank"
          rel="noopener noreferrer"
          class="touch-h flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-accent/50"
        >
          <ExternalIcon weight="duotone" class="h-4 w-4 text-muted-foreground" />
          <span class="flex-1">API 文档</span>
          <span class="text-xs text-muted-foreground">{{ siteConfig.url }}/api-docs</span>
        </a>
        <a
          v-if="siteConfig.github"
          :href="siteConfig.github"
          target="_blank"
          rel="noopener noreferrer"
          class="touch-h flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-accent/50"
        >
          <GithubIcon weight="duotone" class="h-4 w-4 text-muted-foreground" />
          <span class="flex-1">GitHub 仓库</span>
        </a>
      </div>
    </Card>

    <!-- 清除历史确认 -->
    <ConfirmDialog
      :open="clearDialogOpen"
      title="清除本地历史记录？"
      description="将移除本机保存的上传记录，不影响已上传到服务器的日志及其分享链接。"
      confirm-text="清除"
      danger
      :busy="clearing"
      @confirm="doClearHistory"
      @close="clearDialogOpen = false"
    />
  </div>
</template>
