import Taro from '@tarojs/taro'
import { formatDateTime, formatDate } from './date'

export interface SaveFileResult {
  ok: boolean
  /** 保存路径（小程序用户目录） */
  path?: string
  message?: string
}

/**
 * 通用 Markdown 保存（小程序）：
 * 写入用户数据目录，返回路径；页面可再引导用户复制内容或转发文件。
 */
export async function saveMarkdownFile(
  defaultName: string,
  content: string
): Promise<SaveFileResult> {
  const safeName = defaultName.replace(/[\\/:*?"<>|]/g, '_').replace(/\.md$/i, '') + '.md'
  try {
    const fs = Taro.getFileSystemManager()
    const filePath = `${Taro.env.USER_DATA_PATH}/${safeName}`
    fs.writeFileSync(filePath, content, 'utf8')
    return { ok: true, path: filePath }
  } catch (err) {
    return {
      ok: false,
      message: (err as { errMsg?: string })?.errMsg ?? '写入文件失败'
    }
  }
}

/** 复制文本到剪贴板（导出辅助） */
export async function copyText(content: string): Promise<boolean> {
  try {
    await Taro.setClipboardData({ data: content })
    return true
  } catch {
    return false
  }
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
  lines.push(`> 由 天机 AI 客户端导出 · ${formatDateTime()}`)
  return lines.join('\n')
}

/** 对话导出文件名（不含扩展名） */
export function chatExportFileName(title: string): string {
  const safe = (title || '对话').replace(/[\\/:*?"<>|]/g, '_')
  return `对话_${safe}_${formatDate()}`
}
