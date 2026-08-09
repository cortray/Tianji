import Taro from '@tarojs/taro'
import { defaultConfig, type AppConfig } from './types'

const WEB_CONFIG_KEY = 'tianji:config'
const WEB_SKILLS_KEY = 'tianji:user-skills'
const WEB_CHATS_KEY = 'tianji:chats'
const WEB_BAZI_KEY = 'tianji:bazi-history'
const WEB_BAZI_DRAFT_KEY = 'tianji:bazi-draft'

/** 规范化配置，防止旧数据/脏数据导致崩溃 */
function normalizeConfig(raw: Partial<AppConfig>): AppConfig {
  const d = defaultConfig()
  const providers = Array.isArray(raw.providers)
    ? raw.providers.map((p) => ({
        ...d.providers[0],
        ...p,
        apiKeys: Array.isArray(p.apiKeys) ? p.apiKeys.filter((k) => typeof k === 'string') : []
      }))
    : d.providers
  return {
    providers,
    ha: { ...d.ha, ...(raw.ha ?? {}) },
    theme: (raw.theme as AppConfig['theme']) ?? d.theme,
    version: raw.version ?? d.version
  }
}

function getItem<T>(key: string): T | null {
  try {
    const raw = Taro.getStorageSync(key)
    if (!raw) return null
    return typeof raw === 'string' ? (JSON.parse(raw) as T) : (raw as T)
  } catch {
    return null
  }
}

function setItem(key: string, value: unknown): void {
  try {
    Taro.setStorageSync(key, JSON.stringify(value))
  } catch {
    /* 存储满或不可用则忽略 */
  }
}

// ===== 应用配置 =====

export async function loadConfig(): Promise<AppConfig> {
  const raw = getItem<Partial<AppConfig>>(WEB_CONFIG_KEY)
  if (raw) {
    try {
      return normalizeConfig(raw)
    } catch {
      /* 配置损坏则回退默认 */
    }
  }
  return defaultConfig()
}

export async function saveConfig(cfg: AppConfig): Promise<void> {
  setItem(WEB_CONFIG_KEY, cfg)
}

// ===== 用户导入的技能 =====

export interface StoredSkillFile {
  name: string
  content: string
}

export async function listUserSkills(): Promise<StoredSkillFile[]> {
  return getItem<StoredSkillFile[]>(WEB_SKILLS_KEY) ?? []
}

export async function saveUserSkill(id: string, content: string): Promise<void> {
  const skills = await listUserSkills()
  const idx = skills.findIndex((s) => s.name === `${id}.md`)
  const entry = { name: `${id}.md`, content }
  if (idx >= 0) skills[idx] = entry
  else skills.push(entry)
  setItem(WEB_SKILLS_KEY, skills)
}

export async function deleteUserSkill(id: string): Promise<void> {
  const skills = await listUserSkills()
  setItem(
    WEB_SKILLS_KEY,
    skills.filter((s) => s.name !== `${id}.md`)
  )
}

// ===== 会话持久化 =====

export async function listChats(): Promise<unknown[]> {
  return getItem<unknown[]>(WEB_CHATS_KEY) ?? []
}

export async function saveChat(session: unknown): Promise<void> {
  const id = (session as { id: string }).id
  const list = (await listChats()) as { id: string }[]
  const idx = list.findIndex((s) => s.id === id)
  if (idx >= 0) list[idx] = session as never
  else list.unshift(session as never)
  setItem(WEB_CHATS_KEY, list)
}

export async function deleteChat(id: string): Promise<void> {
  const list = (await listChats()) as { id: string }[]
  setItem(WEB_CHATS_KEY, list.filter((s) => s.id !== id))
}

// ===== 排盘历史持久化 =====

export async function listBaziHistory(): Promise<unknown[]> {
  return getItem<unknown[]>(WEB_BAZI_KEY) ?? []
}

export async function saveBaziHistory(record: unknown): Promise<void> {
  const id = (record as { id: string }).id
  const list = (await listBaziHistory()) as { id: string }[]
  const idx = list.findIndex((r) => r.id === id)
  if (idx >= 0) list[idx] = record as never
  else list.unshift(record as never)
  setItem(WEB_BAZI_KEY, list.slice(0, 30))
}

export async function deleteBaziHistory(id: string): Promise<void> {
  const list = (await listBaziHistory()) as { id: string }[]
  setItem(WEB_BAZI_KEY, list.filter((r) => r.id !== id))
}

// ===== 排盘草稿持久化（记住上次填写的内容）=====

export async function loadBaziDraft(): Promise<unknown | null> {
  return getItem<unknown>(WEB_BAZI_DRAFT_KEY) ?? null
}

export async function saveBaziDraft(draft: unknown): Promise<void> {
  setItem(WEB_BAZI_DRAFT_KEY, draft)
}

/**
 * 选择技能 Markdown 文件（小程序：从聊天会话选择文件）。
 * 仅支持单个文件，读取文本内容。
 */
export async function pickSkillFiles(): Promise<StoredSkillFile[]> {
  try {
    const res = await Taro.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['md', 'markdown', 'txt']
    })
    const f = res.tempFiles?.[0]
    if (!f) return []
    const fs = Taro.getFileSystemManager()
    const content = fs.readFileSync(String(f.path), 'utf8')
    return [{ name: String(f.name || 'skill.md'), content: String(content) }]
  } catch {
    return []
  }
}
