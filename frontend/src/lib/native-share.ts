/**
 * Android 端「接收外部分享」的渲染层接入。
 *
 * 对应桌面端的文件关联（file-association.ts）—— 两者最终都把文件推进
 * `incomingFiles` 队列，由 HomeView 统一消费，所以载入逻辑只有一份。
 *
 * 原生侧对应：
 * - `android/.../ShareReceiverPlugin.java`  队列 + 事件通知
 * - `android/.../MainActivity.java`         解析 Intent（SEND / SEND_MULTIPLE / VIEW）
 *
 * 时序要点与桌面端一致：**先挂监听、再拉取积压**。反过来的话，
 * 「就绪瞬间到达的分享」会因为当时还没有监听者而丢失。
 */

import { Capacitor, registerPlugin } from '@capacitor/core'
import { incomingFiles } from '@/lib/file-association'

interface SharedFile {
  name: string
  content: string
  size: number
}

interface ShareReceiverPlugin {
  getPending(): Promise<{ items: SharedFile[] }>
  addListener(
    eventName: 'shareReceived',
    listenerFunc: () => void
  ): Promise<{ remove: () => Promise<void> }>
}

const ShareReceiver = registerPlugin<ShareReceiverPlugin>('ShareReceiver')

let started = false

/**
 * 启动分享接收。全局调用一次（App.vue onMounted）；重复调用会被忽略。
 * 非原生平台（浏览器 / Electron）直接跳过，不影响现有行为。
 */
export async function initNativeShare(): Promise<void> {
  if (started) return
  if (!Capacitor.isNativePlatform()) return
  started = true

  try {
    await ShareReceiver.addListener('shareReceived', () => {
      void drain()
    })
  } catch {
    // 插件不可用时静默降级（例如 Web 构建产物被直接打开）
  }

  await drain()
}

/** 取走原生侧积压的分享文件，交给统一的 incomingFiles 队列 */
async function drain(): Promise<void> {
  try {
    const { items } = await ShareReceiver.getPending()
    if (!items || items.length === 0) return
    for (const item of items) {
      incomingFiles.value.push({
        name: item.name,
        // Android 侧没有用户可见的本地路径，用文件名占位：
        // 它只用于列表展示与历史记录，不参与任何文件系统操作
        path: item.name,
        size: item.size,
        content: item.content
      })
    }
  } catch {
    // 原生侧尚未就绪，忽略
  }
}
