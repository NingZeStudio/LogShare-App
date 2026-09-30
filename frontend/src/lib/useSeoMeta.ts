/**
 * SEO 与社交分享元标签统一管理器
 * 支持：title, description, image
 * 同步更新：document.title, og:*, twitter:*, 以及 QQ 分享元标签 (qq:share:*)
 */

const ensureMeta = (attr: 'name' | 'property', key: string): HTMLMetaElement => {
  const selector = `meta[${attr}="${key}"]`
  let el = document.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  return el
}

export interface SeoMetaOptions {
  title: string
  description?: string
  image?: string
  fullTitle?: boolean
}

export function updateSeoMeta(options: SeoMetaOptions, siteName = 'LogShare Front'): void {
  if (typeof document === 'undefined') return

  const { title, description, image, fullTitle = false } = options
  const finalTitle = fullTitle || !siteName ? title : `${title} - ${siteName}`

  document.title = finalTitle

  // 社交分享标题
  ensureMeta('property', 'og:title').setAttribute('content', finalTitle)
  ensureMeta('name', 'twitter:title').setAttribute('content', finalTitle)
  ensureMeta('name', 'qq:share:title').setAttribute('content', finalTitle)

  // 社交分享描述
  if (description) {
    ensureMeta('name', 'description').setAttribute('content', description)
    ensureMeta('property', 'og:description').setAttribute('content', description)
    ensureMeta('name', 'twitter:description').setAttribute('content', description)
    ensureMeta('name', 'qq:share:description').setAttribute('content', description)
  }

  // 社交分享图片
  if (image) {
    ensureMeta('property', 'og:image').setAttribute('content', image)
    ensureMeta('name', 'twitter:image').setAttribute('content', image)
    ensureMeta('name', 'qq:share:image').setAttribute('content', image)
  }
}

export function useSeoMeta(options: SeoMetaOptions, siteName?: string): () => void {
  return () => {
    updateSeoMeta(options, siteName)
  }
}
