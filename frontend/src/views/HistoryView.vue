<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppButton from '@/components/ui/AppButton.vue'
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { toast } from '@/lib/toast'
import { getHistory, clearHistory, removeHistory, type HistoryEntry } from '@/lib/electron'
import { deleteLog } from '@/lib/api'
import {
  PhClockCounterClockwise as ClockIcon,
  PhTrash as TrashIcon,
  PhArrowRight as ArrowRightIcon,
  PhFileText as FileTextIcon,
  PhX as XIcon
} from '@phosphor-icons/vue'

const router = useRouter()
const history = ref<HistoryEntry[]>([])
const loading = ref(true)

// 确认弹窗状态：原生 confirm 在 WebView 里不跟随主题，也无法表达「正在删除」
const clearDialogOpen = ref(false)
const clearing = ref(false)
const deleteTarget = ref<HistoryEntry | null>(null)
const deleting = ref(false)

async function loadHistory() {
  loading.value = true
  try {
    history.value = await getHistory()
  } catch (err: any) {
    toast.error('加载历史记录失败：' + err.message)
  } finally {
    loading.value = false
  }
}

// 清空：弹窗确认后才真正执行
async function confirmClear() {
  clearing.value = true
  try {
    // 并行尝试删除服务端日志；无论远端结果如何，本地历史都应清空
    const results = await Promise.allSettled(
      history.value.map(entry => deleteLog(entry.id, entry.token))
    )
    const failed = results.filter(
      r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value?.success === false)
    ).length

    await clearHistory()
    history.value = []
    clearDialogOpen.value = false

    if (failed > 0) {
      toast.warning(`本地记录已清空，但有 ${failed} 条服务端日志删除失败`)
    } else {
      toast.success('历史记录已清空')
    }
  } catch (err: any) {
    toast.error('清空失败：' + err.message)
  } finally {
    clearing.value = false
  }
}

function requestRemove(entry: HistoryEntry) {
  deleteTarget.value = entry
}

async function confirmRemove() {
  const entry = deleteTarget.value
  if (!entry) return

  deleting.value = true
  try {
    await deleteLog(entry.id, entry.token)
    await removeHistory(entry.id)
    history.value = history.value.filter(h => h.id !== entry.id)
    deleteTarget.value = null
    toast.success('日志已删除')
  } catch (err: any) {
    toast.error('删除失败：' + err.message)
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
  return new Date(ts).toLocaleString('zh-CN')
}

onMounted(loadHistory)
</script>

<template>
  <div class="container mx-auto max-w-4xl px-4 sm:px-6 py-6 space-y-4">
    <div class="flex items-center gap-3">
      <ClockIcon weight="duotone" class="h-6 w-6 text-primary" />
      <h1 class="text-xl font-bold">历史记录</h1>
      <Badge variant="secondary">{{ history.length }} 条</Badge>
      <div class="flex-1" />
      <AppButton
        v-if="history.length > 0"
        size="sm"
        variant="soft-destructive"
        class="touch-h"
        @click="clearDialogOpen = true"
      >
        <TrashIcon weight="duotone" class="h-3.5 w-3.5" />
        清空全部
      </AppButton>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
    </div>

    <Card v-else-if="history.length === 0" padded class="text-center py-16">
      <FileTextIcon weight="duotone" class="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
      <p class="text-sm text-muted-foreground">暂无历史记录</p>
      <p class="text-xs text-muted-foreground/70 mt-1">上传日志后会自动记录到此处</p>
      <AppButton class="mt-4 touch-h" size="sm" @click="router.push('/')">前往上传</AppButton>
    </Card>

    <div v-else class="space-y-2">
      <Card
        v-for="entry in history"
        :key="entry.id"
        hoverable
        padded
        class="cursor-pointer"
        @click="router.push(`/log/${entry.id}`)"
      >
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
            <FileTextIcon weight="duotone" class="h-4 w-4" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <p class="text-sm font-bold font-mono truncate">{{ entry.id }}</p>
              <Badge variant="outline" class="shrink-0">{{ formatSize(entry.size) }}</Badge>
            </div>
            <p class="text-xs text-muted-foreground truncate mt-0.5">
              {{ entry.fileName }} · {{ formatTime(entry.createdAt) }}
            </p>
          </div>
          <!-- 44px 触摸下限由 .touch-target 保证（仅在触摸设备 / 窄屏生效） -->
          <button
            class="flex h-9 w-9 shrink-0 touch-target items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive active:text-destructive"
            aria-label="删除"
            @click.stop="requestRemove(entry)"
          >
            <XIcon weight="duotone" class="h-4 w-4" />
          </button>
          <ArrowRightIcon weight="duotone" class="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      </Card>
    </div>

    <!-- 清空确认 -->
    <ConfirmDialog
      :open="clearDialogOpen"
      title="清空所有历史记录？"
      :description="`将同时尝试删除 ${history.length} 条服务端日志，本地记录无论如何都会被清空。`"
      confirm-text="清空"
      danger
      :busy="clearing"
      @confirm="confirmClear"
      @close="clearDialogOpen = false"
    />

    <!-- 单条删除确认：标题带上日志 ID，避免误删相邻条目 -->
    <ConfirmDialog
      :open="deleteTarget !== null"
      :title="deleteTarget ? `删除日志 ${deleteTarget.id}？` : ''"
      description="分享链接将立即失效，此操作不可撤销。"
      confirm-text="删除"
      danger
      :busy="deleting"
      @confirm="confirmRemove"
      @close="deleteTarget = null"
    />
  </div>
</template>
