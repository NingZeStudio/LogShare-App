<script setup lang="ts">
/**
 * 知识库管理（实验性）
 *
 * 对接服务端 `/v1/admin/rag/*`，需要用户提供 Admin Token。
 * 提供：指标概览、主题列表、文档列表（按主题/关键词过滤）、检索调试、文档删除。
 *
 * 服务端响应结构以实际为准，这里对字段做了多候选取值，缺字段时不崩。
 */
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import Card from '@/components/ui/Card.vue'
import AppButton from '@/components/ui/AppButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { toast } from '@/lib/toast'
import { getKbAdminToken, setKbAdminToken } from '@/lib/settings'
import {
  ragStats,
  ragTopics,
  ragDocs,
  ragSearch,
  ragDocDelete,
  describeApiError
} from '@/lib/api'
import {
  PhArrowLeft as ArrowLeftIcon,
  PhDatabase as DatabaseIcon,
  PhKey as KeyIcon,
  PhMagnifyingGlass as SearchIcon,
  PhTrash as TrashIcon,
  PhArrowClockwise as RefreshIcon,
  PhFileText as FileTextIcon
} from '@phosphor-icons/vue'

const router = useRouter()

const token = ref(getKbAdminToken())
const tokenInput = ref(token.value)

const loading = ref(false)
const errorMsg = ref('')
const stats = ref<any>(null)
const topics = ref<any[]>([])
const docs = ref<any[]>([])
const docKeyword = ref('')
const docTopic = ref('')

const searchQuery = ref('')
const searchResults = ref<any[]>([])
const searching = ref(false)
const searched = ref(false)

const deleteTarget = ref<any>(null)
const deleting = ref(false)

const hasToken = computed(() => !!token.value)

/** 从多种可能的响应形状里取数组 */
function pickArray(res: any, keys: string[]): any[] {
  if (Array.isArray(res)) return res
  for (const k of keys) if (Array.isArray(res?.[k])) return res[k]
  if (Array.isArray(res?.data)) return res.data
  return []
}

/** 把 stats 顶层标量字段摊平成 key/value 列表 */
const statsGrid = computed<Array<{ k: string; v: string }>>(() => {
  const s = stats.value
  if (!s || typeof s !== 'object') return []
  const out: Array<{ k: string; v: string }> = []
  for (const [k, v] of Object.entries(s)) {
    if (v === null || typeof v === 'object') continue
    out.push({ k, v: String(v) })
  }
  return out.slice(0, 12)
})

function fmtSize(bytes: number): string {
  if (!Number.isFinite(bytes)) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

function saveToken() {
  token.value = tokenInput.value.trim()
  setKbAdminToken(token.value)
  if (token.value) {
    toast.success('Admin Token 已保存')
    loadAll()
  } else {
    toast.success('已清除 Token')
    stats.value = null
    topics.value = []
    docs.value = []
  }
}

async function loadAll() {
  if (!token.value) return
  loading.value = true
  errorMsg.value = ''
  try {
    const [s, t, d] = await Promise.allSettled([
      ragStats(token.value),
      ragTopics(token.value),
      ragDocs(token.value)
    ])
    if (s.status === 'fulfilled') stats.value = s.value
    if (t.status === 'fulfilled') topics.value = pickArray(t.value, ['topics', 'list'])
    if (d.status === 'fulfilled') docs.value = pickArray(d.value, ['docs', 'documents', 'list'])
    const allFailed = [s, t, d].every((r) => r.status === 'rejected')
    if (allFailed) {
      errorMsg.value = describeApiError((s as PromiseRejectedResult).reason)
    } else if (docs.value.length === 0 && d.status === 'rejected') {
      errorMsg.value = '文档列表加载失败：' + describeApiError((d as PromiseRejectedResult).reason)
    }
  } finally {
    loading.value = false
  }
}

async function filterDocs() {
  if (!token.value) return
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await ragDocs(token.value, {
      topic: docTopic.value || undefined,
      keyword: docKeyword.value || undefined
    })
    docs.value = pickArray(res, ['docs', 'documents', 'list'])
  } catch (err) {
    errorMsg.value = describeApiError(err)
  } finally {
    loading.value = false
  }
}

async function runSearch() {
  if (!token.value || !searchQuery.value.trim()) return
  searching.value = true
  searched.value = true
  errorMsg.value = ''
  try {
    const res = await ragSearch(token.value, searchQuery.value.trim(), 5)
    searchResults.value = pickArray(res, ['results', 'matches', 'hits', 'data'])
  } catch (err) {
    searchResults.value = []
    errorMsg.value = describeApiError(err)
  } finally {
    searching.value = false
  }
}

async function confirmDelete() {
  const target = deleteTarget.value
  if (!target || !token.value) return
  deleting.value = true
  try {
    await ragDocDelete(token.value, target.path || target.relPath || target.name)
    docs.value = docs.value.filter((d) => d !== target)
    deleteTarget.value = null
    toast.success('文档已删除')
  } catch (err) {
    toast.error('删除失败：' + describeApiError(err))
  } finally {
    deleting.value = false
  }
}

function docPath(d: any): string {
  return d?.path || d?.relPath || d?.relativePath || d?.name || ''
}
</script>

<template>
  <div class="container mx-auto max-w-4xl px-4 sm:px-6 py-6 space-y-4">
    <!-- 顶栏 -->
    <div class="flex items-center gap-3">
      <AppButton size="sm" variant="ghost" class="touch-h" @click="router.back()">
        <ArrowLeftIcon weight="duotone" class="h-4 w-4" />
        返回
      </AppButton>
      <DatabaseIcon weight="duotone" class="h-5 w-5 text-primary" />
      <h1 class="text-lg font-bold">知识库管理</h1>
      <span class="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">实验性</span>
      <div class="flex-1" />
      <AppButton v-if="hasToken" size="sm" variant="ghost" class="touch-h" :disabled="loading" @click="loadAll">
        <RefreshIcon weight="duotone" class="h-3.5 w-3.5" :class="loading ? 'animate-spin' : ''" />
        刷新
      </AppButton>
    </div>

    <!-- Admin Token -->
    <Card padded class="space-y-3">
      <h2 class="flex items-center gap-2 text-sm font-bold">
        <KeyIcon weight="duotone" class="h-4 w-4 text-primary" />
        Admin Token
      </h2>
      <p class="text-xs text-muted-foreground">
        知识库管理走服务端管理接口（/v1/admin/rag/*），需要管理员令牌。令牌仅保存在本机。
      </p>
      <div class="flex items-center gap-2">
        <input
          v-model="tokenInput"
          type="password"
          class="h-9 flex-1 rounded-md border border-border bg-background px-3 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="粘贴 Admin Token"
        />
        <AppButton size="sm" class="touch-h" @click="saveToken">保存</AppButton>
      </div>
    </Card>

    <!-- 错误 -->
    <Card v-if="errorMsg" padded>
      <p class="text-sm text-rose-500">{{ errorMsg }}</p>
    </Card>

    <!-- 未配置提示 -->
    <Card v-if="!hasToken" padded class="text-center py-10">
      <DatabaseIcon weight="duotone" class="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
      <p class="text-sm text-muted-foreground">配置 Admin Token 后即可查看与管理知识库</p>
    </Card>

    <template v-else>
      <!-- 指标概览 -->
      <Card v-if="statsGrid.length > 0" padded class="space-y-3">
        <h2 class="text-sm font-bold">知识库概览</h2>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div v-for="item in statsGrid" :key="item.k" class="rounded-lg bg-muted/40 px-3 py-2">
            <p class="truncate text-xs text-muted-foreground" :title="item.k">{{ item.k }}</p>
            <p class="font-mono text-sm">{{ item.v }}</p>
          </div>
        </div>
      </Card>

      <!-- 主题 -->
      <Card v-if="topics.length > 0" padded class="space-y-3">
        <h2 class="text-sm font-bold">主题分类（{{ topics.length }}）</h2>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="(t, i) in topics"
            :key="i"
            class="rounded-md border px-2 py-0.5 text-xs transition-colors"
            :class="docTopic === (t.dir || t.name || t.path) ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:text-foreground'"
            :title="t.description || ''"
            @click="docTopic = docTopic === (t.dir || t.name || t.path) ? '' : (t.dir || t.name || t.path); filterDocs()"
          >
            {{ t.dir || t.name || t.path }}
            <span v-if="t.docCount ?? t.count" class="ml-1 opacity-60">{{ t.docCount ?? t.count }}</span>
          </button>
        </div>
      </Card>

      <!-- 检索调试 -->
      <Card padded class="space-y-3">
        <h2 class="flex items-center gap-2 text-sm font-bold">
          <SearchIcon weight="duotone" class="h-4 w-4 text-primary" />
          检索调试
        </h2>
        <div class="flex items-center gap-2">
          <input
            v-model="searchQuery"
            class="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="输入检索问题，测试知识库召回"
            @keyup.enter="runSearch"
          />
          <AppButton size="sm" class="touch-h" :disabled="searching || !searchQuery.trim()" @click="runSearch">
            {{ searching ? '检索中...' : '检索' }}
          </AppButton>
        </div>
        <div v-if="searched" class="space-y-1.5">
          <p v-if="searchResults.length === 0" class="text-xs text-muted-foreground">无命中结果</p>
          <div
            v-for="(r, i) in searchResults"
            :key="i"
            class="rounded-md border border-border/60 bg-muted/30 px-3 py-2"
          >
            <p class="text-xs font-medium text-foreground">{{ r.title || r.topic || r.path || ('结果 ' + (i + 1)) }}</p>
            <p class="mt-0.5 line-clamp-3 text-xs text-muted-foreground">{{ r.content || r.text || r.snippet || '' }}</p>
          </div>
        </div>
      </Card>

      <!-- 文档列表 -->
      <Card padded class="space-y-3">
        <div class="flex items-center gap-2 flex-wrap">
          <h2 class="flex items-center gap-2 text-sm font-bold">
            <FileTextIcon weight="duotone" class="h-4 w-4 text-primary" />
            文档（{{ docs.length }}）
          </h2>
          <div class="flex-1" />
          <input
            v-model="docKeyword"
            class="h-8 w-40 rounded-md border border-border bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="关键词过滤"
            @keyup.enter="filterDocs"
          />
          <AppButton size="sm" variant="ghost" class="touch-h" @click="filterDocs">过滤</AppButton>
        </div>

        <div v-if="loading" class="py-6 text-center text-sm text-muted-foreground">加载中...</div>
        <div v-else-if="docs.length === 0" class="py-6 text-center text-sm text-muted-foreground">暂无文档</div>
        <div v-else class="divide-y divide-border/60">
          <div v-for="(d, i) in docs" :key="i" class="flex items-center gap-2 py-2">
            <FileTextIcon weight="duotone" class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span class="min-w-0 flex-1 truncate font-mono text-xs" :title="docPath(d)">{{ docPath(d) }}</span>
            <span v-if="d.topic" class="shrink-0 text-xs text-muted-foreground">{{ d.topic }}</span>
            <span v-if="d.size" class="shrink-0 font-mono text-xs text-muted-foreground">{{ fmtSize(d.size) }}</span>
            <button
              class="touch-target flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-destructive"
              aria-label="删除文档"
              @click="deleteTarget = d"
            >
              <TrashIcon weight="duotone" class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </Card>
    </template>

    <ConfirmDialog
      :open="!!deleteTarget"
      title="删除知识库文档？"
      :description="deleteTarget ? `将移除：${docPath(deleteTarget)}，删除后需重新构建索引。` : ''"
      confirm-text="删除"
      danger
      :busy="deleting"
      @confirm="confirmDelete"
      @close="deleteTarget = null"
    />
  </div>
</template>
