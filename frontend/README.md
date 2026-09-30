# LogShare Front Template

> **LogShare 前台设计范式起步模板**：专为现代工具类、开发者平台与开源社区项目打造的 Vue 3 + Tailwind CSS + TypeScript 前台脚手架。
> 
> 界面遵循低饱和度冷灰阶风格，内置自研物理回弹动效、形变毛玻璃吸顶顶栏、实体平移主题胶囊、全端防横向溢出体系与社交元标签矩阵。

---

## 🌟 特性概览

- 🎨 **低饱和度冷灰美学**：基于 Zinc / Slate 深度语义化设计，无高饱和渐变，专业克制、沉静耐看。
- ⚡ **物理回弹微动效**：全站统一注入 `ease-bounce-soft`（`cubic-bezier(0.34, 1.7, 0.64, 1)`），告别僵硬的机械过渡。
- 🪄 **形变吸顶顶栏 (Header)**：滚动时自适应从全宽平铺条平滑收缩为全圆角毛玻璃悬浮胶囊。
- 🌓 **物理平移三态主题**：浅色 / 深色 / 跟随系统，内部高亮滑块沿轨道物理平移（TranslateX）。
- 🔤 **自托管零阻塞字体**：预打包 HarmonyOS Sans SC 常用汉字子集与 SauceCode Mono 等宽字体，零外部网络阻塞。
- 🛡️ **全站横向防溢出体系**：`overflow-x: clip` 与 `min-w-0` 弹性链路深度加固，长文件名与代码块不撑裂页面。
- 🎚️ **统一细滚动条 (Slim Scrollbar)**：6px 窄轨与半透明滑块，优化代码块与长表格的横向滚动视觉。
- 📱 **社交分享元标签矩阵**：内置 Open Graph、Twitter Card 以及专属的 **QQ 分享元标签 (`qq:share:*`)**，单页路由动态响应。
- 🧩 **开箱即用轻量组件**：多态 `AppButton`、Teleport `AppDialog`、无依赖全局 `Toast`、`Card`、`Badge`。
- 🐱 **ASCII 炫彩构建报告**：构建时输出文件分类明细、体积排行与 Gzip 压缩比率。

---

## 📂 项目结构

```text
├── public/                       # 静态资源与 Favicon 图标
├── src/
│   ├── assets/
│   │   ├── fonts/                # 自托管 HarmonyOS Sans 与 SauceCode Mono 字体包
│   │   └── styles/               # 全局样式（base.css、fonts.css、index.css）
│   ├── components/
│   │   ├── layout/               # 布局组件（Header, Footer, ThemeToggle）
│   │   └── ui/                   # 核心基础 UI 组件（AppButton, AppDialog, ToastHost, Card, Badge）
│   ├── lib/                      # 工具库（useSeoMeta, toast, config）
│   ├── router/                   # 路由定义与全局 SEO 元标签守卫
│   ├── views/                    # 页面视图（HomeView, ShowcaseView, NotFoundView）
│   ├── App.vue                   # 根组件（含页面级微回弹过渡）
│   └── main.ts                   # 应用入口
├── tailwind.preset.js            # 可导出的 LogShare Tailwind 核心设计预设
├── tailwind.config.js            # Tailwind 项目配置文件
├── DESIGN_SPEC.md                # 完整的设计范式与工程规范手册
├── AGENTS.md                     # 上下文与开发约定规范
├── vite.config.ts                # Vite 配置与自定义构建报告插件
└── package.json
```

---

## 🚀 快速上手

### 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0 (推荐使用 pnpm)

### 安装依赖并启动

```bash
# 1. 克隆或复制项目进入目录
cd LogShare-Front-Template

# 2. 安装依赖
pnpm install

# 3. 启动本地开发服务
pnpm dev

# 4. 构建生产产物（自动运行 vue-tsc 类型检查与 Vite 打包）
pnpm build

# 5. 代码质量检查
pnpm lint
```

---

## 📦 如何在现有项目中复用这套预设？

如果你已经有现成的前端项目，希望引入 LogShare 的设计体系：

### 1. 继承 Tailwind 预设 (`tailwind.preset.js`)

直接将本项目根目录下的 `tailwind.preset.js` 复制到你的项目中，并在 `tailwind.config.js` 中引入：

```javascript
import logSharePreset from './tailwind.preset.js'

export default {
  presets: [logSharePreset],
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}']
}
```

### 2. 引入基础 CSS 与细滚动条 (`src/assets/styles/base.css`)

将 `base.css` 引入你的全局样式表中，即可自动获得：
- 7 档圆角变量；
- 6px 细滚动条；
- 全站横向溢出兜底；
- Phosphor 图标尺寸补偿；
- 全局回弹缓动曲线。

---

## 📄 设计与规范手册

更多详尽的视觉哲学、色彩 Token、圆角阶梯以及组件开发原则，请参阅：
👉 [**DESIGN_SPEC.md**](./DESIGN_SPEC.md)

---

## 📜 开源协议

本项目基于 [MIT 许可证](./LICENSE) 开源。
