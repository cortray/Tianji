import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CalendarRange,
  MessageSquareText,
  Settings,
  ShieldCheck,
  Layers
} from 'lucide-react'
import { loadConfig } from '@/lib/storage'
import { getAllSkills } from '@/lib/skills'
import { runtimeLabel } from '@/lib/platform'
import type { PageId } from '@/lib/nav'

const entries: {
  id: PageId
  title: string
  desc: string
  icon: typeof CalendarRange
}[] = [
  {
    id: 'bazi',
    title: '八字排盘',
    desc: '本地精确计算四柱、十神、藏干、大运流年，AI 深度命理分析',
    icon: CalendarRange
  },
  {
    id: 'chat',
    title: 'AI 对话',
    desc: '内置八字命理技能，流式对话，多 Provider 自动故障切换',
    icon: MessageSquareText
  },
  {
    id: 'settings',
    title: '设置',
    desc: '配置模型 Provider、API Key、高可用参数与主题',
    icon: Settings
  }
]

export function OverviewPage({ go }: { go: (id: PageId) => void }) {
  const [stats, setStats] = useState({ providers: 0, keys: 0, skills: 0 })

  useEffect(() => {
    let alive = true
    void (async () => {
      const cfg = await loadConfig()
      const skills = await getAllSkills()
      if (!alive) return
      setStats({
        providers: cfg.providers.filter((p) => p.enabled).length,
        keys: cfg.providers.reduce((n, p) => n + p.apiKeys.length, 0),
        skills: skills.length
      })
    })()
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">天机 AI · 高可用客户端</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          本地八字排盘 · 多模型故障切换 · 技能驱动对话
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          <ShieldCheck className="mr-1 size-3" />
          运行形态：{runtimeLabel()}
        </Badge>
        <Badge variant="outline">
          <Layers className="mr-1 size-3" />
          已启用 Provider {stats.providers} · API Key {stats.keys} · 技能 {stats.skills}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {entries.map((e) => (
          <Card key={e.id} className="transition-colors hover:bg-accent/50">
            <button
              type="button"
              className="w-full text-left"
              onClick={() => go(e.id)}
              aria-label={e.title}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <e.icon className="size-5 text-primary" />
                  {e.title}
                </CardTitle>
                <CardDescription className="text-sm leading-relaxed">{e.desc}</CardDescription>
              </CardHeader>
            </button>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">高可用说明</CardTitle>
          <CardDescription>多 Provider / 多 Key 故障切换策略</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            · 所有 OpenAI 兼容接口（DeepSeek、OpenAI、Moonshot、Ollama 等）均可接入，默认预置
            DeepSeek。
          </p>
          <p>
            · 每个 Provider 可填写多个 API Key，请求时轮询使用；Key 失效或超时会自动切换到下一个
            Key，再切换到下一个 Provider。
          </p>
          <p>
            · 桌面版 API Key 由系统安全存储（Electron safeStorage）加密保存，请求经主进程转发，Key
            不出本机。
          </p>
          <p>· 在「设置」中可调整首 token 超时与最大切换次数，并支持一键测试连接。</p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => go('bazi')}>开始排盘</Button>
      </div>
    </div>
  )
}
