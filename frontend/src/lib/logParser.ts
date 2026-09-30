/**
 * 日志解析引擎 —— 对齐网页版 LogShare-Web-UI 的 logParser.worker 检测逻辑
 *
 * 职责：按行拆分原始日志，检测每行的错误/警告级别，渲染 Minecraft § 颜色码，
 * 支持搜索词高亮。
 *
 * 客户端运行在 Electron（file://）/ Capacitor（Android WebView）环境，Web Worker
 * 在这些环境有兼容风险（file:// 下 worker 加载可能被拦），且典型 MC 日志仅几十 KB、
 * 正则解析极快，故**不做 Worker、同步解析**，由组件用 computed 缓存 + v-for 渲染行。
 */

export type LogLevel = 'error' | 'warning' | 'info' | 'debug' | 'fatal'

/** Minecraft § 格式码 → CSS 类名映射（格式码持续到行尾 / §r 的语义） */
const COLOR_STYLE_MAP: Record<string, string> = {
  '0': 'format-black',
  '1': 'format-darkblue',
  '2': 'format-darkgreen',
  '3': 'format-darkaqua',
  '4': 'format-darkred',
  '5': 'format-darkpurple',
  '6': 'format-gold',
  '7': 'format-gray',
  '8': 'format-darkgray',
  '9': 'format-blue',
  a: 'format-green',
  b: 'format-aqua',
  c: 'format-red',
  d: 'format-lightpurple',
  e: 'format-yellow',
  f: 'format-white',
  k: 'format-obfuscated',
  l: 'format-bold',
  m: 'format-strike',
  n: 'format-underline',
  o: 'format-italic',
  r: 'format-reset'
}

// —— 级别检测正则（对齐网页版） ——
const RE_PYTHON_TRACEBACK = /^Traceback\s*\(most\s+recent\s+call\s+last\)\s*:\s*$/
const RE_PYTHON_FILE = /^\s*File\s+"[^"]*",\s+line\s+\d+/i
const RE_STACK_AT = /^\s*at\s+/
const RE_CAUSED_BY = /^Caused by:\s*/
const RE_MORE_STACK = /^\s*\.\.\.\s+\d+\s+more\s*$/
const RE_SUPPRESSED = /^\s*Suppressed:\s+/
const RE_EXCEPTION_NAME = /\b[A-Za-z0-9_$]*(?:Exception|Error|Throwable)\b/
const RE_ERROR_PREFIX = /^(?:\s*\[?\s*)?(?:(?:ERROR?\s*[:;]|FATAL\s*[:;]|CRITICAL\s*[:;]))/i
const RE_FATAL_LEVEL = /\b(?:FATAL|CRITICAL|EMERGENCY)\b/i
// 级别词前缀兼容 `[`、`/`、`: ` 三种（MC 日志常见 `[Server thread/ERROR]`，`/` 后无空格）
const RE_ERROR_LEVEL = /(?:\[|\/|:\s?)(?:ERR(?:OR)?|FATAL|CRITICAL|EMERGENCY|SEVERE)(?:\]|:|\s|$)/i
const RE_WARN = /(?:\[|\/|:\s?)WARN(?:ING)?(?:\]|:|\s|$)/i
const RE_DEBUG = /(?:\[|\/|:\s?)(?:DEBUG|TRACE)(?:\]|:|\s|$)/i
const RE_NOTICE = /(?:\[|\/|:\s?)NOTICE(?:\]|:|\s|$)/i
const RE_FAIL_LINE_START =
  /^\s*(?:Failed\s+to|Cannot\s+|Unable\s+to|Could\s+not|Illegal\s+|Invalid\s+|Unsupported\s+|Not\s+found\s*[:;]|Missing\s+)/i
const RE_FAIL_KEYWORDS =
  /\b(?:Failed\s+to|Cannot\s+|Unable\s+to|Could\s+not|Illegal\s+|Invalid\s+|Unsupported\s+|Not\s+found\s*[:;]|Missing\s+)/i

/** 检测单行日志的级别（顺序与网页版一致：结构化模式 → 级别关键词 → 失败关键词） */
export function getLevel(line: string): LogLevel {
  if (
    RE_PYTHON_TRACEBACK.test(line) ||
    RE_PYTHON_FILE.test(line) ||
    RE_STACK_AT.test(line) ||
    RE_CAUSED_BY.test(line) ||
    RE_MORE_STACK.test(line) ||
    RE_SUPPRESSED.test(line) ||
    RE_EXCEPTION_NAME.test(line) ||
    RE_ERROR_PREFIX.test(line)
  ) {
    return 'error'
  }
  if (RE_FATAL_LEVEL.test(line)) return 'fatal'
  if (RE_ERROR_LEVEL.test(line)) return 'error'
  if (RE_WARN.test(line)) return 'warning'
  if (RE_DEBUG.test(line)) return 'debug'
  if (RE_NOTICE.test(line)) return 'info'
  if (RE_FAIL_LINE_START.test(line)) return 'error'
  if (RE_FAIL_KEYWORDS.test(line)) return 'warning'
  return 'info'
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 渲染 Minecraft § 颜色码为 span（先转义，防日志内容注入 HTML） */
export function renderColorCodes(text: string): string {
  let open = 0
  let out = escapeHtml(text).replace(/§([0-9a-fk-or])/gi, (_m, code: string) => {
    const cls = COLOR_STYLE_MAP[code.toLowerCase()]
    if (!cls) return _m
    open++
    return `<span class="${cls}">`
  })
  if (open > 0) out += '</span>'.repeat(open)
  return out
}

/**
 * 渲染单行：转义 + § 颜色码 + 可选的搜索词 <mark> 高亮。
 *
 * 搜索高亮用占位符保护匹配片段，避免 mark 标签被 escapeHtml 转义、
 * 或被 § 颜色码的 span 拆分破坏结构。
 */
export function renderLine(text: string, search?: string): string {
  let target = text
  const marks: string[] = []
  if (search && search.trim()) {
    const re = new RegExp(escapeRegExp(search), 'gi')
    target = text.replace(re, (m) => {
      marks.push(m)
      return `\u0000M${marks.length - 1}\u0000`
    })
  }
  let html = renderColorCodes(target)
  if (marks.length > 0) {
    // \u0000 作为占位分隔符是刻意为之：NUL 不可能出现在日志文本里，
    // 因此不会与用户搜索词冲突（见上方 replace 写入占位符处）。
    // no-control-regex: NUL 是本方案的必需字符，非误用。
    // eslint-disable-next-line no-control-regex
    html = html.replace(/\u0000M(\d+)\u0000/g, (_m, i: string) => {
      const idx = Number(i)
      const v = marks[idx]
      return v !== undefined ? `<mark>${escapeHtml(v)}</mark>` : ''
    })
  }
  return html
}

export interface LogLine {
  /** 行号（从 1 开始） */
  n: number
  level: LogLevel
  /** 原始文本（未经转义/渲染） */
  text: string
}

/** 把原始日志按行拆分为带级别信息的行数组 */
export function parseLogLines(raw: string): LogLine[] {
  if (!raw) return []
  return raw.split('\n').map((text, i) => ({
    n: i + 1,
    level: getLevel(text),
    text
  }))
}
