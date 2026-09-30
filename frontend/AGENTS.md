# LogShare-Front-Template — 智能体协作与开发指南 (AGENTS.md)

## 项目架构与职责

- 本项目是提炼自 `LogShare-Web-UI` 与 `lemwood-mirror` 前台实践的前端通用起步模板脚手架，采用 **Vue 3.5 + TypeScript + Vite + Tailwind CSS + Phosphor Icons** 技术栈。
- 核心设计规范遵循 `DESIGN_SPEC.md`。核心 Tailwind Token 封装于根目录 `tailwind.preset.js`。
- 页面路由采用 `vue-router`（Hash 模式，兼容 Electron `file://` 加载），通过 `router.beforeEach` 自动结合 `src/lib/useSeoMeta.ts` 更新包括 `qq:share:*` 在内的多端社交分享元标签。
- 基础组件位于 `src/components/ui/`，布局容器位于 `src/components/layout/`，杜绝引入任何第三方沉重 UI 全家桶，保持零外部阻塞。

## 验证与构建命令

```bash
# 安装依赖
pnpm install

# 本地验证：由于缺少 /usr/bin/env，在 Termux 环境下若直接调用 pnpm 报错可直接使用 node 调用对应 bin：
node ./node_modules/vue-tsc/bin/vue-tsc.js -b
node ./node_modules/vite/bin/vite.js build
node ./node_modules/eslint/bin/eslint.js .

# 标准 CI / 本地开发命令：
pnpm dev
pnpm build
pnpm lint
```

## 设计与工程关键约束

1. **色彩规范**：严格遵循 Zinc / Slate 低饱和度冷灰体系，严禁引入高饱和度紫蓝粉渐变；全站暗黑模式基于 `.dark` 类切换。
2. **图标体系**：全站统一采用 `@phosphor-icons/vue` 且默认属性 `weight="duotone"`。在 `base.css` 中配置了 `svg[viewBox='0 0 256 256'] { scale: 1.2 }` 视窗留白补偿，禁止私自改动。
3. **动效规范**：所有过渡统一注入 `ease-bounce-soft`（`cubic-bezier(0.34, 1.7, 0.64, 1)`），严禁使用生硬的线性或无阻尼过渡。
4. **防溢出与滚动条**：`html, body { overflow-x: clip; }` 配合所有弹性容器 `[&>*]:min-w-0` 链路作为防横向溢出底线；细滚动条规范（6px 窄轨与半透明滑块）必须应用于所有可能横向滚动的表格与代码块。
5. **社交分享支持**：新增页面时必须调用 `useSeoMeta` 声明 `title` 与 `description`，确保 `qq:share:title`、`qq:share:description`、`og:*` 和 `twitter:*` 得到动态同步。
