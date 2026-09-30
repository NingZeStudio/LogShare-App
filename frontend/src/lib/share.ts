/**
 * 分享能力封装
 *
 * 移动端优先调起系统分享面板（navigator.share）；
 * 不支持时回落剪贴板；剪贴板也不可用时（非安全上下文 / 旧 WebView）再回落
 * 已废弃但兼容性最好的 execCommand，确保任何环境都有可用路径。
 */

export interface ShareResult {
  ok: boolean
  /** 实际使用的方式 */
  method: 'share' | 'clipboard' | 'manual'
  /** 用户在系统分享面板里主动取消 —— UI 不应提示"分享失败"或"已复制" */
  cancelled?: boolean
  error?: string
}

/** 当前环境是否支持系统分享面板（Android / iOS 浏览器与 Capacitor 均支持） */
export function canShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

/**
 * 分享链接。
 * @returns 结果对象；`cancelled` 为 true 时调用方应静默处理，不要弹提示。
 */
export async function shareLink(
  url: string,
  title = 'LogShare 日志分享',
  text?: string
): Promise<ShareResult> {
  if (canShare()) {
    try {
      await navigator.share({ title, text: text ?? url, url })
      return { ok: true, method: 'share' }
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name
      // 用户主动取消：视为正常路径，静默返回
      if (name === 'AbortError') {
        return { ok: true, method: 'share', cancelled: true }
      }
      // 其它错误（如非用户手势触发、参数不被接受）继续走剪贴板兜底
    }
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url)
    } else {
      legacyCopy(url)
    }
    return { ok: true, method: 'clipboard' }
  } catch (err: unknown) {
    return { ok: false, method: 'manual', error: (err as Error)?.message }
  }
}

/** 复制到剪贴板（不带系统分享面板），供"复制链接"按钮单独使用 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
    } else {
      legacyCopy(text)
    }
    return true
  } catch {
    return false
  }
}

/**
 * 兼容 file:// 与旧 WebView 的复制实现。
 * Electron 打包后页面由 file:// 加载，部分版本下 navigator.clipboard 不可用。
 */
function legacyCopy(text: string): void {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.top = '-1000px'
  ta.style.opacity = '0'
  document.body.appendChild(ta)

  ta.select()
  ta.setSelectionRange(0, ta.value.length)
  const ok = document.execCommand('copy')
  document.body.removeChild(ta)

  if (!ok) throw new Error('execCommand copy failed')
}
