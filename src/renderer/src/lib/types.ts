// ===== 共享类型定义 =====

/** LLM Provider 配置（OpenAI 兼容） */
export interface ProviderConfig {
  id: string
  name: string
  /** OpenAI 兼容 baseURL，如 https://api.deepseek.com/v1 */
  baseURL: string
  /** 默认模型，如 deepseek-chat */
  model: string
  /** 支持多个 key，请求时轮询，失败自动切换 */
  apiKeys: string[]
  enabled: boolean
  /** 优先级，数字越小越优先尝试 */
  priority: number
  createdAt: number
}

/** 高可用参数 */
export interface HaConfig {
  /** 首个 token 等待超时（毫秒） */
  firstTokenTimeoutMs: number
  /** provider 之间最多切换次数 */
  maxFailovers: number
}

export interface AppConfig {
  providers: ProviderConfig[]
  ha: HaConfig
  theme: 'light' | 'dark' | 'system'
  version: number
}

export function defaultHaConfig(): HaConfig {
  return { firstTokenTimeoutMs: 30000, maxFailovers: 3 }
}

export function defaultConfig(): AppConfig {
  return {
    providers: [
      {
        id: 'deepseek',
        name: 'DeepSeek',
        baseURL: 'https://api.deepseek.com/v1',
        model: 'deepseek-chat',
        apiKeys: [],
        enabled: true,
        priority: 0,
        createdAt: Date.now()
      }
    ],
    ha: defaultHaConfig(),
    theme: 'dark',
    version: 1
  }
}

/** 聊天消息 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** 会话 */
export interface ChatSession {
  id: string
  title: string
  skillId: string | null
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
}

/** 技能（agency-agents 风格 Markdown） */
export interface Skill {
  id: string
  name: string
  description: string
  source: 'builtin' | 'user'
  /** Markdown 全文（含 frontmatter） */
  content: string
  /** 解析出的正文（不含 frontmatter），作为 system prompt 主体 */
  body: string
  /** 附加参考文件（如 bazi 的 references/*.md） */
  references: { name: string; content: string }[]
  updatedAt: number
}

/** AI 流式请求参数 */
export interface AiChatRequest {
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
}

/** AI 流式事件（IPC / 回调） */
export type AiEvent =
  | { type: 'begin'; requestId: string; providerId: string; providerName: string; model: string }
  | { type: 'chunk'; requestId: string; text: string }
  | { type: 'done'; requestId: string; providerId: string; providerName: string; model: string }
  | { type: 'error'; requestId: string; providerId: string; providerName: string; message: string }
  | { type: 'fail'; requestId: string; message: string }

/** 排盘结果 */
export interface BaziChart {
  /** 四柱 */
  pillars: {
    year: Pillar
    month: Pillar
    day: Pillar
    hour: Pillar | null
  }
  /** 五行统计 */
  wuxing: Record<string, number>
  /** 日主（日干） */
  dayMaster: string
  /** 大运 */
  dayun: DaYun[]
  /** 当前流年 */
  currentYear: { year: number; ganzhi: string }
  /** 农历表述 */
  lunarText: string
}

export interface Pillar {
  gan: string
  zhi: string
  ganWuxing: string
  zhiWuxing: string
  shishenGan: string
  shishenZhi: string[]
  hideGan: string[]
  nayan: string
}

export interface DaYun {
  /** 第几步，0 表示起运前 */
  index: number
  /** 起运年龄 */
  startAge: number
  /** 结束年龄 */
  endAge: number
  ganzhi: string
  /** 起运公历年 */
  startYear: number
  endYear: number
}
