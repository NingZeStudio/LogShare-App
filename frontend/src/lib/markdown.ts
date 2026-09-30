/**
 * Markdown 渲染（AI 报告正文专用）
 *
 * 用 markdown-it（与线上开源版 LogShare-Web-UI 同款）渲染，覆盖完整标准语法：
 * 标题、粗/斜体、行内代码、代码块、有序/无序/嵌套列表、表格、引用块、分隔线、
 * 链接等。此前手写的极简渲染器只覆盖少数语法，deep 模式报告里的表格会直接
 * 渲染成原始竖线文本，多行代码块内部也会被段落规则误包 <p>。
 *
 * **安全**：
 * - `html: false` —— 不渲染原始 HTML。AI 输出会回显日志中的玩家名 / 聊天 / MOTD
 *   等可被第三方控制的内容，若夹带 <script> / <img onerror> 会形成 XSS，
 *   在桌面端还可能借 preload 暴露的能力访问本地文件。html:false 会把它们当
 *   纯文本转义，从根上堵死。
 * - markdown-it 默认的链接校验已拦截 javascript:/vbscript: 等危险协议。
 */
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
  html: false,
  linkify: false,
  breaks: false
})

export function renderMarkdown(text: string): string {
  if (!text) return ''
  return md.render(text)
}
