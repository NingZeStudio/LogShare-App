# LogShare 前端设计范式与工程规范手册 (Design Spec)

> 本规范提炼自 **LogShare.CN** 与 **柠泽资源站 (Lemwood Mirror)** 的真实前台工程实践，旨在为现代工具类、开发者平台与开源社区项目提供一套**理性稳重、低饱和度冷灰、具备微动效物理质感**的通用前台设计与工程基线。

---

## 目录

1. [设计哲学与基本红线](#一设计哲学与基本红线)
2. [色彩系统与 Token 规范](#二色彩系统与-token-规范)
3. [空间排版与字体系统](#三空间排版与字体系统)
4. [微动效与交互物理学](#四微动效与交互物理学)
5. [防横向溢出与滚动条规范](#五防横向溢出与滚动条规范)
6. [组件设计模式与形态](#六组件设计模式与形态)
7. [社交元标签与分享矩阵](#七社交元标签与分享矩阵)
8. [工程约束与构建规范](#八工程约束与构建规范)

---

## 一、设计哲学与基本红线

### 1. 理性、克制与大国风范
* **拒绝轻佻与口语化**：界面文案、提示词与辅助描述要求书面化、平铺直叙，给用户提供可靠的工程严谨感。
* **低饱和度冷灰优先**：主界面一律采用 **Zinc / Slate** 冷灰低饱和度色系构建层次，严禁使用高饱和度紫蓝渐变（如 `#8b5cf6`）、蓝粉或红橘黄高烈度过渡。
* **去 Emoji 滥用**：尽可能少用或不用 Emoji 表情符号，图标统一采用专业非线性矢量图标库（**Phosphor Icons**），并默认启用 `duotone`（双色调）模式。

---

## 二、色彩系统与 Token 规范

所有基础颜色基于 HSL 色值声明于 CSS 变量中，通过 Tailwind preset 映射为原子类。

### 1. 语义化颜色变量

| Token 变量 | 亮色模式 (Light) | 暗色模式 (Dark) | 语义说明 |
| :--- | :--- | :--- | :--- |
| `--background` | `0 0% 100%` (纯白) | `222.2 84% 4.9%` (冷深蓝灰) | 页面全局底色 |
| `--foreground` | `222.2 84% 4.9%` | `210 40% 98%` | 主要正文字体色 |
| `--card` | `0 0% 100%` | `222.2 84% 4.9%` | 卡片与弹窗容器底色 |
| `--card-foreground` | `222.2 84% 4.9%` | `210 40% 98%` | 卡片内容文本色 |
| `--muted` | `210 40% 96.1%` (冷浅灰) | `217.2 32.6% 17.5%` | 弱化背景、浅色徽标 |
| `--muted-foreground` | `215.4 16.3% 46.9%` | `215 20.2% 65.1%` | 次要描述文案、图标副色 |
| `--border` / `--input` | `214.3 31.8% 91.4%` | `217.2 32.6% 17.5%` | 微阴影分割线、表单边框 |
| `--primary` | `222.2 47.4% 11.2%` | `210 40% 98%` | 核心强调色与主按钮底色 |
| `--destructive` | `0 84.2% 60.2%` | `0 62.8% 30.6%` | 警告与危险操作强调色 |

### 2. 终端沉浸式代码与日志配色
无论处于浅色还是深色模式，针对终端输出、日志浏览及关键代码展示区，**始终保留暗黑终端的沉浸质感**：
* 浅色模式：`--log-bg: #2a2a2a`、`--log-border: #3d3d3d`、`--log-code-bg: #1e1e1e`
* 暗色模式：`--log-bg: #10141d`、`--log-border: #232a38`、`--log-code-bg: #0d1117`

---

## 三、空间排版与字体系统

### 1. 自托管双字体矩阵
为杜绝外部 Web Font 导致的加载阻塞、闪烁（FOUT）或断网不可达问题，全站字体必须**本地自托管**：
1. **界面字体**：`HarmonyOS Sans SC`（自托管精简中文子集 + ASCII，400 常规 + 500/700 中粗两档 woff2）；
2. **等宽字体**：`SauceCode Mono`（400 / 500 / 600 / 700 四档字重，专为代码块、版本号、数据度量设计）。

### 2. 严密的 7 档圆角刻度 (Radius Scale)
从微观元器件到外部弹出层，全站保持严谨递进的圆角比例：
* `--radius-sm`: `0.25rem` (4px) — 紧凑型 Badge、微型标签
* `--radius-md`: `0.375rem` (6px) — 默认中等圆角
* `--radius-lg`: `0.5rem` (8px) — 标准输入框 (Input)、按钮 (Button)
* `--radius-xl`: `0.75rem` (12px) — 卡片容器 (Card)、通知框 (Toast)
* `--radius-2xl`: `1rem` (16px) — 弹窗容器 (Dialog)、功能看板
* `--radius-3xl`: `1.5rem` (24px) — 大幅 Hero 卡片
* `--radius-full`: `9999px` — 悬浮顶栏、药丸标签 (Capsule)

---

## 四、微动效与交互物理学

### 1. 标志性软阻尼回弹 (Spring Dynamics)
全站统一废弃默认的线性或机械式 ease-in-out，统一覆盖注入带有微弱物理回弹质感的阻尼缓动函数：
```css
/* Tailwind Class: ease-bounce-soft */
transition-timing-function: cubic-bezier(0.34, 1.7, 0.64, 1);
```
此动效应用于按钮点击（active:scale）、弹窗出入、主题滑块位移与抽屉展开。

### 2. 形变吸顶顶栏 (Fluid Morphing Header)
顶栏具备基于滚动深度的动态形变能力：
* **初始状态（页面顶部）**：
  * 高度 `h-14` (56px)；
  * 全宽直角平铺，弱边框分割或透明；
* **吸顶状态（`scrollY > 8`）**：
  * 高度收缩为 `h-12` (48px)；
  * 两侧各留白 `1rem`（`w-[calc(100%-2rem)]`，最大宽度锁定）；
  * 四周形变为全圆角胶囊（`rounded-full`）；
  * 激活毛玻璃模糊背景（`backdrop-blur-md bg-background/80`）与柔和阴影（`shadow-lg`）。

### 3. 实体物理平移切换器 (Physical Tab Capsule)
主题三态（浅色 / 深色 / 跟随系统）摒弃普通的文字或透明度切换，采用实体胶囊轨道：
* 外层为半透明圆角药丸轨道；
* 内部高亮白色/浅灰滑块使用绝对定位，通过 `transform: translateX(N px)` 在不同选项间真实滑动，具备实体开关的操纵手感。

### 4. 底部 Tab 导航 (Bottom Tab Navigation)
移动端主导航采用对齐移动 App 范式的底部 tab 栏（`BottomNav`），取代汉堡弹层菜单：
* **三个顶级 tab**：首页 / 历史 / 设置，由路由 `meta.tab` 标记控制显隐，详情、AI 分析等子页面自动隐藏，给内容让出整屏高度；
* **形态**：`fixed` 贴底、顶部微边框（`border-t border-border/60`）、毛玻璃背景（`bg-background/80 backdrop-blur-md`），与形变顶栏同属一套材质语言；
* **触控与激活态**：每个 tab 最小高度 56px（≥ 44px 触控下限），图标 22px `duotone` + 10px 标签；激活 tab 切换为 `text-primary` 并在顶部浮现 2px 强调短线；
* **安全区**：容器附加 `pb-safe`，避开 iPhone Home 指示条与安卓手势条；
* **桌面端豁免**：`md` 及以上断点始终隐藏，桌面端仍由顶栏水平链接导航，两端互不干扰；
* **内容避让**：tab 页主区域追加 `calc(3.5rem + safe-area)` 底部留白，Footer 在移动端 tab 页让位隐藏。

---

## 五、防横向溢出与滚动条规范

移动端宽表格与长代码块横向溢出是 Web 前端最普遍的痛点。LogShare 范式制定了强制性结构防线：

1. **页面层级裁剪**：
   ```css
   html, body {
     overflow-x: clip; /* clip 不会生成滚动上下文，绝对不破坏 position: sticky 顶栏 */
   }
   ```
2. **弹性布局防爆链路**：
   在所有 `flex` 子项链路上必须注入 `[&>*]:min-w-0`。因为 Flex item 默认 `min-width: auto`，内部代码块或长文字会强行将容器撑大撑出页面。
3. **统一细滚动条 (Slim Scrollbars)**：
   针对代码块与长表格的横向滚动，全站统一覆盖原生粗糙滚动条：
   ```css
   * {
     scrollbar-width: thin;
     scrollbar-color: hsl(var(--muted-foreground) / 0.3) transparent;
   }
   ::-webkit-scrollbar { width: 6px; height: 6px; }
   ::-webkit-scrollbar-thumb {
     background-color: hsl(var(--muted-foreground) / 0.3);
     border-radius: 3px;
   }
   ```

---

## 六、组件设计模式与形态

### 1. 多态按钮 (AppButton)
* 4 档尺寸：`sm` (h-7)、`md` (h-9)、`lg` (h-11)、`icon` (h-8 × w-8)；
* 语义变体：`primary`、`secondary`、`outline`、`ghost`、`soft`、`muted`、`destructive`、`soft-destructive`；
* 多态渲染：通过 `as` 属性在 `button`、`a`（外链自动附加 target 与 noopener）与 `router-link`（单页路由）间无缝切换。

### 2. 模态弹窗 (AppDialog)
* 基于 Vue 3 `Teleport` 挂载到 body 根层级；
* 默认包含半透明深黑遮罩与 backdrop-blur；
* 支持 `sm`、`md`、`lg`、`xl`、`2xl` 多档宽度自适应；
* 支持遮罩点击退出、ESC 键盘快捷退出与内置细滚动条。

### 3. 卡片化呈现原则
* 拒绝传统密集列表与单一枯燥大表格；
* 复杂数据优先拆解为轻边框卡片（`Card`）；
* 移动端与桌面端采用自适应双布局：桌面端单行展现、移动端自动折叠为卡片式大触控靶心。

---

## 七、社交元标签与分享矩阵

为保证在微信、QQ、Twitter (X)、Telegram 及各大浏览器中分享时均呈现精致卡片，遵循“双轨更新机制”：

### 1. 必备元标签清单
```html
<!-- Open Graph -->
<meta property="og:type" content="website" />
<meta property="og:title" content="页面标题 - 站点名" />
<meta property="og:description" content="页面描述" />
<meta property="og:image" content="https://example.com/cover.jpg" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="页面标题 - 站点名" />
<meta name="twitter:description" content="页面描述" />
<meta name="twitter:image" content="https://example.com/cover.jpg" />

<!-- QQ 分享专属适配标签 -->
<meta name="qq:share:title" content="页面标题 - 站点名" />
<meta name="qq:share:description" content="页面描述" />
<meta name="qq:share:image" content="https://example.com/cover.jpg" />
```

### 2. 客户端动态响应
单页路由（SPA）切换时，通过 `useSeoMeta` / `updateSeoMeta` 钩子自动更新 DOM 上的上述全部元标签，确保无需整页刷新即可实时同步分享卡片。

---

## 八、工程约束与构建规范

1. **依赖精简原则**：核心 UI 层零捆绑重型框架，纯基于 Vue 3 + Tailwind CSS + Phosphor Icons 驱动，打包体积极小。
2. **ASCII 猫爪构建报告**：构建脚本产出彩色的终端分类报告（按 JS、CSS、Fonts、Images 分组并标示 Gzip 压缩比率），便于直观把控包体积。
3. **跨端严谨测试**：修改组件或样式后，执行 `vue-tsc -b` 类型检查与 `eslint .` 代码质量扫描，保持 0 error 0 warning 基线。
