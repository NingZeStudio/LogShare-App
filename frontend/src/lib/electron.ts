/**
 * Electron 环境下的本地文件与历史记录操作
 * 在非 Electron 环境（Web）下降级为 localStorage
 */

import type { LogshareAPI, LogshareHistoryEntry, LogshareFileResult } from '@/types/logshare-api'

export type HistoryEntry = LogshareHistoryEntry

const bridge: LogshareAPI | undefined =
  typeof window !== 'undefined' ? window.logshareAPI : undefined

/**
 * 打开文件选择对话框
 */
export async function openFileDialog(): Promise<LogshareFileResult[] | null> {
  if (bridge) {
    return bridge.openFileDialog()
  }
  // Web 降级：返回 null，由 UI 层用 <input type="file"> 处理
  return null
}

/**
 * 保存文件到本地
 */
export async function saveFileLocal(defaultName: string, content: string): Promise<{ success: boolean; path?: string; error?: string }> {
  if (bridge) {
    return bridge.saveFile(defaultName, content)
  }
  // Web 降级：触发下载
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = defaultName
  a.click()
  URL.revokeObjectURL(url)
  return { success: true }
}

/**
 * 获取历史记录
 */
export async function getHistory(): Promise<HistoryEntry[]> {
  if (bridge) {
    return bridge.getHistory()
  }
  // Web 降级
  const raw = localStorage.getItem('logshare_history')
  return raw ? JSON.parse(raw) : []
}

/**
 * 添加历史记录
 */
export async function addHistory(entry: HistoryEntry): Promise<void> {
  if (bridge) {
    await bridge.addHistory(entry)
    return
  }
  const history = await getHistory()
  const idx = history.findIndex(h => h.id === entry.id)
  if (idx >= 0) {
    history[idx] = entry
  } else {
    history.unshift(entry)
    if (history.length > 100) history.pop()
  }
  localStorage.setItem('logshare_history', JSON.stringify(history))
}

/**
 * 删除历史记录
 */
export async function removeHistory(id: string): Promise<void> {
  if (bridge) {
    await bridge.removeHistory(id)
    return
  }
  const history = await getHistory()
  localStorage.setItem('logshare_history', JSON.stringify(history.filter(h => h.id !== id)))
}

/**
 * 清空历史记录
 */
export async function clearHistory(): Promise<void> {
  if (bridge) {
    await bridge.clearHistory()
    return
  }
  localStorage.removeItem('logshare_history')
}

/**
 * 订阅"双击关联文件（.log / .logs）打开"事件，返回取消订阅函数
 */
export function onOpenFile(cb: (file: LogshareFileResult) => void): () => void {
  if (!bridge) return () => {}
  return bridge.onOpenFile(cb)
}

/**
 * 通知主进程渲染层已就绪，并取回启动时积压的待打开文件
 */
export async function takePendingFiles(): Promise<LogshareFileResult[]> {
  if (!bridge) return []
  return bridge.rendererReady()
}
