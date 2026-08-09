import Taro from '@tarojs/taro'
import type { AiChatRequest, ProviderConfig } from './types'
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
 * ArrayBuffer → UTF-8 字符串（避免小程序 TextDecoder 兼容问题）
 */
function decodeUtf8(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let out = ''
  let i = 0
  const len = bytes.length
  while (i < len) {
    const b = bytes[i]
    if (b < 0x80) {
      out += String.fromCharCode(b)
      i++
    } else if (b < 0xe0) {
      out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f))
      i += 2
    } else if (b < 0xf0) {
      out += String.fromCharCode(
        ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)
      )
      i += 3
    } else {
      // 4 字节：代理对
      const code =
        ((b & 0x07) << 18) |
        ((bytes[i + 1] & 0x3f) << 12) |
        ((bytes[i + 2] & 0x3f) << 6) |
        (bytes[i + 3] & 0x3f)
      const cp = code - 0x10000
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff))
      i += 4
    }
  }
  return out
}

/** 逐行解析 SSE 的 data: 内容，取出 delta 文本 */
function parseSseLine(line: string, onDelta: (text: string) => void): void {
  const trimmed = line.replace(/\r$/, '').trim()
  if (!trimmed.startsWith('data:')) return
  const payload = trimmed.slice(5).trim()
  if (payload === '[DONE]') return
  try {
    const json = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] }
    const delta = json.choices?.[0]?.delta?.content
    if (typeof delta === 'string' && delta.length > 0) onDelta(delta)
  } catch {
    /* 忽略非 JSON 行 */
  }
}

interface PendingRequest {
  abort: () => void
}

/**
 * 流式请求一个 Provider（内部按 key 轮询）。
 * 返回 'done' | 'cancelled' | 错误信息字符串。
 */
async function tryProvider(
  provider: ProviderConfig,
  req: AiChatRequest,
  firstTokenTimeoutMs: number,
  isCancelled: () => boolean,
  onController: (r: PendingRequest) => void,
  callbacks: ChatCallbacks
): Promise<'done' | 'cancelled' | string> {
  const baseURL = provider.baseURL.replace(/\/+$/, '')
  let lastError = '请求失败'
  for (const key of provider.apiKeys ?? []) {
    if (isCancelled()) return 'cancelled'
    const r = await requestOnce(
      provider,
      key,
      baseURL,
      req,
      firstTokenTimeoutMs,
      isCancelled,
      onController,
      callbacks
    )
    if (r === 'done') return 'done'
    if (r === 'cancelled') return 'cancelled'
    lastError = r
  }
  return lastError
}

/** 发起单次流式请求 */
function requestOnce(
  provider: ProviderConfig,
  key: string,
  baseURL: string,
  req: AiChatRequest,
  firstTokenTimeoutMs: number,
  isCancelled: () => boolean,
  onController: (r: PendingRequest) => void,
  callbacks: ChatCallbacks
): Promise<'done' | 'cancelled' | string> {
  return new Promise((resolve) => {
    let settled = false
    let gotFirst = false
    let buffer = ''
    let timer: ReturnType<typeof setTimeout> | undefined

    const finish = (r: 'done' | 'cancelled' | string): void => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      resolve(r)
    }

    const task = Taro.request({
      url: `${baseURL}/chat/completions`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      data: {
        model: provider.model,
        messages: req.messages,
        stream: true,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.maxTokens ?? 4096
      },
      timeout: 120000,
      // @ts-ignore enableChunked / onChunkReceived 为微信小程序专有选项
      responseType: 'arraybuffer',
      // @ts-ignore
      enableChunked: true,
      // @ts-ignore
      onChunkReceived: (res: { data: ArrayBuffer | string }) => {
        if (isCancelled()) return
        if (!gotFirst) {
          gotFirst = true
          if (timer) clearTimeout(timer)
        }
        const text = typeof res.data === 'string' ? res.data : decodeUtf8(res.data)
        buffer += text
        let nl: number
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl)
          buffer = buffer.slice(nl + 1)
          parseSseLine(line, (delta) => callbacks.onChunk(delta))
        }
      },
      success: (res: { statusCode?: number; data?: unknown }) => {
        if (isCancelled()) return finish('cancelled')
        // enableChunked 模式下 4xx/5xx 也走 success：必须检查 statusCode，
        // 否则错误响应会被当作一次"空回复的成功对话"
        const status = res.statusCode ?? 200
        if (status < 200 || status >= 300) {
          const body =
            typeof res.data === 'string'
              ? res.data
              : res.data instanceof ArrayBuffer
                ? decodeUtf8(res.data)
                : JSON.stringify(res.data ?? '')
          finish(redactSecrets(`HTTP ${status}: ${(body || '').slice(0, 200)}`, provider.apiKeys ?? []))
          return
        }
        finish('done')
      },
      fail: (err: { errMsg?: string }) => {
        if (isCancelled()) return finish('cancelled')
        const msg = err?.errMsg ?? '请求失败'
        finish(redactSecrets(msg, provider.apiKeys ?? []))
      }
    }) as unknown as PendingRequest

    onController?.(task)

    // 首 token 超时：超时未收到第一个 chunk 则中止
    timer = setTimeout(() => {
      if (!gotFirst) {
        task.abort()
        if (!isCancelled()) finish('首 token 等待超时，已切换')
      }
    }, firstTokenTimeoutMs)
  })
}

/**
 * 发起一次流式 AI 请求（高可用故障切换，小程序端本地实现）。
 */
export function startChat(req: AiChatRequest, callbacks: ChatCallbacks): ChatHandle {
  let cancelled = false
  let current: PendingRequest | null = null

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
      const r = await tryProvider(
        provider,
        req,
        cfg.ha?.firstTokenTimeoutMs ?? 30000,
        () => cancelled,
        (task) => {
          current = task
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
      current?.abort()
    }
  }
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
  const baseURL = provider.baseURL.replace(/\/+$/, '')
  for (const key of provider.apiKeys ?? []) {
    try {
      const res = await Taro.request({
        url: `${baseURL}/chat/completions`,
        method: 'POST',
        header: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        data: {
          model: provider.model,
          messages: [{ role: 'user', content: 'ping' }],
          stream: false,
          max_tokens: 1
        },
        timeout: 15000
      })
      const status = res.statusCode
      if (status >= 200 && status < 300) {
        return { ok: true, message: `${provider.name} 连接成功（模型 ${provider.model}）` }
      }
      const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
      return {
        ok: false,
        message: `HTTP ${status}: ${redactSecrets(body, provider.apiKeys ?? []).slice(0, 200)}`
      }
    } catch (err) {
      const msg = (err as { errMsg?: string })?.errMsg ?? String(err)
      return {
        ok: false,
        message: redactSecrets(msg, provider.apiKeys ?? [])
      }
    }
  }
  return { ok: false, message: '请先填写 API Key' }
}
