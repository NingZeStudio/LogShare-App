<script setup lang="ts">
/**
 * 点阵背景（canvas 绘制）
 *
 * 用 canvas 而不是几千个 DOM 节点：1080p 下点阵约 5000+ 个点，
 * DOM 方案会拖慢首屏布局与滚动；canvas 只需一次性批量绘制 + 局部重绘。
 *
 * 四条硬性约束（都是踩过或必然踩的坑）：
 * 1. pointer-events-none —— 首页整块是拖拽上传区，背景绝不能吃掉拖放与点击
 * 2. prefers-reduced-motion —— 降级为静态绘制一次，不跑 rAF
 * 3. 主题切换要重绘 —— 圆点取 --muted-foreground，暗色模式必须跟着变
 * 4. 触屏不做指针高亮 —— 移动端没有 hover，白跑一个 60fps 循环只耗电
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 点间距（px）。越小越密，视觉上越"实" */
    gap?: number
    /** 点半径（px） */
    radius?: number
    /** 圆点基础不透明度 */
    opacity?: number
    /** 外缘径向渐隐，避免点阵像贴纸一样出现硬边 */
    fade?: boolean
    /** 指针附近高亮，仅在支持 hover 的设备生效 */
    glow?: boolean
    /** 高亮影响半径（px） */
    glowRadius?: number
    /** 高亮叠加的最大额外不透明度 */
    glowStrength?: number
  }>(),
  {
    gap: 22,
    radius: 1.15,
    opacity: 0.3,
    fade: true,
    glow: true,
    glowRadius: 150,
    glowStrength: 0.5
  }
)

const canvasRef = ref<HTMLCanvasElement | null>(null)

let ctx: CanvasRenderingContext2D | null = null
let ro: ResizeObserver | null = null
let mo: MutationObserver | null = null
let rafId = 0

let w = 0
let h = 0
/** 网格规模与居中偏移，由 measure() 维护 */
let cols = 0
let rows = 0
let offsetX = 0
let offsetY = 0
/** HSL 三元组，来自 --muted-foreground（形如 "215.4 16.3% 46.9%"） */
let hsl: [number, number, number] = [215, 16, 47]

/** 指针相对画布的坐标；-1 表示指针不在区域内 */
let px = -1
let py = -1
let hoverCapable = false
let reduceMotion = false
let dirty = false

const fadeStyle = computed(() => {
  if (!props.fade) return {}
  // 中心实心、边缘渐隐：点阵只作为底噪存在，不能抢内容
  const mask = 'radial-gradient(ellipse 85% 75% at 50% 45%, #000 35%, transparent 100%)'
  return { maskImage: mask, WebkitMaskImage: mask }
})

function readThemeColor() {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--muted-foreground')
    .trim()
  const parts = raw.split(/[\s,]+/)
  const a = parseFloat(parts[0] ?? '')
  const b = parseFloat(parts[1] ?? '')
  const c = parseFloat(parts[2] ?? '')
  if (Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c)) {
    hsl = [a, b, c]
  }
}

/**
 * 只算网格参数，不缓存点坐标数组。
 *
 * 直接按行列实时算 x/y：省掉一个几千长度的缓冲，也避开
 * noUncheckedIndexedAccess 下 Float32Array 下标返回 `number | undefined`
 * 的断言噪音。网格规模不大，实时算的开销可以忽略。
 */
function measure() {
  cols = Math.ceil(w / props.gap) + 1
  rows = Math.ceil(h / props.gap) + 1
  // 居中偏移，避免点阵左上角贴边、右下角留空
  offsetX = (w - (cols - 1) * props.gap) / 2
  offsetY = (h - (rows - 1) * props.gap) / 2
}

function resize() {
  const el = canvasRef.value
  if (!el) return

  const rect = el.getBoundingClientRect()
  w = rect.width
  h = rect.height
  if (w === 0 || h === 0) return

  // DPR 上限 2：再高只是徒增填充量，肉眼无差别
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  el.width = Math.round(w * dpr)
  el.height = Math.round(h * dpr)

  ctx = el.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)

  measure()
  draw()
}

function draw() {
  const c = ctx
  if (!c) return

  c.clearRect(0, 0, w, h)

  const [hh, ss, ll] = hsl
  const base = `hsl(${hh}, ${ss}%, ${ll}%)`
  const r = props.radius
  const gr = props.glowRadius
  const gap = props.gap
  const glowOn = props.glow && hoverCapable && !reduceMotion && px >= 0

  if (!glowOn) {
    // 静态：整批一个 path 一次 fill，最快
    c.globalAlpha = props.opacity
    c.fillStyle = base
    c.beginPath()
    for (let row = 0; row < rows; row++) {
      const y = offsetY + row * gap
      for (let col = 0; col < cols; col++) {
        const x = offsetX + col * gap
        c.moveTo(x + r, y)
        c.arc(x, y, r, 0, Math.PI * 2)
      }
    }
    c.fill()
    c.globalAlpha = 1
    return
  }

  // 底噪：排除高亮半径内的点，一次性批量填充
  c.globalAlpha = props.opacity
  c.fillStyle = base
  c.beginPath()
  for (let row = 0; row < rows; row++) {
    const y = offsetY + row * gap
    const dy = y - py
    for (let col = 0; col < cols; col++) {
      const x = offsetX + col * gap
      const dx = x - px
      if (dx * dx + dy * dy > gr * gr) {
        c.moveTo(x + r, y)
        c.arc(x, y, r, 0, Math.PI * 2)
      }
    }
  }
  c.fill()

  // 高亮：只遍历半径内的少数点，按距离衰减
  for (let row = 0; row < rows; row++) {
    const y = offsetY + row * gap
    const dy = y - py
    for (let col = 0; col < cols; col++) {
      const x = offsetX + col * gap
      const dx = x - px
      const d2 = dx * dx + dy * dy
      if (d2 > gr * gr) continue

      const t = 1 - Math.sqrt(d2) / gr
      c.globalAlpha = Math.min(1, props.opacity + t * t * props.glowStrength)
      c.beginPath()
      c.arc(x, y, r + t * 0.6, 0, Math.PI * 2)
      c.fill()
    }
  }
  c.globalAlpha = 1
}

function onPointerMove(e: PointerEvent) {
  const el = canvasRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height
  px = inside ? x : -1
  py = inside ? y : -1
  dirty = true
}

function resetPointer() {
  px = -1
  py = -1
  dirty = true
}

function loop() {
  rafId = requestAnimationFrame(loop)
  if (!dirty) return
  dirty = false
  draw()
}

onMounted(() => {
  hoverCapable = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  readThemeColor()
  resize()

  if (typeof ResizeObserver !== 'undefined' && canvasRef.value) {
    ro = new ResizeObserver(() => resize())
    ro.observe(canvasRef.value)
  }

  // 主题切换靠 documentElement 的 .dark 类，需要跟着重绘
  mo = new MutationObserver(() => {
    readThemeColor()
    draw()
  })
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

  if (props.glow && hoverCapable && !reduceMotion) {
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerleave', resetPointer, { passive: true })
    window.addEventListener('blur', resetPointer)
    rafId = requestAnimationFrame(loop)
  }
})

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
  ro?.disconnect()
  mo?.disconnect()
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerleave', resetPointer)
  window.removeEventListener('blur', resetPointer)
})

// 几何/配色参数变化后重建点阵
watch(
  () => [props.gap, props.radius, props.opacity, props.glow, props.glowRadius, props.glowStrength],
  () => {
    measure()
    draw()
  }
)
</script>

<template>
  <div
    class="pointer-events-none absolute inset-0 overflow-hidden"
    :style="fadeStyle"
    aria-hidden="true"
  >
    <canvas ref="canvasRef" class="block h-full w-full" />
  </div>
</template>
