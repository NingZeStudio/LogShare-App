/**
 * Brotli 压缩封装。
 *
 * wasm 以 base64 内联在 vendor/brotli-wasm-inline.js（约 1.4MB），
 * 懒加载：仅在首次遇到 ≥1KiB 的请求体时才下载并实例化，避免拖累首屏。
 * init() 直接从字节实例化（BufferSource 路径），不 fetch —— 兼容 Electron file:// 与 Android WebView。
 *
 * 失败语义：任何一步失败都返回 null，调用方（api.ts）回落 gzip / 原样上传。
 */
let cached: Promise<BrotliModule | null> | null = null

/** Uint8Array<ArrayBuffer> 才能赋给 fetch 的 BodyInit（TS 5.9 的 ArrayBufferLike 泛型坑） */
export type CompactBytes = Uint8Array<ArrayBuffer>

type BrotliModule = {
  compress: (buf: Uint8Array, options?: { quality?: number }) => Uint8Array
  decompress: (buf: Uint8Array) => Uint8Array
}

async function loadBrotli(): Promise<BrotliModule | null> {
  try {
    // 动态 import → Vite 会把它单独切 chunk，首屏不加载
    const mod = await import('@/vendor/brotli-wasm-inline')
    // 内联的 base64 在 vendor 模块里，init 从字节直接实例化（BufferSource 路径），
    // 绝不 fetch —— 兼容 Electron file:// 与 Android WebView。
    const bytes = Uint8Array.from(atob(mod.WASM_BASE64), (c) => c.charCodeAt(0))
    await mod.brotliInit(bytes)
    return {
      compress: (buf, options) => mod.compress(buf, options),
      decompress: (buf) => mod.decompress(buf)
    }
  } catch (err) {
    console.warn('[brotli] 初始化失败，回落 gzip:', err)
    return null
  }
}

export function getBrotli(): Promise<BrotliModule | null> {
  cached ??= loadBrotli()
  return cached
}

/**
 * 压缩为 brotli。失败返回 null（调用方回落 gzip）。
 * quality 5：压缩率与耗时的平衡点（q9 耗时约 2 倍、体积仅小 2-3%）。
 */
export async function brotliCompress(data: Uint8Array): Promise<CompactBytes | null> {
  const mod = await getBrotli()
  if (!mod) return null
  try {
    return mod.compress(data, { quality: 5 }) as CompactBytes
  } catch (err) {
    console.warn('[brotli] 压缩失败，回落 gzip:', err)
    return null
  }
}
