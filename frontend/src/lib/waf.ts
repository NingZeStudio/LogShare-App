/**
 * WAF 拦截的全局状态
 *
 * 与 toast 同一套路：由 lib/api.ts 在统一请求入口里写入，App.vue 挂一个
 * 全局 <WafBlockDialog> 消费。这样新增接口不用各自接线，也不会出现
 * 「忘了处理 WAF」的漏网点。
 *
 * 之所以不放进 api.ts 直接弹：api.ts 是纯数据层，不该持有 UI 引用；
 * 这里只存数据，渲染交给组件。
 */

import { ref } from 'vue'

export interface WafBlockPayload {
  /** 被拦截的请求地址 */
  url: string
  /** HTTP 状态码（通常是 403） */
  status: number
  /** 拦截卡片的原始 HTML，供用户查看/复制 */
  html: string
  /** 发生时间，用于去重与展示 */
  at: number
}

export const wafBlock = ref<WafBlockPayload | null>(null)

/** 记录一次拦截；重复触发时以最新一次为准 */
export function openWafBlock(payload: Omit<WafBlockPayload, 'at'>): void {
  wafBlock.value = { ...payload, at: Date.now() }
}

export function closeWafBlock(): void {
  wafBlock.value = null
}
