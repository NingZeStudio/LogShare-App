const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('logshareAPI', {
  // 文件选择
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  // 保存文件
  saveFile: (defaultName, content) => ipcRenderer.invoke('file:save', defaultName, content),
  // 历史记录
  getHistory: () => ipcRenderer.invoke('history:get'),
  addHistory: (entry) => ipcRenderer.invoke('history:add', entry),
  removeHistory: (id) => ipcRenderer.invoke('history:remove', id),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  // 文件关联（双击 .log / .logs 打开）：订阅主进程推送，返回取消订阅函数
  onOpenFile: (callback) => {
    if (typeof callback !== 'function') return () => {}
    const listener = (_event, file) => callback(file)
    ipcRenderer.on('file:open', listener)
    return () => ipcRenderer.removeListener('file:open', listener)
  },
  // 通知主进程渲染层已就绪，并取回启动时积压的待打开文件
  rendererReady: () => ipcRenderer.invoke('file:rendererReady'),
  // JVM 崩溃日志自动检查（实验性）
  crashWatchStart: (dir) => ipcRenderer.invoke('crash:watch:start', dir),
  crashWatchStop: () => ipcRenderer.invoke('crash:watch:stop'),
  crashScan: (dir) => ipcRenderer.invoke('crash:scan', dir),
  crashPickDir: () => ipcRenderer.invoke('crash:pickDir'),
  crashRead: (filePath) => ipcRenderer.invoke('crash:read', filePath),
  onCrashDetected: (callback) => {
    if (typeof callback !== 'function') return () => {}
    const listener = (_event, data) => callback(data)
    ipcRenderer.on('crash:detected', listener)
    return () => ipcRenderer.removeListener('crash:detected', listener)
  },
  // 平台信息
  platform: process.platform,
  isElectron: true
})
