import type { AiChatRequest, AiEvent } from '../renderer/src/lib/types'

export interface WindowApi {
  platform: 'electron'
  versions: {
    electron: string
    chrome: string
    node: string
  }
  /** 读取应用配置（JSON 字符串，apiKeys 已解密） */
  loadConfig(): Promise<string | null>
  /** 保存应用配置（JSON 字符串，apiKeys 由主进程加密落盘） */
  saveConfig(json: string): Promise<void>
  /** 选择并读取技能 Markdown 文件（.md） */
  pickSkillFiles(): Promise<{ name: string; content: string }[]>
  /** 列出用户已导入的技能 */
  listUserSkills(): Promise<{ name: string; content: string }[]>
  /** 保存用户技能（id 作为文件名） */
  saveUserSkill(id: string, content: string): Promise<void>
  /** 删除用户技能 */
  deleteUserSkill(id: string): Promise<void>
  /** 列出全部会话 */
  listChats(): Promise<unknown[]>
  /** 保存会话（按 id 覆盖或新增） */
  saveChat(session: unknown): Promise<void>
  /** 删除会话 */
  deleteChat(id: string): Promise<void>
  /** 列出排盘历史 */
  listBaziHistory(): Promise<unknown[]>
  /** 保存排盘历史（最多 30 条） */
  saveBaziHistory(record: unknown): Promise<void>
  /** 删除排盘历史 */
  deleteBaziHistory(id: string): Promise<void>
  /** 读取排盘草稿（记住上次填写内容） */
  loadBaziDraft(): Promise<unknown | null>
  /** 保存排盘草稿 */
  saveBaziDraft(draft: unknown): Promise<void>
  /** 导出 Markdown（保存对话框 + 写文件） */
  exportMarkdown(options: { defaultName?: string; content: string }): Promise<{
    ok: boolean
    path?: string
    message?: string
  }>
  /** 发起 AI 流式请求（主进程执行故障切换），返回 requestId */
  aiChat(req: AiChatRequest): Promise<string>
  /** 取消进行中的 AI 请求 */
  aiCancel(requestId: string): Promise<void>
  /** 测试单个 Provider 连通性（非流式） */
  testProvider(provider: {
    name: string
    baseURL: string
    model: string
    apiKeys: string[]
  }): Promise<{ ok: boolean; message: string }>
  /** 订阅 AI 流式事件，返回取消订阅函数 */
  onAiEvent(cb: (e: AiEvent) => void): () => void
}

declare global {
  interface Window {
    api?: WindowApi
  }
}

export {}
