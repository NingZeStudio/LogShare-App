/**
 * 文件关联（双击 .log / .logs 用本应用打开）的渲染层接入。
 *
 * 时序要点：必须先注册 `file:open` 监听、再通知主进程「已就绪」，
 * 否则在就绪瞬间到达的文件会因为没有监听者而丢失。
 *
 * 主进程侧对应逻辑见 electron/main.js 的 deliverFiles / file:rendererReady。
 */

import { ref } from 'vue'
import { onOpenFile, takePendingFiles } from '@/lib/electron'
import type { LogshareFileResult } from '@/types/logshare-api'

/** 由文件关联推送进来、等待 HomeView 消费的文件队列 */
export const incomingFiles = ref<LogshareFileResult[]>([])

let started = false

/**
 * 启动文件关联监听：注册事件订阅 + 取回冷启动时积压的文件。
 * 全局只需调用一次（App.vue onMounted），重复调用会被忽略。
 */
export async function initFileAssociation(): Promise<void> {
  if (started) return
  started = true

  onOpenFile((file) => {
    if (file) incomingFiles.value.push(file)
  })

  try {
    const queued = await takePendingFiles()
    if (queued.length > 0) incomingFiles.value.push(...queued)
  } catch {
    // 主进程未就绪或非 Electron 环境，忽略即可
  }
}

/** 取走并清空队列（HomeView 调用） */
export function consumeIncomingFiles(): LogshareFileResult[] {
  return incomingFiles.value.splice(0)
}
