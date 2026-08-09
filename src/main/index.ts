import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { readFile, readdir, writeFile, unlink, mkdir, copyFile, cp, access } from 'fs/promises'
import { basename, join } from 'path'
import { loadConfig, saveConfig } from './store'
import { registerAiIpc } from './ai'

/**
 * 更名迁移：包名历史为 mingli → zhiming → tianji（userData 目录随之变化）。
 * 启动时检查旧目录（按优先级 mingli / zhiming），将第一个存在且非空的
 * 旧目录数据复制到当前新目录（仅当新目录尚不存在时执行一次）。
 */
async function migrateUserData(): Promise<void> {
  const newDir = app.getPath('userData')
  try {
    await access(newDir)
    return // 新目录已有数据，不迁移
  } catch {
    /* 新目录不存在，继续 */
  }
  const appData = app.getPath('appData')
  for (const oldName of ['mingli', 'zhiming']) {
    const oldDir = join(appData, oldName)
    if (oldDir === newDir) continue
    try {
      const entries = await readdir(oldDir, { withFileTypes: true })
      if (entries.length === 0) continue
      await mkdir(newDir, { recursive: true })
      let copied = 0
      for (const e of entries) {
        const src = join(oldDir, e.name)
        const dst = join(newDir, e.name)
        try {
          if (e.isDirectory()) await cp(src, dst, { recursive: true })
          else await copyFile(src, dst)
          copied++
        } catch {
          /* 单个条目失败跳过 */
        }
      }
      if (copied > 0) {
        console.log(`[tianji] 已迁移 ${copied} 项用户数据：${oldDir} → ${newDir}`)
      }
      return
    } catch {
      /* 该旧目录不存在或不可读，尝试下一个 */
    }
  }
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#09090b',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  mainWindow = win

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler((details) => {
    const url = new URL(details.url)
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function isTrustedSender(event: Electron.IpcMainInvokeEvent): boolean {
  return !!mainWindow && event.sender.id === mainWindow.webContents.id
}

function registerIpc(): void {
  // 配置读写（apiKeys 由 store 加密落盘）
  ipcMain.handle('config:load', async (event) => {
    if (!isTrustedSender(event)) return null
    const cfg = await loadConfig()
    return JSON.stringify(cfg)
  })

  ipcMain.handle('config:save', async (event, json: string) => {
    if (!isTrustedSender(event) || typeof json !== 'string') return
    const cfg = JSON.parse(json)
    await saveConfig(cfg)
  })

  // 技能文件导入（多选 .md）
  ipcMain.handle('skills:pick-files', async (event) => {
    if (!isTrustedSender(event) || !mainWindow) return []
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择技能 Markdown 文件',
      filters: [
        { name: 'Markdown', extensions: ['md', 'markdown'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['openFile', 'multiSelections']
    })
    if (result.canceled) return []
    const files: { name: string; content: string }[] = []
    for (const filePath of result.filePaths) {
      try {
        const content = await readFile(filePath, 'utf-8')
        files.push({ name: basename(filePath), content })
      } catch {
        /* 跳过读取失败的文件 */
      }
    }
    return files
  })

  // 用户技能持久化（userData/skills/*.md）
  const skillsDir = (): string => join(app.getPath('userData'), 'skills')
  const safeId = (id: string): string => String(id).replace(/[^a-zA-Z0-9_-]/g, '_')

  ipcMain.handle('skills:list-user', async (event) => {
    if (!isTrustedSender(event)) return []
    try {
      const files = await readdir(skillsDir())
      const out: { name: string; content: string }[] = []
      for (const f of files) {
        if (!f.endsWith('.md')) continue
        try {
          const content = await readFile(join(skillsDir(), f), 'utf-8')
          out.push({ name: f, content })
        } catch {
          /* 跳过损坏文件 */
        }
      }
      return out
    } catch {
      return []
    }
  })

  ipcMain.handle('skills:save-user', async (event, id: string, content: string) => {
    if (!isTrustedSender(event) || typeof id !== 'string' || typeof content !== 'string') return
    await mkdir(skillsDir(), { recursive: true })
    await writeFile(join(skillsDir(), safeId(id) + '.md'), content, 'utf-8')
  })

  ipcMain.handle('skills:delete-user', async (event, id: string) => {
    if (!isTrustedSender(event) || typeof id !== 'string') return
    await unlink(join(skillsDir(), safeId(id) + '.md')).catch(() => {})
  })

  // 会话与排盘历史持久化（userData/*.json）
  const readJson = async <T>(file: string, fallback: T): Promise<T> => {
    try {
      return JSON.parse(await readFile(join(app.getPath('userData'), file), 'utf-8')) as T
    } catch {
      return fallback
    }
  }
  const writeJson = async (file: string, data: unknown): Promise<void> => {
    await mkdir(app.getPath('userData'), { recursive: true })
    await writeFile(join(app.getPath('userData'), file), JSON.stringify(data, null, 2), 'utf-8')
  }

  ipcMain.handle('chats:list', async (event) => {
    if (!isTrustedSender(event)) return []
    return readJson<unknown[]>('chats.json', [])
  })
  ipcMain.handle('chats:save', async (event, session: unknown) => {
    if (!isTrustedSender(event) || !session) return
    const list = await readJson<{ id: string }[]>('chats.json', [])
    const idx = list.findIndex((s) => s.id === (session as { id: string }).id)
    if (idx >= 0) list[idx] = session as never
    else list.unshift(session as never)
    await writeJson('chats.json', list)
  })
  ipcMain.handle('chats:delete', async (event, id: string) => {
    if (!isTrustedSender(event) || typeof id !== 'string') return
    const list = await readJson<{ id: string }[]>('chats.json', [])
    await writeJson('chats.json', list.filter((s) => s.id !== id))
  })

  ipcMain.handle('bazi:list', async (event) => {
    if (!isTrustedSender(event)) return []
    return readJson<unknown[]>('bazi-history.json', [])
  })
  ipcMain.handle('bazi:save', async (event, record: unknown) => {
    if (!isTrustedSender(event) || !record) return
    const list = await readJson<{ id: string }[]>('bazi-history.json', [])
    const idx = list.findIndex((r) => r.id === (record as { id: string }).id)
    if (idx >= 0) list[idx] = record as never
    else list.unshift(record as never)
    // 最多保留 30 条
    const trimmed = list.slice(0, 30)
    await writeJson('bazi-history.json', trimmed)
  })
  ipcMain.handle('bazi:delete', async (event, id: string) => {
    if (!isTrustedSender(event) || typeof id !== 'string') return
    const list = await readJson<{ id: string }[]>('bazi-history.json', [])
    await writeJson('bazi-history.json', list.filter((r) => r.id !== id))
  })

  // 排盘草稿（记住上次填写的内容）
  ipcMain.handle('bazi:draft-load', async (event) => {
    if (!isTrustedSender(event)) return null
    return readJson<unknown | null>('bazi-draft.json', null)
  })
  ipcMain.handle('bazi:draft-save', async (event, draft: unknown) => {
    if (!isTrustedSender(event)) return
    await writeJson('bazi-draft.json', draft)
  })

  // 导出 Markdown（保存对话框 + 写文件）
  ipcMain.handle('export:save-markdown', async (event, options: { defaultName?: string; content: string }) => {
    if (!isTrustedSender(event) || !mainWindow) return { ok: false, message: '拒绝导出' }
    if (typeof options?.content !== 'string') return { ok: false, message: '内容无效' }
    const safeName = String(options.defaultName ?? 'export').replace(/[\\/:*?"<>|]/g, '_')
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出 Markdown',
      defaultPath: join(app.getPath('documents'), safeName),
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if (result.canceled || !result.filePath) return { ok: false, message: '已取消' }
    try {
      await writeFile(result.filePath, options.content, 'utf-8')
      return { ok: true, path: result.filePath }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) }
    }
  })

  registerAiIpc(() => mainWindow)
}

app.whenReady().then(async () => {
  await migrateUserData()
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
