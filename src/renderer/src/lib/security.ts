/** 将 key 掩码为前 3 + *** + 后 4 */
export function maskKey(key: string): string {
  if (key.length <= 8) return '***'
  return `${key.slice(0, 3)}***${key.slice(-4)}`
}

/**
 * 从文本中脱敏 API Key：
 * 1. 精确替换已知 keys（如错误响应中回显的 key）
 * 2. 兜底替换 sk- 开头、长度 ≥ 12 的疑似 key（覆盖未知 key 的回显）
 */
export function redactSecrets(text: string, keys: string[] = []): string {
  let out = String(text ?? '')
  for (const k of keys) {
    if (typeof k === 'string' && k.length > 4 && out.includes(k)) {
      out = out.split(k).join(maskKey(k))
    }
  }
  out = out.replace(/(sk-[A-Za-z0-9_-]{8,})/g, (m) => maskKey(m))
  return out
}
