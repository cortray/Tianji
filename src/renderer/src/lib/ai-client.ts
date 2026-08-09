import type { AiChatRequest, AiEvent, ProviderConfig } from './types'
import { isElectron } from './platform'
import { loadConfig } from './storage'
import { redactSecrets } from './security'

export interface ChatCallbacks {
  onBegin?: (info: { providerId: string; providerName: string; model: string }) => void
  onChunk: (text: string) => void
  onDone?: (info: { providerId: string; providerName: string; model: string }) => void
  onProviderError?: (info: { providerId: string; providerName: string; message: string }) => void
  onFail?: (message: string) => void
}

export interface ChatResult {
  ok: boolean
  providerName?: string
  message?: string
}

export interface ChatHandle {
  result: Promise<ChatResult>
  cancel: () => void
}

/**
 * 发起一次流式 AI 请求（高可用故障切换）。
 * - Electron：走主进程 IPC（key 不出主进程，切换逻辑在 main）
 * - Web：本地 fetch + SSE，切换逻辑在此实现
 */
export function startChat(req: AiChatRequest, callbacks: ChatCallbacks): ChatHandle {
  if (isElectron && window.api) return startChatElectron(req, callbacks)
  return startChatWeb(req, callbacks)
}

// ===== 连接测试 =====

export interface TestResult {
  ok: boolean
  message: string
}

/** 测试单个 Provider 连通性（非流式） */
export async function testProvider(
  provider: Pick<ProviderConfig, 'name' | 'baseURL' | 'model' | 'apiKeys'>
): Promise<TestResult> {
  if (isElectron && window.api) {
    return window.api.testProvider(provider)
  }
  const baseURL = provider.baseURL.replace(/\/+$/, '')
  for (const key of provider.apiKeys ?? []) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    try {
      const res = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: provider.model,
          messages: [{ role: 'user', content: 'ping' }],
          stream: false,
          max_tokens: 1
        }),
        signal: controller.signal
      })
      clearTimeout(timer)
      if (res.ok) return { ok: true, message: `${provider.name} 连接成功（模型 ${provider.model}）` }
      const body = await res.text().catch(() => '')
      return {
        ok: false,
        message: `HTTP ${res.status}: ${redactSecrets(body, provider.apiKeys ?? []).slice(0, 200)}`
      }
    } catch (err) {
      clearTimeout(timer)
      return {
        ok: false,
        message: redactSecrets(err instanceof Error ? err.message : String(err), provider.apiKeys ?? [])
      }
    }
  }
  return { ok: false, message: '请先填写 API Key' }
}

// ===== Electron 实现 =====

function startChatElectron(req: AiChatRequest, callbacks: ChatCallbacks): ChatHandle {
  const api = window.api!
  let requestId = ''
  let cancelled = false
  const pending: AiEvent[] = []

  const result = new Promise<ChatResult>((resolve) => {
    let settled = false
    let guard: ReturnType<typeof setTimeout> | undefined
    const finish = (r: ChatResult): void => {
      if (settled) return
      settled = true
      if (guard) clearTimeout(guard)
      resolve(r)
    }
    // 全局兜底：防止任何边缘情况导致界面永久挂起
    guard = setTimeout(() => {
      callbacks.onFail?.('请求超时（120 秒未完成），请检查网络或模型配置')
      finish({ ok: false, message: '请求超时' })
    }, 120000)

    const off = api.onAiEvent((e) => {
      if (!requestId) {
        pending.push(e)
        return
      }
      if (e.requestId !== requestId) return
      switch (e.type) {
        case 'begin':
          callbacks.onBegin?.({
            providerId: e.providerId,
            providerName: e.providerName,
            model: e.model
          })
          break
        case 'chunk':
          if (!cancelled) callbacks.onChunk(e.text)
          break
        case 'done':
          if (!settled) {
            callbacks.onDone?.({
              providerId: e.providerId,
              providerName: e.providerName,
              model: e.model
            })
          }
          off()
          finish({ ok: true, providerName: e.providerName })
          break
        case 'error':
          callbacks.onProviderError?.({
            providerId: e.providerId,
            providerName: e.providerName,
            message: e.message
          })
          break
        case 'fail':
          if (!settled) callbacks.onFail?.(e.message)
          off()
          finish({ ok: false, message: e.message })
          break
      }
    })

    api.aiChat(req).then(
      (rid) => {
        requestId = rid
        const buffered = pending.splice(0)
        for (const e of buffered) {
          if (e.requestId !== requestId) continue
          if (e.type === 'chunk') callbacks.onChunk(e.text)
          else if (e.type === 'begin') {
            callbacks.onBegin?.({
              providerId: e.providerId,
              providerName: e.providerName,
              model: e.model
            })
          } else if (e.type === 'error') {
            callbacks.onProviderError?.({
              providerId: e.providerId,
              providerName: e.providerName,
              message: e.message
            })
          }
        }
        // 若事件在订阅前已 fail/done，需要处理缓冲中的终态
        const terminal = buffered.find(
          (e): e is Extract<AiEvent, { type: 'done' } | { type: 'fail' }> =>
            e.requestId === requestId && (e.type === 'done' || e.type === 'fail')
        )
        if (terminal) {
          if (terminal.type === 'done') {
            if (!settled) {
              callbacks.onDone?.({
                providerId: terminal.providerId,
                providerName: terminal.providerName,
                model: terminal.model
              })
            }
            finish({ ok: true, providerName: terminal.providerName })
          } else {
            if (!settled) callbacks.onFail?.(terminal.message)
            finish({ ok: false, message: terminal.message })
          }
        }
      },
      (err: unknown) => {
        // IPC 调用本身失败（如 handler 抛错）也要给出终态，避免界面卡死
        const msg = err instanceof Error ? err.message : String(err)
        callbacks.onFail?.(`请求发起失败：${msg}`)
        finish({ ok: false, message: msg })
      }
    )
  })

  return {
    result,
    cancel: () => {
      cancelled = true
      if (requestId) void api.aiCancel(requestId)
    }
  }
}

// ===== Web 实现 =====

async function tryProviderWeb(
  provider: ProviderConfig,
  req: AiChatRequest,
  firstTokenTimeoutMs: number,
  isCancelled: () => boolean,
  onController: (c: AbortController) => void,
  callbacks: ChatCallbacks
): Promise<'done' | 'cancelled' | string> {
  const baseURL = provider.baseURL.replace(/\/+$/, '')
  let lastError = '请求失败'
  for (const key of provider.apiKeys ?? []) {
    if (isCancelled()) return 'cancelled'
    const controller = new AbortController()
    onController(controller)
    const timer = setTimeout(() => controller.abort(), firstTokenTimeoutMs)
    try {
      const res = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
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
        lastError = `HTTP ${res.status}: ${redactSecrets(body, provider.apiKeys ?? []).slice(0, 200)}`
        continue
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let gotFirst = false
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
            const json = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] }
            const delta = json.choices?.[0]?.delta?.content
            if (typeof delta === 'string' && delta.length > 0) {
              if (!gotFirst) {
                gotFirst = true
                clearTimeout(timer)
              }
              callbacks.onChunk(delta)
            }
          } catch {
            /* ignore */
          }
        }
      }
      clearTimeout(timer)
      return 'done'
    } catch (err) {
      clearTimeout(timer)
      if (isCancelled()) return 'cancelled'
      lastError = redactSecrets(err instanceof Error ? err.message : String(err), provider.apiKeys ?? [])
    }
  }
  return lastError
}

function startChatWeb(req: AiChatRequest, callbacks: ChatCallbacks): ChatHandle {
  let cancelled = false
  let controller: AbortController | null = null

  const result = (async (): Promise<ChatResult> => {
    const cfg = await loadConfig()
    const candidates = (cfg.providers ?? [])
      .filter((p) => p.enabled && (p.apiKeys ?? []).length > 0)
      .sort((a, b) => a.priority - b.priority)
    if (candidates.length === 0) {
      const msg = '没有可用的模型配置：请先在「设置」中添加 Provider 并填写 API Key'
      callbacks.onFail?.(msg)
      return { ok: false, message: msg }
    }
    const maxFailovers = Math.max(0, cfg.ha?.maxFailovers ?? 3)
    let attempts = 0
    let lastError = '所有模型都不可用'
    for (const provider of candidates) {
      if (cancelled) return { ok: false, message: '已取消' }
      if (attempts > maxFailovers) break
      attempts++
      callbacks.onBegin?.({
        providerId: provider.id,
        providerName: provider.name,
        model: provider.model
      })
      const r = await tryProviderWeb(
        provider,
        req,
        cfg.ha?.firstTokenTimeoutMs ?? 30000,
        () => cancelled,
        (c) => {
          controller = c
        },
        callbacks
      )
      if (r === 'done') {
        callbacks.onDone?.({
          providerId: provider.id,
          providerName: provider.name,
          model: provider.model
        })
        return { ok: true, providerName: provider.name }
      }
      if (r === 'cancelled') return { ok: false, message: '已取消' }
      lastError = r
      callbacks.onProviderError?.({
        providerId: provider.id,
        providerName: provider.name,
        message: r
      })
    }
    callbacks.onFail?.(lastError)
    return { ok: false, message: lastError }
  })()

  return {
    result,
    cancel: () => {
      cancelled = true
      controller?.abort()
    }
  }
}
