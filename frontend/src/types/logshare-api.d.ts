/**
 * Electron preload（contextBridge）暴露的 IPC 桥接接口类型声明
 * 与 electron/preload.js 中 exposeInMainWorld('logshareAPI', ...) 保持一致
 */

export interface LogshareHistoryEntry {
  id: string
  url: string
  token: string
  source: string
  fileName: string
  size: number
  lines: number
  createdAt: number
  title?: string
}

export interface LogshareFileResult {
  name: string
  path: string
  size: number
  isZip?: boolean
  base64?: string
  content?: string
}

export interface LogshareSaveResult {
  success: boolean
  path?: string
  error?: string
}

export interface LogshareMutationResult {
  success: boolean
  error?: string
}

/** 崩溃日志文件条目（JVM hs_err / MC crash-report） */
export interface LogshareCrashFile {
  name: string
  path: string
  size: number
  dir: string
}

export interface LogshareCrashReadResult {
  success: boolean
  name?: string
  content?: string
  size?: number
  error?: string
}

export interface LogshareWatchResult {
  ok: boolean
  dir?: string
  error?: string
}

export interface LogshareAPI {
  openFileDialog: () => Promise<LogshareFileResult[] | null>
  saveFile: (defaultName: string, content: string) => Promise<LogshareSaveResult>
  getHistory: () => Promise<LogshareHistoryEntry[]>
  addHistory: (entry: LogshareHistoryEntry) => Promise<LogshareMutationResult>
  removeHistory: (id: string) => Promise<LogshareMutationResult>
  clearHistory: () => Promise<LogshareMutationResult>
  /** 订阅"双击关联文件打开"事件，返回取消订阅函数 */
  onOpenFile: (callback: (file: LogshareFileResult) => void) => () => void
  /** 通知主进程渲染层已就绪，并取回启动时积压的待打开文件 */
  rendererReady: () => Promise<LogshareFileResult[]>
  /** JVM 崩溃日志自动检查（实验性） */
  crashWatchStart: (dir: string) => Promise<LogshareWatchResult>
  crashWatchStop: () => Promise<LogshareWatchResult>
  crashScan: (dir: string) => Promise<LogshareCrashFile[]>
  crashPickDir: () => Promise<string | null>
  crashRead: (filePath: string) => Promise<LogshareCrashReadResult>
  onCrashDetected: (callback: (file: LogshareCrashFile) => void) => () => void
  platform: string
  isElectron: true
}

declare global {
  interface Window {
    logshareAPI?: LogshareAPI
  }
}

export {}
