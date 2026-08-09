import type { Skill } from './types'
import { listUserSkills, saveUserSkill, deleteUserSkill } from './storage'

// 内置技能打包（bazi-skill 复制进 src/renderer/src/skills/builtin/）
const builtinModules = import.meta.glob('../skills/builtin/**/*.md', {
  eager: true,
  query: '?raw',
  import: 'default'
}) as Record<string, string>

export interface ParsedMeta {
  name: string
  description: string
  [key: string]: string
}

/** 解析 agency-agents 风格 frontmatter（--- 包裹的 YAML 子集，支持多行描述） */
export function parseFrontmatter(content: string): { meta: ParsedMeta; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(content)
  if (!m) return { meta: { name: '', description: '' }, body: content }
  const meta: ParsedMeta = { name: '', description: '' }
  const values: Record<string, string[]> = {}
  let currentKey: string | null = null
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line)
    if (kv) {
      currentKey = kv[1]
      values[currentKey] = [kv[2]]
    } else if (currentKey && line.trim()) {
      values[currentKey].push(line.trim())
    }
  }
  for (const k of Object.keys(values)) {
    let v = values[k].join(' ').trim()
    v = v.replace(/^["']|["']$/g, '')
    meta[k] = v
  }
  return { meta, body: m[2] }
}

function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'skill'
  )
}

interface BuildInput {
  id: string
  content: string
  source: 'builtin' | 'user'
  references?: { name: string; content: string }[]
  updatedAt: number
}

function buildSkill(input: BuildInput): Skill | null {
  const { meta, body } = parseFrontmatter(input.content)
  return {
    id: input.id,
    name: meta.name || input.id,
    description: meta.description || '（无描述）',
    source: input.source,
    content: input.content,
    body,
    references: input.references ?? [],
    updatedAt: input.updatedAt
  }
}

function getBuiltinSkills(): Skill[] {
  const paths = Object.keys(builtinModules).sort()
  const roots = new Set<string>()
  for (const p of paths) {
    const m = /^\.\.\/skills\/builtin\/([^/]+)\/SKILL\.md$/.exec(p)
    if (m) roots.add(m[1])
  }
  const out: Skill[] = []
  for (const root of roots) {
    const content = builtinModules[`../skills/builtin/${root}/SKILL.md`]
    if (!content) continue
    const refs = paths
      .filter((p) => p.startsWith(`../skills/builtin/${root}/references/`))
      .map((p) => ({ name: p.split('/').pop() ?? p, content: builtinModules[p] }))
    const skill = buildSkill({ id: root, content, source: 'builtin', references: refs, updatedAt: 0 })
    if (skill) out.push(skill)
  }
  // 内置技能展示名中文化（bazi → 八字命理）
  const DISPLAY: Record<string, { name: string; description: string }> = {
    bazi: { name: '八字命理', description: '四柱八字排盘与经典典籍命理分析' }
  }
  for (const s of out) {
    const d = DISPLAY[s.id]
    if (d) {
      s.name = d.name
      s.description = d.description
    }
  }
  return out
}

let cache: Skill[] | null = null

/** 全部技能 = 内置 + 用户导入 */
export async function getAllSkills(): Promise<Skill[]> {
  if (cache) return cache
  const builtin = getBuiltinSkills()
  const userFiles = await listUserSkills()
  const users = userFiles
    .map((f) => {
      const id = f.name.replace(/\.md$/i, '')
      return buildSkill({ id, content: f.content, source: 'user', updatedAt: Date.now() })
    })
    .filter((s): s is Skill => s !== null)
  cache = [...builtin, ...users]
  return cache
}

export async function getSkillById(id: string): Promise<Skill | null> {
  const all = await getAllSkills()
  return all.find((s) => s.id === id) ?? null
}

export function invalidateSkillsCache(): void {
  cache = null
}

/** 导入用户技能，返回生成的 Skill */
export async function addUserSkill(content: string, preferredId?: string): Promise<Skill | null> {
  const { meta } = parseFrontmatter(content)
  const id = preferredId ?? slugify(meta.name || 'skill')
  await saveUserSkill(id, content)
  invalidateSkillsCache()
  return buildSkill({ id, content, source: 'user', updatedAt: Date.now() })
}

export async function removeUserSkill(id: string): Promise<void> {
  await deleteUserSkill(id)
  invalidateSkillsCache()
}
