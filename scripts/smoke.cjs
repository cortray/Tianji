// 冒烟测试：加载生产构建的渲染进程，检查 React 是否成功渲染、有无控制台错误
const { app, BrowserWindow, ipcMain } = require('electron')
const { join } = require('path')

// 注册 renderer 可能调用的 dummy handlers（真实应用由 src/main 注册）
ipcMain.handle('config:load', () =>
  JSON.stringify({
    providers: [
      {
        id: 'deepseek',
        name: 'DeepSeek',
        baseURL: 'https://api.deepseek.com/v1',
        model: 'deepseek-chat',
        apiKeys: [],
        enabled: true,
        priority: 0,
        createdAt: Date.now()
      }
    ],
    ha: { firstTokenTimeoutMs: 30000, maxFailovers: 3 },
    theme: 'dark',
    version: 1
  })
)
ipcMain.handle('config:save', () => {})
ipcMain.handle('skills:list-user', () => [])
ipcMain.handle('skills:pick-files', () => [])

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: join(__dirname, '../out/preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const errors = []

  win.webContents.on('console-message', (event) => {
    const { level, message } = event
    // level: 0 verbose, 1 info, 2 warning, 3 error
    if (level >= 3) errors.push(message)
  })
  win.webContents.on('did-fail-load', (_e, code, desc) => {
    errors.push(`did-fail-load: ${code} ${desc}`)
  })

  win.loadFile(join(__dirname, '../out/renderer/index.html'))

  win.webContents.once('did-finish-load', () => {
    setTimeout(async () => {
      try {
        const hasRoot = await win.webContents.executeJavaScript(
          "document.getElementById('root') && document.getElementById('root').children.length > 0"
        )
        const title = await win.webContents.executeJavaScript('document.title')
        console.log('page title:', title)
        console.log('root rendered:', hasRoot)
        if (errors.length > 0) {
          console.log('console errors:\n' + errors.join('\n'))
          app.exit(1)
        } else if (!hasRoot) {
          console.log('FAIL: root not rendered')
          app.exit(1)
        } else {
          console.log('SMOKE OK')
          app.exit(0)
        }
      } catch (err) {
        console.log('smoke exception:', err)
        app.exit(1)
      }
    }, 3000)
  })
})
