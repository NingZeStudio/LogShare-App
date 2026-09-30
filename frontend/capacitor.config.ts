import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor 配置 —— 把现有的 Vue 前端直接套壳成 Android 应用。
 *
 * webDir 指向前端构建产物（vite.config.ts 里 build.outDir = '../electron/renderer'），
 * 即 Electron 与 Android 共用同一份构建结果，改一处两边同时生效。
 */
const config: CapacitorConfig = {
  appId: 'cn.logshare.app',
  appName: 'LogShare',
  webDir: '../electron/renderer',
  android: {
    // 允许 http 明文仅用于本地调试（生产走 https，保持默认限制）
    allowMixedContent: false
  }
}

export default config
