import { app, safeStorage } from 'electron'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { defaultConfig, type AppConfig } from '../renderer/src/lib/types'

function configPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

/** 加密单段文本：safeStorage 可用时加密，否则明文（加 raw: 前缀标记） */
function encryptText(text: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return 'enc:' + safeStorage.encryptString(text).toString('base64')
  }
  return 'raw:' + text
}

function decryptText(s: string): string {
  if (s.startsWith('enc:')) {
    try {
      return safeStorage.decryptString(Buffer.from(s.slice(4), 'base64'))
    } catch {
      return ''
    }
  }
  return s.startsWith('raw:') ? s.slice(4) : s
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    const raw = await readFile(configPath(), 'utf-8')
    const cfg = JSON.parse(raw) as AppConfig
    if (Array.isArray(cfg.providers)) {
      cfg.providers = cfg.providers.map((p) => ({
        ...p,
        apiKeys: (p.apiKeys ?? []).map(decryptText)
      }))
    }
    return cfg
  } catch {
    return defaultConfig()
  }
}

export async function saveConfig(cfg: AppConfig): Promise<void> {
  const enc: AppConfig = {
    ...cfg,
    providers: cfg.providers.map((p) => ({
      ...p,
      apiKeys: (p.apiKeys ?? []).map(encryptText)
    }))
  }
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(configPath(), JSON.stringify(enc, null, 2), 'utf-8')
}
