<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppButton from '@/components/ui/AppButton.vue'
import DotBackground from '@/components/ui/DotBackground.vue'
import AiResultPanel from '@/components/ui/AiResultPanel.vue'
import { toast } from '@/lib/toast'
import {
  submitLog,
  aiAnalyzeContent,
  aiAnalyzeStored,
  getLimits,
  parseDiagnosis,
  type AIMode,
  type ServerLimits,
  type AIAnalysisStatus,
  type AIDiagnosis,
  describeApiError
} from '@/lib/api'
import { openFileDialog, addHistory, type HistoryEntry } from '@/lib/electron'
import { incomingFiles, consumeIncomingFiles } from '@/lib/file-association'
import { shareLink, copyToClipboard } from '@/lib/share'
import type { LogshareFileResult } from '@/types/logshare-api'
import {
  PhUploadSimple as UploadIcon,
  PhFileText as FileTextIcon,
  PhPaperclip as PaperclipIcon,
  PhPaperPlaneTilt as SendIcon,
  PhRobot as RobotIcon,
  PhSpinnerGap as SpinnerIcon,
  PhCopy as CopyIcon,
  PhCheck as CheckIcon,
  PhX as XIcon,
  PhLightning as QuickIcon,
  PhMagnifyingGlass as DeepIcon,
  PhRocketLaunch as LauncherIcon,
  PhTrash as TrashIcon,
  PhShareNetwork as ShareIcon
} from '@phosphor-icons/vue'

const router = useRouter()

// 常量
const SOURCE = 'logshare-app/1.0.0'
const MAX_FILE_SIZE = 10 * 1024 * 1024

// 状态
const logContent = ref('')
const selectedFiles = ref<Array<{ name: string; content: string; size: number }>>([])
const isDragging = ref(false)
const isSubmitting = ref(false)

// AI 分析取消控制器
let aiController: AbortController | null = null

// 上传结果
const uploadResult = ref<{
  id: string
  url: string
  token: string
} | null>(null)
const copied = ref(false)

// AI 分析
const aiMode = ref<AIMode>('deep')
const aiRunning = ref(false)
const aiContent = ref('')
const aiStatus = ref('')
const aiStatusList = ref<AIAnalysisStatus[]>([])
const aiError = ref('')
const aiDone = ref(false)
const diagnosis = ref<AIDiagnosis | null>(null)

// 限制信息
const limits = ref<ServerLimits | null>(null)
const maxFileSize = computed(() => limits.value?.maxLength || MAX_FILE_SIZE)

const hasContent = computed(() => logContent.value.trim().length > 0 || selectedFiles.value.length > 0)
const canSubmit = computed(() => hasContent.value && !isSubmitting.value)

// 文件输入引用
const fileInput = ref<HTMLInputElement | null>(null)

// 拖拽处理
const onDragOver = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = true
}
const onDragLeave = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
}
const onDrop = async (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return
  await handleFiles(files)
}

// 处理文件
async function handleFiles(files: FileList | File[]) {
  for (const file of Array.from(files)) {
    if (file.size > maxFileSize.value) {
      toast.error(`文件 ${file.name} 超过 ${formatSize(maxFileSize.value)} 限制`)
      continue
    }
    if (file.name.endsWith('.zip')) {
      toast.warning('ZIP 压缩包请在浏览器版本中使用，桌面端暂不支持 ZIP 直接上传')
      continue
    }
    const content = await file.text()
    selectedFiles.value.push({
      name: file.name,
      content,
      size: file.size
    })
  }
}

// 把一个桌面端文件结果加入待上传列表（文件对话框与文件关联共用）
function addFileResult(file: LogshareFileResult) {
  if (file.isZip) {
    toast.warning('ZIP 压缩包暂不支持直接上传')
    return
  }
  if (file.size > maxFileSize.value) {
    toast.error(`文件 ${file.name} 超过 ${formatSize(maxFileSize.value)} 限制`)
    return
  }
  selectedFiles.value.push({
    name: file.name,
    content: file.content ?? '',
    size: file.size
  })
}

// Electron 文件选择
async function selectFileViaDialog() {
  const result = await openFileDialog()
  if (!result || result.length === 0) {
    // 降级到 input
    fileInput.value?.click()
    return
  }
  result.forEach(addFileResult)
}

// 文件关联（双击 .log / .logs）推送进来的文件
function drainIncomingFiles() {
  const files = consumeIncomingFiles()
  if (files.length === 0) return

  files.forEach(addFileResult)

  const first = files[0]
  toast.success(
    files.length === 1 && first ? `已载入 ${first.name}` : `已载入 ${files.length} 个日志文件`
  )
}

// Web 文件选择
function onFileInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    handleFiles(input.files)
    input.value = ''
  }
}

// 移除文件
function removeFile(idx: number) {
  selectedFiles.value.splice(idx, 1)
}

// 清空
function clearAll() {
  // 中止在途的 AI 流，避免残留回调继续写入已清空的状态
  stopAI()
  logContent.value = ''
  selectedFiles.value = []
  uploadResult.value = null
  aiContent.value = ''
  aiStatus.value = ''
  aiStatusList.value = []
  aiError.value = ''
  aiDone.value = false
  diagnosis.value = null
  copied.value = false
}

// 提交日志
async function submitLogAction() {
  if (!canSubmit.value) return
  isSubmitting.value = true
  uploadResult.value = null
  aiContent.value = ''
  aiStatus.value = ''
  aiStatusList.value = []
  aiError.value = ''
  aiDone.value = false
  diagnosis.value = null

  try {
    const files = selectedFiles.value.map(f => ({ name: f.name, content: f.content }))
    const res = await submitLog({
      content: logContent.value || undefined,
      files: files.length > 0 ? files : undefined,
      source: SOURCE
    })

    if (!res.success) {
      toast.error(res.message || '提交失败')
      return
    }

    uploadResult.value = {
      id: res.id,
      url: res.url,
      token: res.token
    }
    toast.success('日志上传成功，分享链接已生成')

    // 保存到历史记录
    const entry: HistoryEntry = {
      id: res.id,
      url: res.url,
      token: res.token,
      source: SOURCE,
      fileName: selectedFiles.value.length > 0 ? (selectedFiles.value[0]?.name || 'pasted-log.txt') : 'pasted-log.txt',
      size: logContent.value.length + selectedFiles.value.reduce((sum, f) => sum + f.size, 0),
      lines: logContent.value.split('\n').length,
      createdAt: Date.now()
    }
    await addHistory(entry)
  } catch (err) {
    toast.error(describeApiError(err))
  } finally {
    isSubmitting.value = false
  }
}

// 复制链接
async function copyLink() {
  if (!uploadResult.value) return
  const ok = await copyToClipboard(uploadResult.value.url)
  if (!ok) {
    toast.error('复制失败，请手动选择链接')
    return
  }
  copied.value = true
  toast.success('链接已复制到剪贴板')
  setTimeout(() => { copied.value = false }, 2000)
}

// 分享链接：移动端调起系统分享面板，不支持时自动回落剪贴板
async function shareLinkAction() {
  if (!uploadResult.value) return
  const res = await shareLink(uploadResult.value.url, 'LogShare 日志分享')

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

// AI 分析
async function startAIAnalysis() {
  if (!uploadResult.value && !hasContent.value) return

  aiRunning.value = true
  aiContent.value = ''
  aiStatus.value = ''
  aiStatusList.value = []
  aiError.value = ''
  aiDone.value = false
  diagnosis.value = null

  aiController = new AbortController()
  const signal = aiController.signal

  const callbacks = {
    onContent: (text: string) => {
      aiContent.value += text
    },
    onStatus: (status: AIAnalysisStatus) => {
      // 只管累积；展示时的条数上限由 AiResultPanel 统一截断
      aiStatusList.value.push(status)
      if (status.type === 'queued') {
        aiStatus.value = `排队中（位置 ${status.position}）`
      } else if (status.type === 'thinking') {
        aiStatus.value = '正在思考...'
      } else if (status.type === 'tool') {
        aiStatus.value = `调用工具：${status.name}`
      } else if (status.type === 'tool_result') {
        aiStatus.value = `工具返回：${status.name}`
      } else if (status.type === 'limit') {
        aiStatus.value = `达到轮次上限（${status.rounds} 轮）`
      }
    },
    onError: (error: string) => {
      aiError.value = error
      toast.error('AI 分析失败：' + error)
    },
    onDone: () => {
      aiDone.value = true
      diagnosis.value = parseDiagnosis(aiContent.value)
      toast.success('AI 分析完成')
    }
  }

  try {
    if (uploadResult.value) {
      // 分析已存储的日志
      await aiAnalyzeStored(uploadResult.value.id, aiMode.value, callbacks, signal)
    } else {
      // 直接分析内容
      await aiAnalyzeContent({
        content: logContent.value,
        mode: aiMode.value
      }, callbacks, signal)
    }
  } catch (err) {
    if (signal.aborted) return
    const msg = describeApiError(err)
    aiError.value = msg
    toast.error(msg)
  } finally {
    aiRunning.value = false
    aiController = null
  }
}

// 中止在途的 AI 流（面板「停止」按钮与 clearAll 共用）
function stopAI() {
  aiController?.abort()
  aiController = null
  aiRunning.value = false
}

// 跳转到日志详情页
function goToLogDetail() {
  if (uploadResult.value) {
    router.push(`/log/${uploadResult.value.id}`)
  }
}

// 格式化文件大小
function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

// 模式选项
const modeOptions = [
  { value: 'deep' as AIMode, label: '深度排障', icon: DeepIcon, desc: '全工具链深度分析' },
  { value: 'launcher' as AIMode, label: '启动器优先', icon: LauncherIcon, desc: '启动器崩溃优先匹配' },
  { value: 'quick' as AIMode, label: '极速直答', icon: QuickIcon, desc: '单轮快速回答' }
]

onMounted(async () => {
  try {
    limits.value = await getLimits()
  } catch { /* ignore */ }
  // 先拿到服务端限制再载入关联文件，避免用默认上限误判「文件过大」
  drainIncomingFiles()
})

// 应用已运行时双击关联文件，直接在首页载入。
// 注意：必须 deep 监听 —— ref([]) 的 push 不改变 .value 的引用，
// 非 deep 的 watch 不会触发（实测触发 0 次）。drain 内部对空队列会提前返回，
// 因此监听自身 splice 清空产生的再次触发是安全的，不会循环。
watch(incomingFiles, () => drainIncomingFiles(), { deep: true })
</script>

<template>
  <div class="flex flex-col h-[calc(100dvh-3.5rem)]">
    <!-- 主操作区 -->
    <div class="flex-1 flex flex-col min-h-0 relative" @dragover="onDragOver" @dragleave="onDragLeave" @drop="onDrop">
      <!-- 拖拽遮罩 -->
      <div
        v-if="isDragging"
        class="absolute inset-0 z-20 bg-primary/5 border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none"
      >
        <div class="text-center">
          <UploadIcon weight="duotone" class="h-12 w-12 mx-auto text-primary mb-2" />
          <p class="text-lg font-medium text-primary">释放以上传文件</p>
        </div>
      </div>

      <!-- 文件列表区（如果有文件） -->
      <div v-if="selectedFiles.length > 0" class="px-4 pt-3 pb-2 border-b border-border/40 space-y-2">
        <div
          v-for="(file, idx) in selectedFiles"
          :key="idx"
          class="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2"
        >
          <FileTextIcon weight="duotone" class="h-4 w-4 text-muted-foreground shrink-0" />
          <span class="text-sm font-medium flex-1 truncate">{{ file.name }}</span>
          <span class="text-xs text-muted-foreground font-mono shrink-0">{{ formatSize(file.size) }}</span>
          <button
            class="text-muted-foreground hover:text-destructive active:text-destructive flex h-9 w-9 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded transition-colors"
            aria-label="移除文件"
            @click="removeFile(idx)"
          >
            <XIcon weight="duotone" class="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          </button>
        </div>
      </div>

      <!-- 文本输入区 -->
      <!-- min-h：小屏下底部操作栏占位较多，保证输入框不被压扁到不可用 -->
      <textarea
        v-model="logContent"
        class="flex-1 w-full min-h-[7rem] p-4 bg-background text-foreground font-mono text-sm resize-none focus:outline-none placeholder:text-muted-foreground/50"
        placeholder="在此粘贴日志内容..."
        :disabled="isSubmitting"
      ></textarea>

      <!-- 空状态提示（无内容时居中显示）——布局对齐线上网页版：大图标 + 居中主操作 -->
      <div
        v-if="!hasContent && !isSubmitting"
        class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6"
      >
        <!-- 点阵底噪：只在空状态出现，有内容时让位给日志文本 -->
        <DotBackground :gap="24" :radius="1.2" :opacity="0.28" />

        <div class="text-center">
          <div class="flex items-center justify-center gap-4 mb-4">
            <FileTextIcon weight="duotone" class="h-14 w-14 sm:h-16 sm:w-16 opacity-50 text-muted-foreground" />
            <PaperclipIcon weight="duotone" class="h-14 w-14 sm:h-16 sm:w-16 opacity-50 text-muted-foreground" />
            <RobotIcon weight="duotone" class="h-14 w-14 sm:h-16 sm:w-16 opacity-50 text-muted-foreground" />
          </div>
          <!-- 触摸设备没有"拖拽"，文案分开写，避免给出无法执行的操作指引 -->
          <p class="text-base text-muted-foreground hidden sm:block">拖拽文件到此处上传，或直接粘贴日志内容</p>
          <p class="text-base text-muted-foreground sm:hidden">粘贴日志内容，或选择文件上传</p>
          <p class="text-sm mt-1 text-muted-foreground">
            支持 .txt / .log / .logs / .yml / .json 等文本文件
            <span v-if="limits"> · 最大 {{ formatSize(limits.maxLength) }} / {{ limits.maxLines.toLocaleString() }} 行</span>
          </p>

          <!-- 居中主操作：空状态下直接给出入口，无需先低头找底部操作区 -->
          <div class="pointer-events-auto mt-6 flex items-center justify-center gap-4">
            <AppButton size="lg" @click="selectFileViaDialog">
              <UploadIcon weight="duotone" class="h-4 w-4" />
              选择文件
            </AppButton>
            <AppButton size="lg" variant="secondary" disabled>
              <SendIcon weight="duotone" class="h-4 w-4" />
              保存日志
            </AppButton>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部操作区 -->
    <!-- 视觉对齐线上网页版：圆角毛玻璃卡片浮于页面上方，而非贴边的实心工具栏。
         左右留白 + 圆角 + 阴影让它与编辑器形成层次，底部手势条留白由 pb-safe-3 负责 -->
    <!-- 空状态下退为透明（只留模式选择器本身），有内容时才浮成毛玻璃卡片 ——
         对齐线上版底部的克制感：没有待上传内容时不摆一个空的工具栏 -->
    <div
      class="mx-auto mb-3 w-[calc(100%-1.5rem)] max-w-2xl space-y-2.5 rounded-3xl px-3 pt-2.5 pb-safe-3 transition-all duration-300 sm:space-y-3 sm:px-3.5 sm:pt-3"
      :class="
        hasContent || uploadResult || isSubmitting
          ? 'bg-card/80 shadow-lg backdrop-blur-xl'
          : 'bg-transparent shadow-none'
      "
    >
      <!-- 隐藏的文件输入 -->
      <input
        ref="fileInput"
        type="file"
        class="hidden"
        accept=".txt,.log,.logs,.yml,.yaml,.json,.xml,.cfg,.conf,.properties,.toml"
        multiple
        @change="onFileInputChange"
      />

      <!-- 上传结果 -->
      <div v-if="uploadResult" class="space-y-2">
        <div class="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 min-w-0">
          <CheckIcon weight="duotone" class="h-4 w-4 text-emerald-500 shrink-0" />
          <span class="text-sm text-emerald-700 dark:text-emerald-400 font-mono truncate flex-1 min-w-0">{{ uploadResult.url }}</span>
        </div>
        <div class="flex items-center gap-2">
          <!-- 移动端优先调起系统分享面板，桌面端自动回落剪贴板 -->
          <AppButton class="flex-1 sm:flex-none touch-h" size="sm" variant="soft" @click="shareLinkAction">
            <ShareIcon weight="duotone" class="h-3.5 w-3.5" />
            分享
          </AppButton>
          <AppButton class="flex-1 sm:flex-none touch-h" size="sm" variant="outline" @click="copyLink">
            <component :is="copied ? CheckIcon : CopyIcon" weight="duotone" class="h-3.5 w-3.5" />
            {{ copied ? '已复制' : '复制链接' }}
          </AppButton>
          <AppButton class="flex-1 sm:flex-none touch-h" size="sm" variant="outline" @click="goToLogDetail">
            详情
          </AppButton>
        </div>
      </div>

      <!-- 模式选择 + 操作按钮 -->
      <!-- 移动端纵向分成「模式 / 入口 / 主操作」三行，各自好按；
           桌面端用 sm:contents 把两个操作组「拆包」，回到原来的单行紧凑排布 -->
      <div class="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
        <!-- AI 模式选择器 -->
        <!-- 小屏改成三栏等宽并保留文字标签：纯图标在手机上很难分辨三种模式 -->
        <div class="grid grid-cols-3 gap-1 sm:flex sm:w-fit sm:items-center rounded-lg border border-border/60 bg-background/60 p-0.5">
          <button
            v-for="mode in modeOptions"
            :key="mode.value"
            class="touch-h flex items-center justify-center gap-1.5 rounded-md px-1.5 py-2 sm:min-h-0 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-medium transition-colors"
            :class="aiMode === mode.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'"
            :title="mode.desc"
            @click="aiMode = mode.value"
          >
            <component :is="mode.icon" weight="duotone" class="h-3.5 w-3.5 shrink-0" />
            <span class="truncate">{{ mode.label }}</span>
          </button>
        </div>

        <!-- 桌面端把后面的按钮推到右侧 -->
        <div class="hidden sm:block sm:flex-1" />

        <!-- 入口类操作（空状态下隐藏：中间已给出同一主入口，避免一句话出现两个按钮） -->
        <div v-if="hasContent || uploadResult || isSubmitting" class="flex items-center gap-2 sm:contents">
          <AppButton
            v-if="hasContent || uploadResult"
            size="sm"
            variant="ghost"
            class="touch-target shrink-0"
            @click="clearAll"
          >
            <TrashIcon weight="duotone" class="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            <span>清空</span>
          </AppButton>

          <AppButton size="sm" variant="outline" class="flex-1 sm:flex-none touch-h" @click="selectFileViaDialog">
            <UploadIcon weight="duotone" class="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            选择文件
          </AppButton>
        </div>

        <!-- 执行类操作：两个主操作各占一半，小屏也好按；空状态下同样隐藏 -->
        <div v-if="hasContent || uploadResult || isSubmitting" class="flex items-center gap-2 sm:contents">
          <AppButton
            size="sm"
            :disabled="!canSubmit"
            :class="canSubmit && !isSubmitting ? 'animate-pulse-save' : ''"
            class="flex-1 sm:flex-none touch-h"
            @click="submitLogAction"
          >
            <component :is="isSubmitting ? SpinnerIcon : SendIcon" weight="duotone" :class="isSubmitting ? 'animate-spin' : ''" class="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            <span class="truncate">{{ isSubmitting ? '上传中...' : '保存日志' }}</span>
          </AppButton>

          <AppButton
            v-if="uploadResult || hasContent"
            size="sm"
            variant="soft"
            :disabled="aiRunning"
            class="flex-1 sm:flex-none touch-h"
            @click="startAIAnalysis"
          >
            <component :is="aiRunning ? SpinnerIcon : RobotIcon" weight="duotone" :class="aiRunning ? 'animate-spin' : ''" class="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            <span class="truncate">{{ aiRunning ? '分析中...' : 'AI 分析' }}</span>
          </AppButton>
        </div>
      </div>
    </div>

    <!-- AI 分析结果面板：与日志详情页共用同一套渲染，避免两处样式各自跑偏 -->
    <AiResultPanel
      variant="panel"
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
</template>

<style scoped>
/* 主操作脉冲光环（对齐线上网页版）：内容就绪时提示「可以保存了」。
   缓入缓出 2s 循环，光环从按钮边缘扩散到透明，不改变按钮本身尺寸。
   类落在 AppButton 根元素上——子组件根节点会继承父组件的 scopeId，因此 scoped 可命中。 */
@keyframes pulse-save {
  0%,
  100% {
    box-shadow: 0 0 0 0 hsl(var(--primary) / 0.45);
  }
  50% {
    box-shadow: 0 0 0 12px hsl(var(--primary) / 0);
  }
}

.animate-pulse-save {
  animation: pulse-save 2s ease-in-out infinite;
}

/* 尊重系统的「减弱动态效果」偏好 */
@media (prefers-reduced-motion: reduce) {
  .animate-pulse-save {
    animation: none;
  }
}
</style>
