import { isElectron } from './platform'

export interface SaveFileResult {
  ok: boolean
  /** 保存路径（桌面）或文件名（Web 下载） */
  path?: string
  message?: string
}

/**
 * 通用 Markdown 保存：桌面走主进程保存对话框，Web 走浏览器下载。
 * 返回 { ok, path?, message? }
 */
export async function saveMarkdownFile(
  defaultName: string,
  content: string
): Promise<SaveFileResult> {
  const safeName = defaultName.replace(/[\\/:*?"<>|]/g, '_')
  if (isElectron && window.api) {
    const r = await window.api.exportMarkdown({ defaultName: safeName, content })
    if (r.ok) return { ok: true, path: r.path }
    return { ok: false, message: r.message }
  }
  // Web：Blob 下载
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = safeName
  a.click()
  URL.revokeObjectURL(url)
  return { ok: true, path: safeName }
}

/** 将 AI 对话会话导出为 Markdown 文本 */
export function buildChatMarkdown(input: {
  title: string
  skillName: string | null
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[]
}): string {
  const lines: string[] = []
  lines.push(`# ${input.title || 'AI 对话'}`, '')
  if (input.skillName) lines.push(`> 技能：${input.skillName}`, '')
  lines.push('---', '')
  for (const m of input.messages) {
    if (m.role === 'system') continue
    const label = m.role === 'user' ? '🙋 用户' : '🤖 助手'
    lines.push(`## ${label}`, '', m.content, '')
  }
  lines.push('---', '')
  lines.push(`> 由 天机 AI 客户端导出 · ${new Date().toLocaleString()}`)
  return lines.join('\n')
}

/** 对话导出文件名（不含扩展名） */
export function chatExportFileName(title: string): string {
  const safe = (title || '对话').replace(/[\\/:*?"<>|]/g, '_')
  return `对话_${safe}_${new Date().toISOString().slice(0, 10)}`
}
