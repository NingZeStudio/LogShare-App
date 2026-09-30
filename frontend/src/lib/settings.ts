/**
 * 应用设置（localStorage 持久化 + 响应式共享）
 *
 * 各页面读取设置统一走这里，避免键名散落、读写不一致。
 * 显示模式用响应式 `displayMode`，设置页与顶栏主题切换共用同一份状态。
 */
import { ref } from 'vue'

export type DisplayMode = 'light' | 'dark' | 'system'
export type AiModePref = 'deep' | 'launcher' | 'quick'

const KEYS = {
  displayMode: 'display_mode',
  logFontSize: 'log_font_size',
  logWrap: 'log_wrap',
  logErrorsOnly: 'log_errors_only',
  aiDefaultMode: 'ai_default_mode',
  // 实验性功能
  customModelEnabled: 'x_custom_model_enabled',
  customModelBaseUrl: 'x_custom_model_base_url',
  customModelName: 'x_custom_model_name',
  customModelApiKey: 'x_custom_model_api_key',
  crashWatchEnabled: 'x_crash_watch_enabled',
  crashWatchDir: 'x_crash_watch_dir',
  kbAdminToken: 'x_kb_admin_token'
} as const

/** 日志查看器字体大小范围 */
export const FONT_SIZE_MIN = 10
export const FONT_SIZE_MAX = 28
export const FONT_SIZE_DEFAULT = 13

function readBool(key: string, fallback: boolean): boolean {
  const v = localStorage.getItem(key)
  return v === null ? fallback : v === '1'
}
function writeBool(key: string, v: boolean) {
  localStorage.setItem(key, v ? '1' : '0')
}

// —— 显示模式 ——
export const displayMode = ref<DisplayMode>('system')

export function applyDisplayMode(mode: DisplayMode) {
  if (typeof document === 'undefined') return
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = mode === 'dark' || (mode === 'system' && prefersDark)
  document.documentElement.classList.toggle('dark', dark)
}

export function setDisplayMode(mode: DisplayMode) {
  displayMode.value = mode
  if (mode === 'system') localStorage.removeItem(KEYS.displayMode)
  else localStorage.setItem(KEYS.displayMode, mode)
  applyDisplayMode(mode)
}

/** 应用启动时初始化（main.ts 调用） */
export function initDisplayMode() {
  const stored = localStorage.getItem(KEYS.displayMode)
  displayMode.value = stored === 'dark' || stored === 'light' ? stored : 'system'
  applyDisplayMode(displayMode.value)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!localStorage.getItem(KEYS.displayMode)) applyDisplayMode('system')
  })
}

// —— 日志查看器 ——
export function getLogFontSize(): number {
  const n = Number(localStorage.getItem(KEYS.logFontSize))
  return Number.isFinite(n) && n >= FONT_SIZE_MIN && n <= FONT_SIZE_MAX ? n : FONT_SIZE_DEFAULT
}
export function setLogFontSize(n: number) {
  const clamped = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(n)))
  localStorage.setItem(KEYS.logFontSize, String(clamped))
  return clamped
}

export function getLogWrap(): boolean {
  return readBool(KEYS.logWrap, true)
}
export function setLogWrap(v: boolean) {
  writeBool(KEYS.logWrap, v)
}

export function getLogErrorsOnly(): boolean {
  return readBool(KEYS.logErrorsOnly, false)
}
export function setLogErrorsOnly(v: boolean) {
  writeBool(KEYS.logErrorsOnly, v)
}

// —— AI 分析 ——
export function getAiDefaultMode(): AiModePref {
  const v = localStorage.getItem(KEYS.aiDefaultMode)
  return v === 'quick' || v === 'launcher' ? v : 'deep'
}
export function setAiDefaultMode(mode: AiModePref) {
  localStorage.setItem(KEYS.aiDefaultMode, mode)
}

// ============================================================
// 实验性功能（功能与接口均可能变动，勿依赖其稳定性）
// ============================================================

/** 自定义 AI 模型配置（实验性） */
export interface CustomModelConfig {
  enabled: boolean
  /** OpenAI 兼容端点，如 https://api.openai.com/v1 */
  baseUrl: string
  model: string
  apiKey: string
}

export function getCustomModel(): CustomModelConfig {
  return {
    enabled: readBool(KEYS.customModelEnabled, false),
    baseUrl: localStorage.getItem(KEYS.customModelBaseUrl) || '',
    model: localStorage.getItem(KEYS.customModelName) || '',
    apiKey: localStorage.getItem(KEYS.customModelApiKey) || ''
  }
}

export function setCustomModel(cfg: CustomModelConfig) {
  writeBool(KEYS.customModelEnabled, cfg.enabled)
  localStorage.setItem(KEYS.customModelBaseUrl, cfg.baseUrl.trim())
  localStorage.setItem(KEYS.customModelName, cfg.model.trim())
  localStorage.setItem(KEYS.customModelApiKey, cfg.apiKey.trim())
}

/** JVM 崩溃自动检查配置（实验性，仅桌面端可用） */
export interface CrashWatchConfig {
  enabled: boolean
  /** 监听目录（如 .minecraft 或服务器根目录），空表示未设置 */
  dir: string
}

export function getCrashWatch(): CrashWatchConfig {
  return {
    enabled: readBool(KEYS.crashWatchEnabled, false),
    dir: localStorage.getItem(KEYS.crashWatchDir) || ''
  }
}

export function setCrashWatch(cfg: CrashWatchConfig) {
  writeBool(KEYS.crashWatchEnabled, cfg.enabled)
  localStorage.setItem(KEYS.crashWatchDir, cfg.dir.trim())
}

/** 知识库管理所需的 Admin Token（实验性，仅本地保存） */
export function getKbAdminToken(): string {
  return localStorage.getItem(KEYS.kbAdminToken) || ''
}
export function setKbAdminToken(token: string) {
  if (token) localStorage.setItem(KEYS.kbAdminToken, token.trim())
  else localStorage.removeItem(KEYS.kbAdminToken)
}
