/**
 * LogShare API 客户端
 * 封装所有 https://api.logshare.cn 的接口调用
 */

import { brotliCompress } from '@/lib/brotli'
import { openWafBlock } from '@/lib/waf'

const API_BASE = 'https://api.logshare.cn'

/** 普通请求超时（毫秒） */
const TIMEOUT_DEFAULT = 20_000
/** 上传日志：文件可能很大，移动网络下需要更宽裕的时间 */
const TIMEOUT_UPLOAD = 180_000
/** 服务端解析日志：大文件解析耗时较长 */
const TIMEOUT_ANALYSE = 90_000

/**
 * 带诊断信息的接口错误。
 *
 * 不把 fetch 的原生异常直接抛给调用方的原因：fetch 在各种失败下都只给一句
 * 笼统的 `TypeError: Failed to fetch`，而 UI 又把它统一渲染成「网络错误」，
 * 导致「手机没网」「服务器 502」「响应不是 JSON」这三类完全不同的故障
 * 看起来一模一样，线上无法定位。这里把失败归类并带上 URL 与状态码。
 */
export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'parse' | 'canceled' | 'waf'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly url: string
  readonly status?: number
  /** WAF 拦截卡片的原始 HTML，仅 kind === 'waf' 时有值 */
  readonly html?: string

  constructor(kind: ApiErrorKind, message: string, url: string, status?: number, html?: string) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.url = url
    this.status = status
    this.html = html
  }
}

/** 把任意异常整理成可直接展示给用户的文案 */
export function describeApiError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.kind) {
      case 'timeout':
        return `${err.message}，日志较大时建议改用 Wi‑Fi 后重试`
      case 'http':
        return `服务器错误：${err.message}`
      case 'parse':
        return '服务器返回了非预期内容，请稍后重试'
      case 'canceled':
        return '请求已取消'
      case 'waf':
        return '请求已被安全系统拦截，请稍后重试'
      default:
        return `网络连接失败，请检查网络后重试`
    }
  }
  return err instanceof Error ? err.message : String(err)
}

/** 请求体压缩阈值：小于 1KiB 时 gzip 头部开销会反超收益 */
const COMPRESS_MIN_LENGTH = 1024

/** OpenLiteWaf 拦截卡片的判定特征（与线上站同一套后端，判定方式保持一致） */
export function isWafBlockHtml(text: string): boolean {
  return typeof text === 'string' && text.includes('class="widget"')
}

/** 常见网关/服务端状态码的友好文案 */
function describeStatus(status: number): string {
  if (status === 413) return '日志体积超过服务器限制'
  if (status === 429) return '请求过于频繁，请稍后再试'
  if (status === 403) return '请求被拒绝'
  if (status === 404) return '日志不存在或已过期'
  if (status === 502 || status === 503 || status === 504) {
    return '服务器暂时不可用，请稍后重试'
  }
  if (status >= 500) return '服务器内部错误'
  return `HTTP ${status}`
}

/**
 * 大请求体自适应压缩：优先 brotli（br），回落 gzip，最后原样。
 *
 * Minecraft 日志重复度极高，而手机在移动网络下上传未压缩的原始 JSON 极易
 * 超时或被网关截断 —— 这类失败在浏览器侧只表现为一句笼统的「网络错误」。
 *
 * 实测（同一份 62KB 日志）：gzip → 3.2KB，brotli q5 → 约 2.5KB（再省 ~22%）。
 * 服务端两种编码都接受（415 仅出现在 zstd）。brotli 需要额外加载 wasm 模块
 * （懒加载，约 1.4MB，一次加载长期缓存），所以 gzip 路径始终保留为兜底。
 */
async function maybeCompress(
  body: string,
  headers: Record<string, string>
): Promise<{ body: BodyInit; headers: Record<string, string> }> {
  if (body.length < COMPRESS_MIN_LENGTH) {
    return { body, headers }
  }
  // 字符串按 UTF-8 转字节，供 brotli 使用
  const utf8 = new TextEncoder().encode(body)
  if (utf8.byteLength < COMPRESS_MIN_LENGTH) {
    return { body, headers }
  }

  // 1) brotli 优先（体积最小；模块懒加载失败则静默跳过）
  try {
    const br = await brotliCompress(utf8)
    if (br && br.byteLength < utf8.byteLength) {
      return {
        body: br,
        headers: { ...headers, 'Content-Encoding': 'br' }
      }
    }
  } catch {
    /* 落到 gzip */
  }

  // 2) gzip 兜底（CompressionStream 无额外依赖）
  try {
    if (typeof CompressionStream !== 'undefined') {
      const stream = new Blob([body]).stream().pipeThrough(new CompressionStream('gzip'))
      const buf = await new Response(stream).arrayBuffer()
      const bytes = new Uint8Array(buf)
      if (bytes.byteLength < utf8.byteLength) {
        return {
          body: bytes,
          headers: { ...headers, 'Content-Encoding': 'gzip' }
        }
      }
    }
  } catch {
    /* 落到原样 */
  }

  // 3) 原样上传 —— 压缩链路任何异常都不让请求失败
  return { body, headers }
}

/** 从错误响应体里尽力提取服务端给出的可读信息 */
function pickServerMessage(text: string): string {
  if (!text) return ''
  if (isWafBlockHtml(text)) return '请求已被安全系统拦截'
  try {
    const j = JSON.parse(text)
    return j.message || j.error || j.msg || ''
  } catch {
    // 非 JSON —— 常见于网关直接吐 HTML 错误页（413/502/504）。
    // 剥掉标签截一段纯文本，至少让用户知道发生了什么。
    const plain = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    return plain.slice(0, 120)
  }
}

interface RequestOptions {
  method?: string
  headers?: Record<string, string>
  body?: string
  timeout?: number
  signal?: AbortSignal
}

/**
 * 统一请求入口：超时、HTTP 状态校验、JSON 解析兜底、错误归类。
 *
 * 内部超时 signal 与外部 signal 需要合并 —— SSE 场景由调用方传 signal 控制取消。
 */
async function request(path: string, opts: RequestOptions = {}): Promise<string> {
  const url = path.startsWith('http') ? path : API_BASE + path
  const timeout = opts.timeout ?? TIMEOUT_DEFAULT

  // 字符串请求体先过一遍自适应压缩（大日志收益极大）
  let headers: Record<string, string> = { ...(opts.headers ?? {}) }
  let body: BodyInit | undefined = opts.body
  if (typeof body === 'string') {
    const packed = await maybeCompress(body, headers)
    body = packed.body
    headers = packed.headers
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  const onExternalAbort = () => ctrl.abort()
  opts.signal?.addEventListener('abort', onExternalAbort)

  try {
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers,
      body,
      signal: ctrl.signal
    })

    const text = await res.text()

    if (!res.ok) {
      // WAF 拦截单独成类：它返回的不是业务错误而是一整页 HTML 卡片，
      // 归到 http 会让用户误判成服务端故障。同时把卡片推给全局弹窗，
      // 让用户在任意接口上都能看到拦截详情（不用每个调用点各自处理）。
      if (isWafBlockHtml(text)) {
        openWafBlock({ url, status: res.status, html: text })
        throw new ApiError('waf', '请求已被安全系统拦截', url, res.status, text)
      }

      throw new ApiError(
        'http',
        pickServerMessage(text) || describeStatus(res.status),
        url,
        res.status
      )
    }
    return text
  } catch (err) {
    if (err instanceof ApiError) throw err
    // 调用方主动取消（如切换页面）：单独归类，UI 侧静默处理
    if (opts.signal?.aborted) {
      throw new ApiError('canceled', '请求已取消', url)
    }
    if ((err as Error)?.name === 'AbortError') {
      throw new ApiError('timeout', `请求超时（${Math.round(timeout / 1000)} 秒）`, url)
    }
    throw new ApiError('network', (err as Error)?.message || '网络请求失败', url)
  } finally {
    clearTimeout(timer)
    opts.signal?.removeEventListener('abort', onExternalAbort)
  }
}

/** JSON 响应 */
async function requestJson<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = path.startsWith('http') ? path : API_BASE + path
  const text = await request(path, opts)
  if (!text) {
    // 空响应体：DELETE 之类的操作可能合法
    return undefined as T
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new ApiError('parse', '响应不是合法 JSON', url)
  }
}

/** 纯文本响应（原始日志 / 附加文件） */
async function requestText(path: string, opts: RequestOptions = {}): Promise<string> {
  return request(path, opts)
}

export interface LogSubmitResponse {
  success: boolean
  message?: string
  id: string
  url: string
  raw: string
  token: string
}

export interface LogMetadata {
  success: boolean
  message?: string
  id: string
  size: number
  lines: number
  created: number
  expires: number
  metadata: Array<{ key: string; value: string; label?: string; visible?: boolean }>
  source: string
  files: Array<{ name: string; size: number }>
  raw: string
}

export interface AnalysisProblem {
  message: string
  counter: number
  solutions: string[]
}

export interface AnalysisResult {
  id: string
  name: string
  type: string
  version: string
  title: string
  analysis: {
    problems: AnalysisProblem[]
    information: Array<{ message: string; counter: number; label?: string; value?: string }>
  }
}

export interface ServerLimits {
  maxLength: number
  maxLines: number
  storageTime: number
}

export interface ServerFilters {
  success: boolean
  filters: Array<{
    type: string
    data: any
  }>
}

export interface AIAnalysisStatus {
  type: 'queued' | 'thinking' | 'tool' | 'tool_result' | 'limit'
  [key: string]: any
}

export type AIMode = 'deep' | 'launcher' | 'quick'

/**
 * 提交日志
 * POST /v1/log
 */
export async function submitLog(params: {
  content?: string
  files?: Array<{ name: string; content: string }>
  source?: string
  metadata?: Record<string, any>
}): Promise<LogSubmitResponse> {
  const body: Record<string, any> = {}
  if (params.content) body.content = params.content
  if (params.files) body.files = params.files
  if (params.source) body.source = params.source
  if (params.metadata) body.metadata = params.metadata

  return requestJson<LogSubmitResponse>('/v1/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeout: TIMEOUT_UPLOAD
  })
}

/**
 * 本地分析日志（不存储）
 * POST /v1/analyse
 */
export async function analyseLog(content: string): Promise<AnalysisResult> {
  return requestJson<AnalysisResult>('/v1/analyse', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: content,
    timeout: TIMEOUT_ANALYSE
  })
}

/**
 * 获取原始日志
 * GET /v1/raw/{id}
 */
export async function getRawLog(id: string): Promise<string> {
  return requestText(`/v1/raw/${id}`)
}

/**
 * 获取日志附加文件
 * GET /v1/raw/{id}/{filename}
 */
export async function getRawFile(id: string, filename: string): Promise<string> {
  // 子路径分隔符不可编码 —— 后端按原始路径段路由。
  // 整体 encodeURIComponent 会把 '/' 变成 %2F，导致子目录里的附加文件取不到。
  const path = filename.split('/').map(encodeURIComponent).join('/')
  return requestText(`/v1/raw/${id}/${path}`)
}

/**
 * 获取日志元信息
 * GET /v1/log/{id}
 */
export async function getLogMetadata(id: string): Promise<LogMetadata> {
  return requestJson<LogMetadata>(`/v1/log/${id}`)
}

/**
 * 删除日志
 * DELETE /v1/log/{id}
 */
export async function deleteLog(id: string, token: string): Promise<any> {
  return requestJson<any>(`/v1/log/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })
}

/**
 * 获取分析洞察
 * GET /v1/insights/{id}
 */
export async function getInsights(id: string): Promise<AnalysisResult> {
  return requestJson<AnalysisResult>(`/v1/insights/${id}`)
}

/**
 * 获取限制信息
 * GET /v1/limits
 */
export async function getLimits(): Promise<ServerLimits> {
  return requestJson<ServerLimits>('/v1/limits')
}

/**
 * 获取过滤器信息
 * GET /v1/filters
 */
export async function getFilters(): Promise<ServerFilters> {
  return requestJson<ServerFilters>('/v1/filters')
}

/**
 * AI 分析已存储日志（SSE 流式）
 * GET /v1/ai/{id}
 */
export async function aiAnalyzeStored(
  id: string,
  mode: AIMode = 'deep',
  callbacks: {
    onContent?: (text: string) => void
    onStatus?: (status: AIAnalysisStatus) => void
    onError?: (error: string) => void
    onDone?: () => void
  },
  signal?: AbortSignal
): Promise<void> {
  const url = `${API_BASE}/v1/ai/${encodeURIComponent(id)}?mode=${mode}`
  await readSSEStream(url, callbacks, signal)
}

/**
 * AI 分析日志内容（SSE 流式，不落盘）
 * POST /v1/ai/analyse
 */
export async function aiAnalyzeContent(
  params: {
    content?: string
    id?: string
    mode?: AIMode
  },
  callbacks: {
    onContent?: (text: string) => void
    onStatus?: (status: AIAnalysisStatus) => void
    onError?: (error: string) => void
    onDone?: () => void
  },
  signal?: AbortSignal
): Promise<void> {
  // 待分析的日志内容同样可能很大，先过自适应压缩再建立流
  const packed = await maybeCompress(
    JSON.stringify({
      content: params.content,
      id: params.id,
      mode: params.mode || 'deep'
    }),
    {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream'
    }
  )

  const res = await fetch(`${API_BASE}/v1/ai/analyse`, {
    method: 'POST',
    headers: packed.headers,
    body: packed.body,
    signal
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (res.status === 429) {
      callbacks.onError?.('AI 服务繁忙，请稍后再试')
      return
    }
    callbacks.onError?.(pickServerMessage(text) || `HTTP ${res.status}`)
    return
  }

  await readSSEStreamFromResponse(res, callbacks, signal)
}

/**
 * 把 AI 流里的 `event: error` 文案整理成用户可读的提示。
 *
 * 服务端在「所有上游 AI 密钥都被限流」时会原样透出内部错误
 * （`所有 AI API 密钥均尝试失败：HTTP 429 ... (request id: ...)`），
 * 直接展示既暴露内部细节、又没告诉用户「这是暂时的、稍后重试即可」。
 */
function describeAiStreamError(raw: string): string {
  const s = (raw || '').trim()
  if (!s) return '未知错误'
  if (/429|请求过于频繁|rate\s*limit|quota/i.test(s)) {
    return 'AI 服务繁忙，请稍后再试'
  }
  // 剥掉内部 request id 尾巴，避免把服务器内部细节暴露给用户
  return s.replace(/\s*\(request\s*id:\s*[^)]*\)/i, '')
}

/**
 * 读取 SSE 流（GET 方式）
 */
async function readSSEStream(url: string, callbacks: {
  onContent?: (text: string) => void
  onStatus?: (status: AIAnalysisStatus) => void
  onError?: (error: string) => void
  onDone?: () => void
}, signal?: AbortSignal): Promise<void> {
  let res: Response
  try {
    res = await fetch(url, { signal })
  } catch (err) {
    // 用户主动取消：静默退出，不产生错误提示
    if (signal?.aborted || (err as Error)?.name === 'AbortError') return
    callbacks.onError?.(
      describeApiError(new ApiError('network', (err as Error)?.message || '网络请求失败', url))
    )
    return
  }
  if (!res.ok) {
    // 先读文本再解析：网关错误页（413/502/504）通常不是 JSON，
    // 直接 json() 会抛解析异常，把服务端错误伪装成「网络错误」。
    const text = await res.text().catch(() => '')
    if (res.status === 429) {
      callbacks.onError?.('AI 服务繁忙，请稍后再试')
      return
    }
    callbacks.onError?.(pickServerMessage(text) || `HTTP ${res.status}`)
    return
  }
  await readSSEStreamFromResponse(res, callbacks, signal)
}

/**
 * 从 Response 读取 SSE 流
 */
async function readSSEStreamFromResponse(
  res: Response,
  callbacks: {
    onContent?: (text: string) => void
    onStatus?: (status: AIAnalysisStatus) => void
    onError?: (error: string) => void
    onDone?: () => void
  },
  signal?: AbortSignal
): Promise<void> {
  if (!res.body) {
    callbacks.onError?.('响应体为空，无法读取流')
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const rawLine of lines) {
        // 兼容 CRLF 行尾（网关/CDN 转发时可能改写换行符），先剥离 \r
        const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine

        // SSE 规范：空行代表一次事件分发结束，事件类型需随之重置，
        // 否则后续「无 event 头」的正文 data 行会被误判为上一个事件类型。
        if (line === '') {
          currentEvent = ''
          continue
        }
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim()
          continue
        }
        // 兼容 "data:" 与 "data: " 两种写法
        if (!line.startsWith('data:')) continue

        // 按 SSE 规范仅移除一个前导空格
        const dataStr = line.slice(5).replace(/^ /, '')
        // OpenAI 风格流的结束哨兵，直接跳过
        if (!dataStr || dataStr === '[DONE]') continue
        let payload: any
        try {
          payload = JSON.parse(dataStr)
        } catch {
          continue
        }

        if (currentEvent === 'error') {
          callbacks.onError?.(describeAiStreamError(payload.error || payload.message))
          return
        }
        if (currentEvent === 'done') {
          callbacks.onDone?.()
          return
        }
        if (currentEvent === 'status') {
          callbacks.onStatus?.(payload)
          // 显式重置，兼容「status 事件之间没有空行分隔」的服务端实现
          currentEvent = ''
          continue
        }
        // 无 event 头（或 message）的 data 为正文增量。
        // 兼容 reasoning_content 思维链增量：部分服务端把「思考」也放进
        // choices[0].delta（而非 event: status），只读 content 会整段漏掉。
        const delta = payload.choices?.[0]?.delta
        const content = delta?.content || delta?.reasoning_content
        if (content) {
          callbacks.onContent?.(content)
        }
      }
    }
    callbacks.onDone?.()
  } catch (err: any) {
    // 用户主动取消：静默退出，不产生错误提示
    if (signal?.aborted || err?.name === 'AbortError') return
    callbacks.onError?.(err.message || '流读取失败')
  } finally {
    reader.releaseLock()
  }
}

/**
 * 解析 AI 分析结果中的结构化 JSON 结论块
 */
export interface AIDiagnosis {
  rootCause: string
  confidence: number
  troubleshooting: string[]
  evidence: string[]
  /** 原始 JSON 文本（未格式化），供面板折叠展示原始元数据 */
  rawJson?: string
}

export function parseDiagnosis(text: string): AIDiagnosis | null {
  const match = text.match(/```json\s*(\{[\s\S]*?\})\s*```/)
  if (!match) return null
  const rawJson = match[1]!
  try {
    const raw = JSON.parse(rawJson) as Record<string, unknown>
    if (!raw || typeof raw !== 'object') return null
    return {
      rootCause: pickString(raw, ['rootCause', 'root_cause', 'cause']),
      confidence: typeof raw.confidence === 'number' ? raw.confidence : 0,
      // 排障步骤：服务端实测字段名是 steps，兼容早期约定的 troubleshooting
      troubleshooting: pickStringArray(raw, ['steps', 'troubleshooting', 'solutions', 'fixes']),
      evidence: pickStringArray(raw, ['evidence', 'evidences']),
      rawJson
    }
  } catch {
    return null
  }
}

function pickString(raw: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = raw[k]
    if (typeof v === 'string' && v.trim()) return v
  }
  return ''
}

function pickStringArray(raw: Record<string, unknown>, keys: string[]): string[] {
  for (const k of keys) {
    const v = raw[k]
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string')
  }
  return []
}

// ============================================================
// 知识库管理（实验性：走 /v1/admin/rag/*，需服务端 Admin Token）
// ============================================================

/** admin 接口鉴权头（服务端同时接受两种写法） */
function adminHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'X-Admin-Token': token }
}

/** 知识库指标与主题全景 */
export async function ragStats(token: string): Promise<any> {
  return requestJson<any>('/v1/admin/rag/stats', { headers: adminHeaders(token) })
}

/** 知识库分类主题列表 */
export async function ragTopics(token: string): Promise<any> {
  return requestJson<any>('/v1/admin/rag/topics', { headers: adminHeaders(token) })
}

/** 知识库文档列表（可按主题 / 关键词过滤） */
export async function ragDocs(
  token: string,
  filter?: { topic?: string; keyword?: string }
): Promise<any> {
  const q = new URLSearchParams()
  if (filter?.topic) q.set('topic', filter.topic)
  if (filter?.keyword) q.set('keyword', filter.keyword)
  const qs = q.toString()
  return requestJson<any>(`/v1/admin/rag/docs${qs ? `?${qs}` : ''}`, { headers: adminHeaders(token) })
}

/** 知识库检索调试 */
export async function ragSearch(token: string, query: string, limit = 5): Promise<any> {
  return requestJson<any>('/v1/admin/rag/search', {
    method: 'POST',
    headers: { ...adminHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit })
  })
}

/** 删除知识库文档 */
export async function ragDocDelete(token: string, docPath: string): Promise<any> {
  return requestJson<any>(`/v1/admin/rag/docs?path=${encodeURIComponent(docPath)}`, {
    method: 'DELETE',
    headers: adminHeaders(token)
  })
}
