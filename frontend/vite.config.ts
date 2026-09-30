import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { gzipSync } from 'node:zlib'
import { statSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const CAT_PAW_ART = `
      |\\__/,|   (\`\\
    _.|o o  |_   ) )
  -(((---(((--------
`

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgMagenta: '\x1b[45m'
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'kB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function getSizeColor(bytes: number): string {
  if (bytes < 10 * 1024) return colors.green
  if (bytes < 50 * 1024) return colors.cyan
  if (bytes < 100 * 1024) return colors.yellow
  if (bytes < 500 * 1024) return colors.magenta
  return colors.red
}

function getFileTypeIcon(fileName: string): string {
  if (fileName.endsWith('.js')) return '[JS]'
  if (fileName.endsWith('.css')) return '[CSS]'
  if (fileName.endsWith('.html')) return '[HTML]'
  if (fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) return '[IMG]'
  if (fileName.endsWith('.woff2')) return '[FONT]'
  return '[FILE]'
}

function customBuildReportPlugin(): Plugin {
  let buildStartTime = 0

  return {
    name: 'custom-build-report',
    enforce: 'post',
    buildStart() {
      buildStartTime = Date.now()
    },
    closeBundle() {
      const buildTimeSec = ((Date.now() - buildStartTime) / 1000).toFixed(2)
      const distDir = resolve(process.cwd(), 'dist')

      const files: Array<{ name: string; size: number; gzipSize: number }> = []
      let totalSize = 0
      let totalGzipSize = 0

      const collectFiles = (dir: string, relativePath = '') => {
        try {
          const entries = readdirSync(dir, { withFileTypes: true })
          for (const entry of entries) {
            const fullPath = resolve(dir, entry.name)
            const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name

            if (entry.isDirectory()) {
              collectFiles(fullPath, relPath)
            } else if (entry.isFile()) {
              const size = statSync(fullPath).size
              let gzipSize = size
              try {
                const content = readFileSync(fullPath)
                gzipSize = gzipSync(content).length
              } catch {
                // 忽略非二进制压缩
              }

              files.push({ name: relPath, size, gzipSize })
              totalSize += size
              totalGzipSize += gzipSize
            }
          }
        } catch {
          // dist 目录不存在时直接返回
        }
      }

      collectFiles(distDir)
      if (files.length === 0) return

      const jsFiles = files.filter(f => f.name.endsWith('.js'))
      const cssFiles = files.filter(f => f.name.endsWith('.css'))
      const fontFiles = files.filter(f => f.name.endsWith('.woff2'))
      const otherFiles = files.filter(f => !jsFiles.includes(f) && !cssFiles.includes(f) && !fontFiles.includes(f))

      console.log('\n' + colors.bright + colors.bgMagenta + colors.white + '  LogShare Front UI 构建报告  ' + colors.reset)
      console.log(CAT_PAW_ART)
      console.log(colors.bright + colors.cyan + '=== 构建统计 ===' + colors.reset + '\n')
      console.log(colors.dim + '构建耗时:' + colors.reset, colors.yellow + buildTimeSec + 's' + colors.reset)
      console.log(colors.dim + '文件总数:' + colors.reset, colors.white + files.length + ' 个文件' + colors.reset)
      console.log(colors.dim + '原始大小:' + colors.reset, getSizeColor(totalSize) + formatBytes(totalSize) + colors.reset)
      console.log(colors.dim + 'Gzip 大小:' + colors.reset, getSizeColor(totalGzipSize) + formatBytes(totalGzipSize) + colors.reset)
      console.log(colors.dim + '压缩率:' + colors.reset, colors.green + ((1 - totalGzipSize / totalSize) * 100).toFixed(1) + '%' + colors.reset)
      console.log()

      const categories = [
        { name: 'JavaScript', files: jsFiles, icon: '[JS]', color: colors.yellow },
        { name: 'Stylesheets', files: cssFiles, icon: '[CSS]', color: colors.blue },
        { name: 'Fonts', files: fontFiles, icon: '[FONT]', color: colors.cyan },
        { name: 'Other', files: otherFiles, icon: '[FILE]', color: colors.white }
      ]

      for (const cat of categories) {
        if (cat.files.length === 0) continue
        const catSize = cat.files.reduce((sum, f) => sum + f.size, 0)
        const catGzipSize = cat.files.reduce((sum, f) => sum + f.gzipSize, 0)

        console.log(colors.bright + cat.color + `${cat.icon} ${cat.name}` + colors.reset)
        console.log(colors.dim + `  文件数：${cat.files.length} | 原始：${formatBytes(catSize)} | Gzip: ${formatBytes(catGzipSize)}` + colors.reset)

        cat.files.sort((a, b) => b.size - a.size).forEach(file => {
          const sizeColor = getSizeColor(file.size)
          const icon = getFileTypeIcon(file.name)
          const fileName = file.name.split('/').pop() || file.name
          console.log(colors.dim + `    ${icon}` + colors.reset, fileName, sizeColor + formatBytes(file.size).padStart(10) + colors.reset, colors.dim + `(gzip: ${formatBytes(file.gzipSize)})` + colors.reset)
        })
        console.log()
      }

      console.log(colors.bright + colors.green + '=== 构建完成！ ===' + colors.reset)
      console.log(colors.dim + '输出目录：' + colors.reset + colors.white + distDir + colors.reset + '\n')
    }
  }
}

export default defineConfig({
  base: './',
  plugins: [vue(), customBuildReportPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    outDir: '../electron/renderer',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: id => {
          if (id.includes('node_modules')) {
            if (/node_modules[\\/](@vue|vue|vue-router)[\\/]/.test(id)) {
              return 'vue-core'
            }
            if (id.includes('@phosphor-icons')) {
              return 'icons'
            }
            return 'vendor'
          }
        }
      }
    },
    chunkSizeWarningLimit: 500
  }
})
