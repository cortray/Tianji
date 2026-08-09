import { defaultConfig, type AppConfig } from './types'
import { isElectron } from './platform'

const WEB_CONFIG_KEY = 'tianji:config'
const WEB_SKILLS_KEY = 'tianji:user-skills'

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

// ===== 应用配置 =====

export async function loadConfig(): Promise<AppConfig> {
  if (isElectron && window.api) {
    const raw = await window.api.loadConfig()
    if (raw) {
      try {
        return normalizeConfig(JSON.parse(raw))
      } catch {
        /* 配置损坏则回退默认 */
      }
    }
    return defaultConfig()
  }
  try {
    const raw = localStorage.getItem(WEB_CONFIG_KEY)
    if (raw) return normalizeConfig(JSON.parse(raw))
  } catch {
    /* ignore */
  }
  return defaultConfig()
}

export async function saveConfig(cfg: AppConfig): Promise<void> {
  if (isElectron && window.api) {
    await window.api.saveConfig(JSON.stringify(cfg))
  } else {
    localStorage.setItem(WEB_CONFIG_KEY, JSON.stringify(cfg))
  }
}

// ===== 用户导入的技能（桌面存文件系统，Web 存 localStorage）=====

export interface StoredSkillFile {
  name: string
  content: string
}

export async function listUserSkills(): Promise<StoredSkillFile[]> {
  if (isElectron && window.api) {
    return window.api.listUserSkills()
  }
  try {
    const raw = localStorage.getItem(WEB_SKILLS_KEY)
    return raw ? (JSON.parse(raw) as StoredSkillFile[]) : []
  } catch {
    return []
  }
}

export async function saveUserSkill(id: string, content: string): Promise<void> {
  if (isElectron && window.api) {
    await window.api.saveUserSkill(id, content)
    return
  }
  const skills = await listUserSkills()
  const idx = skills.findIndex((s) => s.name === `${id}.md`)
  const entry = { name: `${id}.md`, content }
  if (idx >= 0) skills[idx] = entry
  else skills.push(entry)
  localStorage.setItem(WEB_SKILLS_KEY, JSON.stringify(skills))
}

export async function deleteUserSkill(id: string): Promise<void> {
  if (isElectron && window.api) {
    await window.api.deleteUserSkill(id)
    return
  }
  const skills = await listUserSkills()
  localStorage.setItem(
    WEB_SKILLS_KEY,
    JSON.stringify(skills.filter((s) => s.name !== `${id}.md`))
  )
}

// ===== 会话持久化 =====

const WEB_CHATS_KEY = 'tianji:chats'

export async function listChats(): Promise<unknown[]> {
  if (isElectron && window.api) return window.api.listChats()
  try {
    const raw = localStorage.getItem(WEB_CHATS_KEY)
    return raw ? (JSON.parse(raw) as unknown[]) : []
  } catch {
    return []
  }
}

export async function saveChat(session: unknown): Promise<void> {
  if (isElectron && window.api) {
    await window.api.saveChat(session)
    return
  }
  const id = (session as { id: string }).id
  const list = (await listChats()) as { id: string }[]
  const idx = list.findIndex((s) => s.id === id)
  if (idx >= 0) list[idx] = session as never
  else list.unshift(session as never)
  localStorage.setItem(WEB_CHATS_KEY, JSON.stringify(list))
}

export async function deleteChat(id: string): Promise<void> {
  if (isElectron && window.api) {
    await window.api.deleteChat(id)
    return
  }
  const list = (await listChats()) as { id: string }[]
  localStorage.setItem(WEB_CHATS_KEY, JSON.stringify(list.filter((s) => s.id !== id)))
}

// ===== 排盘历史持久化 =====

const WEB_BAZI_KEY = 'tianji:bazi-history'

export async function listBaziHistory(): Promise<unknown[]> {
  if (isElectron && window.api) return window.api.listBaziHistory()
  try {
    const raw = localStorage.getItem(WEB_BAZI_KEY)
    return raw ? (JSON.parse(raw) as unknown[]) : []
  } catch {
    return []
  }
}

export async function saveBaziHistory(record: unknown): Promise<void> {
  if (isElectron && window.api) {
    await window.api.saveBaziHistory(record)
    return
  }
  const id = (record as { id: string }).id
  const list = (await listBaziHistory()) as { id: string }[]
  const idx = list.findIndex((r) => r.id === id)
  if (idx >= 0) list[idx] = record as never
  else list.unshift(record as never)
  localStorage.setItem(WEB_BAZI_KEY, JSON.stringify(list.slice(0, 30)))
}

export async function deleteBaziHistory(id: string): Promise<void> {
  if (isElectron && window.api) {
    await window.api.deleteBaziHistory(id)
    return
  }
  const list = (await listBaziHistory()) as { id: string }[]
  localStorage.setItem(WEB_BAZI_KEY, JSON.stringify(list.filter((r) => r.id !== id)))
}

// ===== 排盘草稿持久化（记住上次填写的内容）=====

const WEB_BAZI_DRAFT_KEY = 'tianji:bazi-draft'

export async function loadBaziDraft(): Promise<unknown | null> {
  if (isElectron && window.api) return window.api.loadBaziDraft()
  try {
    const raw = localStorage.getItem(WEB_BAZI_DRAFT_KEY)
    return raw ? (JSON.parse(raw) as unknown) : null
  } catch {
    return null
  }
}

export async function saveBaziDraft(draft: unknown): Promise<void> {
  if (isElectron && window.api) {
    await window.api.saveBaziDraft(draft)
    return
  }
  localStorage.setItem(WEB_BAZI_DRAFT_KEY, JSON.stringify(draft))
}

/** 选择技能 Markdown 文件（桌面为原生对话框，Web 为 file input 结果） */
export async function pickSkillFiles(): Promise<StoredSkillFile[]> {
  if (isElectron && window.api) {
    return window.api.pickSkillFiles()
  }
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.md,.markdown,text/markdown'
    input.multiple = true
    input.onchange = async () => {
      const files = Array.from(input.files ?? [])
      const out: StoredSkillFile[] = []
      for (const f of files) {
        const content = await f.text()
        out.push({ name: f.name, content })
      }
      resolve(out)
    }
    input.oncancel = () => resolve([])
    input.click()
  })
}
