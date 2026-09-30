const { app, BrowserWindow, shell, ipcMain, dialog, Menu } = require('electron')
const path = require('path')
const fs = require('fs')

let mainWindow = null

// 应用菜单：Windows/Linux 直接移除，界面更干净；
// macOS 必须保留最小菜单，否则 Cmd+C/V、Cmd+Q 等系统级快捷键会失效。
function setupApplicationMenu() {
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { role: 'appMenu' },
      { role: 'editMenu' },
      { role: 'windowMenu' }
    ]))
  } else {
    Menu.setApplicationMenu(null)
  }
}

// ---------- 文件关联：双击 .log / .logs 用本应用打开 ----------

// 可被关联打开的文件扩展名（与 dialog:openFile 的过滤器保持一致）
const OPENABLE_EXTS = [
  '.log', '.logs', '.txt', '.yml', '.yaml', '.json',
  '.xml', '.cfg', '.conf', '.properties', '.toml'
]

// 渲染层是否已就绪。未就绪时到达的文件先入队，等渲染层来取
let rendererReady = false
const pendingFiles = []

/**
 * 从命令行参数中找出待打开的日志文件路径。
 * 需跳过 electron 可执行文件、开发模式下的应用目录，以及各种开关（以 - 开头）。
 */
function extractFileFromArgv(argv) {
  if (!Array.isArray(argv)) return null
  for (const arg of argv.slice(1)) {
    if (typeof arg !== 'string' || arg.length === 0 || arg.startsWith('-')) continue
    if (!OPENABLE_EXTS.includes(path.extname(arg).toLowerCase())) continue
    try {
      if (fs.statSync(arg).isFile()) return path.resolve(arg)
    } catch { /* 路径不存在或不可读，继续找下一个 */ }
  }
  return null
}

/** 读取单个日志文件；失败返回 null（不抛错，避免影响其余文件） */
async function readLogFile(filePath) {
  try {
    const stat = await fs.promises.stat(filePath)
    if (!stat.isFile()) return null
    const name = path.basename(filePath)
    if (name.toLowerCase().endsWith('.zip')) {
      // ZIP 直接读取为 base64，由渲染层决定如何处理
      const buffer = await fs.promises.readFile(filePath)
      return { name, path: filePath, size: stat.size, isZip: true, base64: buffer.toString('base64') }
    }
    const content = await fs.promises.readFile(filePath, 'utf-8')
    return { name, path: filePath, size: stat.size, content }
  } catch {
    return null
  }
}

/** 把文件推给渲染层；渲染层未就绪则先入队 */
function deliverFiles(files) {
  if (files.length === 0) return
  if (rendererReady && mainWindow && !mainWindow.isDestroyed()) {
    for (const file of files) mainWindow.webContents.send('file:open', file)
  } else {
    pendingFiles.push(...files)
  }
}

/** 打开一个被关联的日志文件（冷启动 / 二次启动 / macOS open-file 共用） */
async function openAssociatedFile(filePath) {
  if (!filePath) return
  const file = await readLogFile(filePath)
  if (file) deliverFiles([file])
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 720,
    minHeight: 500,
    title: 'LogShare.CN',
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default'
  })

  // 页面真实重载后，渲染层的 file:open 监听会失效，需要重新等待就绪信号。
  // 必须用 did-navigate（仅主框架真实导航触发）：
  // did-start-loading 在本应用里会被接口请求/懒加载 chunk 反复误触发，
  // 会把 rendererReady 永久打回 false，导致后续文件被塞进队列再无人消费。
  // 哈希路由切换走 did-navigate-in-page，不会触发这里，故不会误伤。
  mainWindow.webContents.on('did-navigate', () => {
    rendererReady = false
  })

  // 开发模式加载 dev server，生产模式加载打包文件
  const isDev = process.env.LOGSHARE_DEV === '1'
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
    // 菜单已移除，F12 等默认加速键随之失效，开发模式补一个便于重新打开 DevTools
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') {
        mainWindow.webContents.toggleDevTools()
        event.preventDefault()
      }
    })
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // 外部链接在系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  // 阻止渲染进程被导航到应用外部地址（外链交给系统浏览器）
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowedPrefix = isDev ? 'http://localhost:5173' : 'file://'
    if (!url.startsWith(allowedPrefix)) {
      event.preventDefault()
      if (url.startsWith('http://') || url.startsWith('https://')) {
        shell.openExternal(url)
      }
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    rendererReady = false
  })
}

// 文件选择对话框
ipcMain.handle('dialog:openFile', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择日志文件',
    filters: [
      { name: '日志文件', extensions: ['txt', 'log', 'logs', 'yml', 'yaml', 'json', 'xml', 'cfg', 'conf', 'properties', 'toml'] },
      { name: '压缩包', extensions: ['zip'] },
      { name: '所有文件', extensions: ['*'] }
    ],
    properties: ['openFile', 'multiSelections']
  })
  if (result.canceled || result.filePaths.length === 0) return null

  const files = []
  for (const filePath of result.filePaths) {
    // 单个文件读取失败时跳过，不影响其余文件
    const file = await readLogFile(filePath)
    if (file) files.push(file)
  }
  return files
})

// 保存文件到本地（目标路径由用户在系统保存对话框中确认）
ipcMain.handle('file:save', async (_event, defaultName, content) => {
  if (!mainWindow) return { success: false, error: '窗口未就绪' }
  if (typeof content !== 'string') return { success: false, error: '内容格式错误' }
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存日志文件',
    defaultPath: defaultName,
    filters: [
      { name: '文本文件', extensions: ['txt', 'log'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })
  if (result.canceled || !result.filePath) return { success: false, error: '用户取消' }
  try {
    await fs.promises.writeFile(result.filePath, content, 'utf-8')
    return { success: true, path: result.filePath }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// 本地历史记录存储
const getHistoryFile = () => path.join(app.getPath('userData'), 'logshare_history.json')

function loadHistory() {
  try {
    const file = getHistoryFile()
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'))
      if (Array.isArray(data)) return data
    }
  } catch { /* ignore */ }
  return []
}

function saveHistory(history) {
  try {
    fs.writeFileSync(getHistoryFile(), JSON.stringify(history, null, 2), 'utf-8')
  } catch { /* ignore */ }
}

ipcMain.handle('history:get', async () => {
  return loadHistory()
})

ipcMain.handle('history:add', async (_event, entry) => {
  if (!entry || typeof entry.id !== 'string' || !entry.id) {
    return { success: false, error: '无效的记录' }
  }
  const history = loadHistory()
  // 避免重复
  const idx = history.findIndex(h => h.id === entry.id)
  if (idx >= 0) {
    history[idx] = entry
  } else {
    history.unshift(entry)
    if (history.length > 100) history.pop()
  }
  saveHistory(history)
  return { success: true }
})

ipcMain.handle('history:remove', async (_event, id) => {
  const history = loadHistory()
  const filtered = history.filter(h => h.id !== id)
  saveHistory(filtered)
  return { success: true }
})

ipcMain.handle('history:clear', async () => {
  saveHistory([])
  return { success: true }
})

// 文件关联：渲染层完成监听注册后调用，取回积压的待打开文件
ipcMain.handle('file:rendererReady', async () => {
  rendererReady = true
  return pendingFiles.splice(0)
})

// ---------- JVM / Minecraft 崩溃日志自动检查（实验性，仅桌面端） ----------

// 崩溃日志文件名模式：JVM 致命错误、崩溃重放、MC 崩溃报告
const CRASH_NAME_PATTERNS = [
  /^hs_err_pid\d+\.log$/i,
  /^replay_pid\d+\.log$/i,
  /^crash-report.*\.txt$/i,
  /^crash-\d{4}-\d{2}-\d{2}.*\.txt$/i
]

function isCrashFileName(name) {
  return CRASH_NAME_PATTERNS.some((re) => re.test(name))
}

let crashWatcher = null
let crashWatchDir = ''

function stopCrashWatch() {
  if (crashWatcher) {
    try { crashWatcher.close() } catch { /* ignore */ }
    crashWatcher = null
  }
  crashWatchDir = ''
}

function startCrashWatch(dir) {
  stopCrashWatch()
  if (!dir || typeof dir !== 'string') return { ok: false, error: '未指定监听目录' }
  try {
    if (!fs.statSync(dir).isDirectory()) return { ok: false, error: '路径不是目录' }
  } catch {
    return { ok: false, error: '目录不存在或不可访问' }
  }

  crashWatchDir = dir
  try {
    // recursive 递归监听子目录（Windows / macOS 原生支持）
    crashWatcher = fs.watch(dir, { recursive: true }, (_eventType, filename) => {
      if (!filename) return
      const base = path.basename(filename)
      if (!isCrashFileName(base)) return
      // 文件可能仍在写入，稍等片刻再读取
      setTimeout(() => {
        const full = path.join(dir, filename)
        try {
          const stat = fs.statSync(full)
          if (!stat.isFile()) return
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('crash:detected', {
              name: base,
              path: full,
              size: stat.size,
              dir
            })
          }
        } catch { /* 文件可能已被移走 */ }
      }, 800)
    })
    return { ok: true, dir }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

/** 扫描目录内既有的崩溃日志（不递归，只看顶层与常见子目录） */
async function scanCrashDir(dir) {
  const out = []
  const visit = async (d) => {
    let entries
    try {
      entries = await fs.promises.readdir(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = path.join(d, e.name)
      if (e.isFile() && isCrashFileName(e.name)) {
        try {
          const stat = await fs.promises.stat(full)
          out.push({ name: e.name, path: full, size: stat.size, dir: d })
        } catch { /* ignore */ }
      }
    }
  }
  if (!dir) return out
  await visit(dir)
  // 兼顾常见子目录
  for (const sub of ['crash-reports', 'logs']) {
    await visit(path.join(dir, sub))
  }
  return out
}

/** 校验目标文件确实位于监听目录之内（防越权读取任意路径） */
function isInsideDir(filePath, dir) {
  if (!dir) return false
  const rel = path.relative(dir, filePath)
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel)
}

ipcMain.handle('crash:watch:start', async (_event, dir) => startCrashWatch(dir))

ipcMain.handle('crash:watch:stop', async () => {
  stopCrashWatch()
  return { ok: true }
})

ipcMain.handle('crash:scan', async (_event, dir) => scanCrashDir(dir))

ipcMain.handle('crash:pickDir', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择要监听的目录（如 .minecraft 或服务器根目录）',
    properties: ['openDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

// 读取崩溃日志内容（限定在监听目录内）
ipcMain.handle('crash:read', async (_event, filePath) => {
  if (typeof filePath !== 'string' || !isInsideDir(filePath, crashWatchDir)) {
    return { success: false, error: '路径不在监听目录内' }
  }
  try {
    const [content, stat] = await Promise.all([
      fs.promises.readFile(filePath, 'utf-8'),
      fs.promises.stat(filePath)
    ])
    return { success: true, name: path.basename(filePath), content, size: stat.size }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// 退出时清理监听
app.on('before-quit', stopCrashWatch)

// 单实例：再次双击关联文件时，把文件交给已有窗口，而不是再开一个窗口
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const filePath = extractFileFromArgv(argv)
    if (filePath) openAssociatedFile(filePath)
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  // macOS：Finder 双击或拖到 Dock 图标时由此送达（可能在 ready 之前触发）
  app.on('open-file', (event, filePath) => {
    event.preventDefault()
    openAssociatedFile(filePath)
  })

  // 冷启动时命令行里带的文件：Windows / Linux 双击关联文件即走这里
  const startupFile = extractFileFromArgv(process.argv)

  app.whenReady().then(() => {
    setupApplicationMenu()
    createWindow()
    if (startupFile) openAssociatedFile(startupFile)
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
