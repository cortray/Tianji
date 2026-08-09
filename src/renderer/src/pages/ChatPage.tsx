import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Sparkles,
  Square,
  Trash2,
  Send,
  Bot,
  User,
  Loader2,
  History,
  Plus,
  ChevronDown,
  Download
} from 'lucide-react'
import { startChat, type ChatHandle } from '@/lib/ai-client'
import { getAllSkills } from '@/lib/skills'
import { listChats, saveChat, deleteChat } from '@/lib/storage'
import { saveMarkdownFile, buildChatMarkdown, chatExportFileName } from '@/lib/export-file'
import { Markdown } from '@/lib/markdown'
import type { ChatMessage, ChatSession, Skill } from '@/lib/types'
import { cn } from '@/lib/utils'

function buildSkillSystem(skill: Skill | null): string {
  if (!skill) return ''
  let s = skill.body
  for (const ref of skill.references) {
    s += `\n\n## 参考文件：${ref.name}\n${ref.content}`
  }
  return s
}

export function ChatPage() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [skillId, setSkillId] = useState<string>('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [status, setStatus] = useState('')
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionCreatedAt, setSessionCreatedAt] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const handleRef = useRef<ChatHandle | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void getAllSkills().then((list) => {
      const builtin = list.filter((s) => s.source === 'builtin')
      setSkills(builtin)
      // 默认使用内置技能
      if (builtin.length > 0) setSkillId(builtin[0].id)
    })
  }, [])

  // 加载历史会话
  useEffect(() => {
    void (async () => {
      const list = (await listChats()) as ChatSession[]
      setSessions(list)
      if (list.length > 0) {
        openSession(list[0])
      } else {
        startNewSession()
      }
      setLoaded(true)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 自动保存当前会话（防抖）
  useEffect(() => {
    if (!loaded || !sessionId) return
    const firstUser = messages.find((m) => m.role === 'user')?.content ?? ''
    const title = firstUser.slice(0, 20) || '新会话'
    const session: ChatSession = {
      id: sessionId,
      title,
      skillId: skillId || null,
      messages,
      createdAt: sessionCreatedAt || Date.now(),
      updatedAt: Date.now()
    }
    const t = setTimeout(() => {
      void saveChat(session)
      setSessions((list) => {
        const idx = list.findIndex((s) => s.id === session.id)
        if (idx >= 0) {
          const next = [...list]
          next[idx] = session
          return next
        }
        return [session, ...list]
      })
    }, 500)
    return () => clearTimeout(t)
  }, [messages, skillId, sessionId, loaded, sessionCreatedAt])

  // 自动滚动：仅在用户接近底部时跟随新消息，翻看历史时不被强制拽回
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (nearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'nearest' })
    }
  }, [messages, status])

  const activeSkill = skillId ? (skills.find((s) => s.id === skillId) ?? null) : null

  const startNewSession = (): void => {
    if (streaming) return
    setSessionId(crypto.randomUUID())
    setSessionCreatedAt(Date.now())
    setSkillId('')
    setMessages([])
    setStatus('')
  }

  const openSession = (s: ChatSession): void => {
    if (streaming) return
    setSessionId(s.id)
    setSessionCreatedAt(s.createdAt)
    setSkillId(s.skillId ?? '')
    setMessages(s.messages)
    setStatus('')
  }

  const removeSession = async (s: ChatSession): Promise<void> => {
    await deleteChat(s.id)
    setSessions((list) => list.filter((x) => x.id !== s.id))
    if (s.id === sessionId) startNewSession()
  }

  const clearChat = (): void => {
    if (streaming) return
    setMessages([])
    setStatus('')
  }

  const switchSkill = (id: string): void => {
    if (streaming) return
    setSkillId(id)
    setMessages([])
    setStatus('')
  }

  const send = (): void => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    const userMsg: ChatMessage = { role: 'user', content: text }
    setMessages((m) => [...m, userMsg])
    setStreaming(true)
    setStatus('准备请求…')

    const system = buildSkillSystem(activeSkill)
    const payload = system
      ? [{ role: 'system' as const, content: system }, ...messages, userMsg]
      : [...messages, userMsg]

    const handle = startChat(
      { messages: payload, temperature: 0.7 },
      {
        onBegin: (info) => setStatus(`正在使用 ${info.providerName}（${info.model}）…`),
        onChunk: (t) => {
          setMessages((m) => {
            const last = m[m.length - 1]
            if (last?.role === 'assistant') {
              return [...m.slice(0, -1), { ...last, content: last.content + t }]
            }
            return [...m, { role: 'assistant', content: t }]
          })
        },
        onProviderError: (info) =>
          setStatus(`${info.providerName} 失败（${info.message}），正在切换备用模型…`),
        onFail: (msg) => {
          setStatus('')
          toast.error(msg)
        }
      }
    )
    handleRef.current = handle
    void handle.result.finally(() => {
      setStreaming(false)
      setStatus('')
    })
  }

  const stop = (): void => {
    handleRef.current?.cancel()
    handleRef.current = null
    setStreaming(false)
    setStatus('已停止')
  }

  const doExportChat = async (): Promise<void> => {
    if (messages.length === 0) return
    const title =
      sessions.find((s) => s.id === sessionId)?.title ??
      messages.find((m) => m.role === 'user')?.content.slice(0, 20) ??
      '新会话'
    const content = buildChatMarkdown({
      title,
      skillName: activeSkill ? activeSkill.name : null,
      messages
    })
    const r = await saveMarkdownFile(`${chatExportFileName(title)}.md`, content)
    if (r.ok) toast.success(`已导出：${r.path}`)
    else if (r.message !== '已取消') toast.error(r.message ?? '导出失败')
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 顶部工具条 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <History className="mr-1 size-4" />
              会话
              <ChevronDown className="ml-1 size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-72" align="start">
            <DropdownMenuLabel>历史会话</DropdownMenuLabel>
            <DropdownMenuItem onClick={startNewSession}>
              <Plus className="mr-2 size-4" />
              新建会话
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {sessions.length === 0 ? (
              <DropdownMenuItem disabled>暂无历史会话</DropdownMenuItem>
            ) : (
              sessions.slice(0, 20).map((s) => (
                <DropdownMenuItem
                  key={s.id}
                  onClick={() => openSession(s)}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {s.title}
                    {s.id === sessionId && (
                      <Badge variant="secondary" className="ml-1.5 text-[9px]">
                        当前
                      </Badge>
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      void removeSession(s)
                    }}
                    aria-label={`删除会话 ${s.title}`}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <span className="text-sm font-medium">技能</span>
          <Select value={skillId} onValueChange={switchSkill}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="选择技能" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">通用助手（无技能）</SelectItem>
              {skills.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {messages.length > 0 && !streaming && (
            <Button variant="outline" size="sm" onClick={() => void doExportChat()}>
              <Download className="mr-1 size-3.5" />
              导出对话
            </Button>
          )}
          {streaming && (
            <Button variant="outline" size="sm" onClick={stop}>
              <Square className="mr-1 size-3.5" />
              停止生成
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={clearChat} disabled={streaming}>
            <Trash2 className="mr-1 size-3.5" />
            清空当前
          </Button>
        </div>
      </div>

      <Separator className="mb-4" />

      {/* 消息区 */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 pb-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-center text-muted-foreground">
              <Bot className="size-10" />
              {activeSkill ? (
                <div className="text-sm">
                  <p>已启用技能「{activeSkill.name}」，它将按技能流程引导对话。</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    已默认按「在世」为您分析（当前时间 {new Date().toLocaleString()}）。如需分析已故人士，请直接说明，将按您提到的去世年份推算。
                  </p>
                </div>
              ) : (
                <p className="text-sm">
                  选择技能或直接开始对话；多 Provider 故障切换会自动生效。
                </p>
              )}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
              <div
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-md',
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {m.role === 'user' ? <User className="size-4" /> : <Bot className="size-4" />}
              </div>
              <div
                className={cn(
                  'max-w-[85%] rounded-xl border px-4 py-3',
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-card-foreground'
                )}
              >
                {m.role === 'user' ? (
                  <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                ) : (
                  <Markdown content={m.content} />
                )}
              </div>
            </div>
          ))}
          {streaming && (
            <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              {status || '生成中…'}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* 输入区 */}
      <div className="mt-4">
        <div className="mx-auto max-w-3xl">
          <div className="relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="输入消息，Enter 发送，Shift+Enter 换行"
              rows={3}
              className="resize-none pr-20"
              disabled={streaming}
            />
            <Button
              size="icon"
              className="absolute bottom-2 right-2"
              onClick={send}
              disabled={streaming || !input.trim()}
            >
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
