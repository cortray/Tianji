import { BrowserWindow, ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import type { AiChatRequest, AiEvent, ProviderConfig } from '../renderer/src/lib/types'
import { redactSecrets } from '../renderer/src/lib/security'
import { loadConfig } from './store'

const controllers = new Map<string, AbortController>()
const cancelled = new Set<string>()

function send(win: BrowserWindow, event: AiEvent): void {
  try {
    if (!win.isDestroyed()) {
      win.webContents.send('ai:event', event)
    }
  } catch {
    /* 渲染进程可能已销毁，忽略发送失败 */
  }
}

function isTrustedSender(event: Electron.IpcMainInvokeEvent, win: BrowserWindow | null): boolean {
  return !!win && event.sender.id === win.webContents.id
}

function truncate(text: string, n = 300): string {
  return text.length > n ? text.slice(0, n) + '…' : text
}

/**
 * 尝试单个 provider（内部按 key 轮询），返回：
 * - 'done'        成功完成
 * - 'cancelled'   用户取消
 * - 其他字符串     错误信息（继续切换）
 */
async function tryProvider(
  win: BrowserWindow,
  requestId: string,
  provider: ProviderConfig,
  req: AiChatRequest,
  firstTokenTimeoutMs: number
): Promise<'done' | 'cancelled' | string> {
  const keys = provider.apiKeys ?? []
  let lastError = '请求失败'
  const baseURL = provider.baseURL.replace(/\/+$/, '')

  for (const key of keys) {
    if (cancelled.has(requestId)) return 'cancelled'
    const controller = new AbortController()
    controllers.set(requestId, controller)
    let firstTokenTimer: NodeJS.Timeout | undefined
    try {
      firstTokenTimer = setTimeout(() => controller.abort(), firstTokenTimeoutMs)
      const res = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`
        },
        body: JSON.stringify({
          model: provider.model,
          messages: req.messages,
          stream: true,
          temperature: req.temperature ?? 0.7,
          max_tokens: req.maxTokens ?? 4096
        }),
        signal: controller.signal
      })

      if (!res.ok || !res.body) {
        const body = await res.text().catch(() => '')
        // API 错误响应可能回显 key，必须脱敏后再展示
        lastError = `HTTP ${res.status}: ${truncate(redactSecrets(body, keys))}`
        continue
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let gotFirstToken = false

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let nl: number
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).replace(/\r$/, '').trim()
          buffer = buffer.slice(nl + 1)
          if (!line.startsWith('data:')) continue
          const data = line.slice(5).trim()
          if (data === '[DONE]') continue
          try {
            const json = JSON.parse(data) as {
              choices?: { delta?: { content?: string } }[]
            }
            const delta = json.choices?.[0]?.delta?.content
            if (typeof delta === 'string' && delta.length > 0) {
              if (!gotFirstToken) {
                gotFirstToken = true
                clearTimeout(firstTokenTimer)
              }
              send(win, { type: 'chunk', requestId, text: delta })
            }
          } catch {
            /* 忽略畸形数据行 */
          }
        }
      }
      clearTimeout(firstTokenTimer)
      return 'done'
    } catch (err) {
      clearTimeout(firstTokenTimer)
      if (cancelled.has(requestId)) return 'cancelled'
      lastError = redactSecrets(err instanceof Error ? err.message : String(err), keys)
    } finally {
      controllers.delete(requestId)
    }
  }
  return lastError
}

async function runAiChat(win: BrowserWindow, requestId: string, req: AiChatRequest): Promise<void> {
  try {
    const cfg = await loadConfig()
    const candidates = (cfg.providers ?? [])
      .filter((p) => p.enabled && (p.apiKeys ?? []).length > 0)
      .sort((a, b) => a.priority - b.priority)

    if (candidates.length === 0) {
      send(win, {
        type: 'fail',
        requestId,
        message: '没有可用的模型配置：请先在「设置」中添加 Provider 并填写 API Key'
      })
      return
    }

    const maxFailovers = Math.max(0, cfg.ha?.maxFailovers ?? 3)
    const firstTokenTimeoutMs = cfg.ha?.firstTokenTimeoutMs ?? 30000
    let attempts = 0
    let lastError = '所有模型都不可用'

    for (const provider of candidates) {
      if (attempts > maxFailovers) break
      attempts++
      send(win, {
        type: 'begin',
        requestId,
        providerId: provider.id,
        providerName: provider.name,
        model: provider.model
      })
      const result = await tryProvider(win, requestId, provider, req, firstTokenTimeoutMs)
      if (result === 'done') {
        // 成功完成：必须发送 done 事件，否则渲染进程永远等待终态
        send(win, {
          type: 'done',
          requestId,
          providerId: provider.id,
          providerName: provider.name,
          model: provider.model
        })
        return
      }
      if (result === 'cancelled') return
      lastError = result
      send(win, {
        type: 'error',
        requestId,
        providerId: provider.id,
        providerName: provider.name,
        message: result
      })
    }
    send(win, { type: 'fail', requestId, message: lastError })
  } catch (err) {
    // 任何未预期异常都必须以 fail 事件告知渲染进程，避免界面永久挂起
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ai] runAiChat 异常:', err)
    send(win, { type: 'fail', requestId, message: `内部错误：${msg}` })
  }
}

export function registerAiIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('ai:chat', (event, req: AiChatRequest) => {
    const win = getWindow()
    if (!win || !isTrustedSender(event, win) || !req || !Array.isArray(req.messages)) {
      throw new Error('invalid request')
    }
    const requestId = randomUUID()
    // 后台异步执行，立即返回 requestId
    void runAiChat(win, requestId, req)
    return requestId
  })

  ipcMain.handle('ai:cancel', (event, requestId: string) => {
    if (!isTrustedSender(event, getWindow())) return
    if (typeof requestId !== 'string') return
    cancelled.add(requestId)
    controllers.get(requestId)?.abort()
    // 延迟清理取消标记
    setTimeout(() => cancelled.delete(requestId), 10000)
  })

  // 单 Provider 连通性测试（非流式，仅验证 key/baseURL/model）
  ipcMain.handle('ai:test', async (event, provider: ProviderConfig) => {
    if (!isTrustedSender(event, getWindow()) || !provider) {
      return { ok: false, message: 'invalid request' }
    }
    const baseURL = String(provider.baseURL ?? '').replace(/\/+$/, '')
    const keys = Array.isArray(provider.apiKeys) ? provider.apiKeys : []
    if (!baseURL || keys.length === 0) {
      return { ok: false, message: '请先填写 baseURL 与 API Key' }
    }
    for (const key of keys) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 15000)
      try {
        const res = await fetch(`${baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`
          },
          body: JSON.stringify({
            model: provider.model,
            messages: [{ role: 'user', content: 'ping' }],
            stream: false,
            max_tokens: 1
          }),
          signal: controller.signal
        })
        clearTimeout(timer)
        if (res.ok) {
          return { ok: true, message: `${provider.name} 连接成功（模型 ${provider.model}）` }
        }
        const body = await res.text().catch(() => '')
        return { ok: false, message: `HTTP ${res.status}: ${truncate(redactSecrets(body, keys))}` }
      } catch (err) {
        clearTimeout(timer)
        const msg = redactSecrets(err instanceof Error ? err.message : String(err), keys)
        return { ok: false, message: msg }
      }
    }
    return { ok: false, message: '没有可用的 API Key' }
  })
}
