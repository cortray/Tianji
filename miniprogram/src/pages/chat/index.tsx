import { useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Textarea, ScrollView, Button, Picker } from '@tarojs/components'
import { startChat, type ChatHandle } from '../../lib/ai-client'
import { getAllSkills } from '../../lib/skills'
import { listChats, saveChat, deleteChat } from '../../lib/storage'
import { saveMarkdownFile, buildChatMarkdown, chatExportFileName, copyText } from '../../lib/export-file'
import { Markdown } from '../../lib/markdown'
import { genId } from '../../lib/date'
import { useTheme } from '../../lib/theme'
import { Icon } from '../../components/ui/Icon'
import { Empty } from '../../components/ui'
import type { ChatMessage, ChatSession, Skill } from '../../lib/types'

function buildSkillSystem(skill: Skill | null): string {
  if (!skill) return ''
  let s = skill.body
  for (const ref of skill.references) {
    s += `\n\n## 参考文件：${ref.name}\n${ref.content}`
  }
  return s
}

export default function ChatPage() {
  const { themeClass } = useTheme()
  const [skills, setSkills] = useState<Skill[]>([])
  const [skillId, setSkillId] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [status, setStatus] = useState('')
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionCreatedAt, setSessionCreatedAt] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [showSessions, setShowSessions] = useState(false)
  const handleRef = useRef<ChatHandle | null>(null)

  useEffect(() => {
    void getAllSkills().then((list) => {
      const builtin = list.filter((s) => s.source === 'builtin')
      setSkills(builtin)
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

  const activeSkill = skillId ? (skills.find((s) => s.id === skillId) ?? null) : null

  const startNewSession = (): void => {
    if (streaming) return
    setSessionId(genId('chat-'))
    setSessionCreatedAt(Date.now())
    setSkillId('')
    setMessages([])
    setStatus('')
    setShowSessions(false)
  }

  const openSession = (s: ChatSession): void => {
    if (streaming) return
    setSessionId(s.id)
    setSessionCreatedAt(s.createdAt)
    setSkillId(s.skillId ?? '')
    setMessages(s.messages)
    setStatus('')
    setShowSessions(false)
  }

  const removeSession = async (s: ChatSession): Promise<void> => {
    await deleteChat(s.id)
    setSessions((list) => list.filter((x) => x.id !== s.id))
    if (s.id === sessionId) startNewSession()
  }

  const switchSkill = (idx: number): void => {
    if (streaming) return
    if (idx === 0) {
      setSkillId('')
    } else {
      const s = skills[idx - 1]
      if (s) setSkillId(s.id)
    }
    setMessages([])
    setStatus('')
  }

  const skillPickerRange = ['通用助手（无技能）', ...skills.map((s) => s.name)]
  const skillPickerIndex = skillId ? skills.findIndex((s) => s.id === skillId) + 1 : 0

  const send = (): void => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    const userMsg: ChatMessage = { role: 'user', content: text }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setStreaming(true)
    setStatus('准备请求…')

    const system = buildSkillSystem(activeSkill)
    const payload = system
      ? [{ role: 'system' as const, content: system }, ...nextMessages]
      : nextMessages

    const handle = startChat(
      { messages: payload, temperature: 0.7 },
      {
        onBegin: () => setStatus('天机引擎正在推理…'),
        onChunk: (t) => {
          setMessages((m) => {
            const last = m[m.length - 1]
            if (last?.role === 'assistant') {
              return [...m.slice(0, -1), { ...last, content: last.content + t }]
            }
            return [...m, { role: 'assistant', content: t }]
          })
        },
        onProviderError: () => setStatus('天机引擎遇到波动，正在切换备用通道…'),
        onFail: (msg) => {
          setStatus('')
          Taro.showToast({ title: msg.slice(0, 30), icon: 'none', duration: 3000 })
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
    if (r.ok) {
      const copied = await copyText(content)
      Taro.showModal({
        title: '已导出',
        content: `文件已保存：${r.path}${copied ? '\n\n内容已同时复制到剪贴板。' : ''}`,
        showCancel: false,
        confirmText: '好的'
      })
    } else {
      Taro.showToast({ title: r.message ?? '导出失败', icon: 'none' })
    }
  }

  const confirmDeleteSession = (s: ChatSession): void => {
    Taro.showModal({
      title: '删除会话',
      content: `确定删除「${s.title}」吗？`,
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) void removeSession(s)
      }
    })
  }

  return (
    <View className={`chat-page ${themeClass}`}>
      {/* 顶部工具条 */}
      <View className='chat-toolbar'>
        <Button className='btn btn-outline btn-sm' onClick={() => setShowSessions(!showSessions)}>
          <Icon name='journal-text' size={26} color='#6d5ce7' className='btn-icon' />
          {showSessions ? '收起' : '会话'}（{sessions.length}）
        </Button>
        <View className='flex items-center gap-sm'>
          <Text className='text-sm'>技能</Text>
          <Picker mode='selector' range={skillPickerRange} value={skillPickerIndex} onChange={(e) => switchSkill(Number(e.detail.value))}>
            <View className='skill-picker'>
              <Text className='skill-picker-text'>{skillPickerRange[skillPickerIndex] || '选择技能'}</Text>
              <Icon name='chevron-down' size={22} color='#9ca3af' />
            </View>
          </Picker>
        </View>
        <View className='flex-1' />
        {streaming ? (
          <Button className='btn btn-outline btn-sm' onClick={stop}>
            <Icon name='stop-circle' size={26} color='#6d5ce7' className='btn-icon' />
            停止
          </Button>
        ) : (
          <Button className='btn btn-ghost btn-sm' onClick={() => { if (!streaming) { setMessages([]); setStatus('') } }}>
            <Icon name='trash' size={24} color='#ef4444' />
            清空
          </Button>
        )}
        {messages.length > 0 && !streaming && (
          <Button className='btn btn-ghost btn-sm' onClick={() => void doExportChat()}>
            <Icon name='download' size={24} color='#6d5ce7' />
            导出
          </Button>
        )}
      </View>

      {/* 会话列表面板 */}
      {showSessions && (
        <View className='session-panel'>
          <Button className='btn btn-primary btn-sm' onClick={startNewSession}>
            <Icon name='plus-lg' size={24} color='#ffffff' className='btn-icon' />
            新建会话
          </Button>
          {sessions.length === 0 ? (
            <Empty icon='chat-dots' text='暂无历史会话' />
          ) : (
            sessions.slice(0, 20).map((s) => (
              <View key={s.id} className='session-item'>
                <Icon name='chat-dots' size={26} color='#9ca3af' />
                <View className='flex-1' onClick={() => openSession(s)}>
                  <Text className='session-title'>
                    {s.title}
                    {s.id === sessionId ? '（当前）' : ''}
                  </Text>
                  <Text className='session-time'>{new Date(s.updatedAt).toLocaleString().slice(5, 16)}</Text>
                </View>
                <Text className='session-del' onClick={() => confirmDeleteSession(s)}>删除</Text>
              </View>
            ))
          )}
        </View>
      )}

      {/* 消息区 */}
      <ScrollView className='chat-scroll' scrollY scrollIntoView='msg-bottom'>
        <View className='chat-list'>
          {messages.length === 0 && (
            <View className='chat-empty'>
              {activeSkill ? (
                <>
                  <Icon name='robot' size={80} color='#c7cbd6' />
                  <Text className='chat-empty-title'>已启用技能「{activeSkill.name}」，它将按技能流程引导对话。</Text>
                </>
              ) : (
                <>
                  <Icon name='chat-dots' size={80} color='#c7cbd6' />
                  <Text className='chat-empty-title'>选择技能或直接开始对话；多 Provider 故障切换会自动生效。</Text>
                </>
              )}
            </View>
          )}
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <View key={i} className='chat-row chat-row-user'>
                <View className='chat-bubble chat-bubble-user'>
                  <Text>{m.content}</Text>
                </View>
              </View>
            ) : (
              <View key={i} className='chat-row'>
                <View className='chat-avatar'>
                  <Icon name='robot' size={26} color='#6d5ce7' />
                </View>
                <View className='chat-bubble'>
                  <Markdown content={m.content} />
                </View>
              </View>
            )
          )}
          {streaming && (
            <View className='chat-status'>
              <Text className='text-muted text-sm'>{status || '生成中…'}</Text>
            </View>
          )}
          <View id='msg-bottom' />
        </View>
      </ScrollView>

      {/* 输入区 */}
      <View className='chat-input-bar'>
        <Textarea
          className='chat-input'
          value={input}
          placeholder='输入消息，点发送'
          onInput={(e) => setInput(e.detail.value)}
          onConfirm={() => send()}
          confirmType='send'
          disabled={streaming}
          maxlength={4000}
          autoHeight
        />
        <Button
          className={`btn btn-primary chat-send ${!input.trim() || streaming ? 'btn-disabled' : ''}`}
          onClick={send}
        >
          <Icon name='send' size={26} color='#ffffff' className='btn-icon' />
          发送
        </Button>
      </View>
    </View>
  )
}
