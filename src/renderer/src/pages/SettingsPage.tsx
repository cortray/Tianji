import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2, PlugZap, KeyRound, Monitor, Moon, Sun } from 'lucide-react'
import { loadConfig, saveConfig } from '@/lib/storage'
import { testProvider } from '@/lib/ai-client'
import { defaultConfig, type AppConfig, type ProviderConfig } from '@/lib/types'
import { isElectron } from '@/lib/platform'
import { cn } from '@/lib/utils'

interface ProviderForm {
  name: string
  baseURL: string
  model: string
  apiKeys: string
  enabled: boolean
  priority: number
}

function emptyForm(): ProviderForm {
  return {
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    apiKeys: '',
    enabled: true,
    priority: 0
  }
}

function ProviderDialog({
  open,
  onOpenChange,
  initial,
  onSave
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial: ProviderConfig | null
  onSave: (p: ProviderConfig) => void
}) {
  const [form, setForm] = useState<ProviderForm>(emptyForm())
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        name: initial.name,
        baseURL: initial.baseURL,
        model: initial.model,
        apiKeys: initial.apiKeys.join('\n'),
        enabled: initial.enabled,
        priority: initial.priority
      })
    } else {
      setForm(emptyForm())
    }
    setTestMsg(null)
  }, [open, initial])

  const set = <K extends keyof ProviderForm>(k: K, v: ProviderForm[K]): void =>
    setForm((f) => ({ ...f, [k]: v }))

  const doTest = async (): Promise<void> => {
    if (!form.baseURL || !form.apiKeys.trim()) {
      setTestMsg({ ok: false, message: '请先填写 baseURL 与 API Key' })
      return
    }
    setTesting(true)
    const r = await testProvider({
      name: form.name,
      baseURL: form.baseURL,
      model: form.model,
      apiKeys: form.apiKeys.split('\n').map((s) => s.trim()).filter(Boolean)
    })
    setTesting(false)
    setTestMsg(r)
  }

  const submit = (): void => {
    if (!form.name.trim() || !form.baseURL.trim() || !form.model.trim()) {
      toast.error('请完整填写名称、Base URL 与模型')
      return
    }
    onSave({
      id: initial?.id ?? `provider-${Date.now()}`,
      name: form.name.trim(),
      baseURL: form.baseURL.trim(),
      model: form.model.trim(),
      apiKeys: form.apiKeys.split('\n').map((s) => s.trim()).filter(Boolean),
      enabled: form.enabled,
      priority: form.priority,
      createdAt: initial?.createdAt ?? Date.now()
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? '编辑 Provider' : '新增 Provider'}</DialogTitle>
          <DialogDescription>
            OpenAI 兼容接口。Base URL 形如 https://api.deepseek.com/v1（无需 /chat/completions 后缀）。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="p-name">名称</Label>
            <Input
              id="p-name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="如 DeepSeek"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-url">Base URL</Label>
            <Input
              id="p-url"
              value={form.baseURL}
              onChange={(e) => set('baseURL', e.target.value)}
              placeholder="https://api.deepseek.com/v1"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-model">模型</Label>
            <Input
              id="p-model"
              value={form.model}
              onChange={(e) => set('model', e.target.value)}
              placeholder="deepseek-chat"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-keys" className="flex items-center gap-1.5">
              <KeyRound className="size-3.5" />
              API Key（每行一个，可填多个实现 Key 级轮询容灾）
            </Label>
            <Textarea
              id="p-keys"
              value={form.apiKeys}
              onChange={(e) => set('apiKeys', e.target.value)}
              placeholder={'sk-xxxxxxxx\nsk-yyyyyyyy'}
              rows={3}
            />
            {!isElectron && (
              <p className="text-xs text-muted-foreground">
                Web 模式下 Key 保存在浏览器 localStorage，请注意风险；建议使用桌面版。
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 items-end gap-4">
            <div className="grid gap-2">
              <Label htmlFor="p-priority">优先级（数字越小越优先）</Label>
              <Input
                id="p-priority"
                type="number"
                value={form.priority}
                onChange={(e) => set('priority', Number(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-center gap-2 pb-1">
              <Switch
                id="p-enabled"
                checked={form.enabled}
                onCheckedChange={(v) => set('enabled', v)}
              />
              <Label htmlFor="p-enabled">启用</Label>
            </div>
          </div>
          {testMsg && (
            <p
              className={cn(
                'rounded-md border px-3 py-2 text-xs',
                testMsg.ok
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-destructive/40 bg-destructive/10 text-destructive'
              )}
            >
              {testMsg.message}
            </p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => void doTest()} disabled={testing}>
            <PlugZap className="mr-1 size-4" />
            {testing ? '测试中…' : '测试连接'}
          </Button>
          <Button onClick={submit}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [cfg, setCfg] = useState<AppConfig | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ProviderConfig | null>(null)
  const [deleting, setDeleting] = useState<ProviderConfig | null>(null)

  useEffect(() => {
    void loadConfig().then(setCfg)
  }, [])

  const persist = async (next: AppConfig): Promise<void> => {
    setCfg(next)
    await saveConfig(next)
  }

  const upsertProvider = (p: ProviderConfig): void => {
    if (!cfg) return
    const idx = cfg.providers.findIndex((x) => x.id === p.id)
    const providers = [...cfg.providers]
    if (idx >= 0) providers[idx] = p
    else providers.push(p)
    void persist({ ...cfg, providers })
    toast.success(`已保存 ${p.name}`)
  }

  const removeProvider = (p: ProviderConfig): void => {
    if (!cfg) return
    void persist({ ...cfg, providers: cfg.providers.filter((x) => x.id !== p.id) })
    setDeleting(null)
    toast.success(`已删除 ${p.name}`)
  }

  const toggleProvider = (p: ProviderConfig, enabled: boolean): void => {
    if (!cfg) return
    void persist({ ...cfg, providers: cfg.providers.map((x) => (x.id === p.id ? { ...x, enabled } : x)) })
  }

  if (!cfg) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
        加载配置中…
      </div>
    )
  }

  const sorted = [...cfg.providers].sort((a, b) => a.priority - b.priority)

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">设置</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          模型 Provider 与 API Key 配置、高可用策略、外观主题
        </p>
      </div>

      {/* 主题 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">外观主题</CardTitle>
          <CardDescription>明暗模式</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {(
              [
                { id: 'light', label: '浅色', icon: Sun },
                { id: 'dark', label: '深色', icon: Moon },
                { id: 'system', label: '跟随系统', icon: Monitor }
              ] as const
            ).map((t) => (
              <Button
                key={t.id}
                variant={theme === t.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme(t.id)}
              >
                <t.icon className="mr-1 size-4" />
                {t.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Provider 管理 */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">模型 Provider</CardTitle>
            <CardDescription>
              故障切换按优先级从低到高尝试；同一 Provider 内多个 Key 轮询
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="mr-1 size-4" />
            新增 Provider
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {sorted.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              暂无 Provider，点击「新增 Provider」添加（默认模板为 DeepSeek）
            </p>
          )}
          {sorted.map((p) => (
            <div
              key={p.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3',
                !p.enabled && 'opacity-60'
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{p.name}</span>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    #{p.priority}
                  </Badge>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {p.model}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{p.baseURL}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <KeyRound className="size-3" />
                  {p.apiKeys.length} 个 Key
                  {p.apiKeys.length === 0 && (
                    <span className="text-amber-600 dark:text-amber-400">（未配置，会被跳过）</span>
                  )}
                </p>
              </div>
              <Switch
                checked={p.enabled}
                onCheckedChange={(v) => toggleProvider(p, v)}
                aria-label={`启用 ${p.name}`}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditing(p)
                  setDialogOpen(true)
                }}
                aria-label={`编辑 ${p.name}`}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleting(p)}
                aria-label={`删除 ${p.name}`}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 高可用参数 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">高可用参数</CardTitle>
          <CardDescription>故障切换策略</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="ha-timeout">首 token 超时（秒）</Label>
            <Input
              id="ha-timeout"
              type="number"
              min={3}
              value={Math.round(cfg.ha.firstTokenTimeoutMs / 1000)}
              onChange={(e) => {
                const s = Number(e.target.value) || 30
                void persist({ ...cfg, ha: { ...cfg.ha, firstTokenTimeoutMs: s * 1000 } })
              }}
            />
            <p className="text-xs text-muted-foreground">
              超过该时间未返回首个 token 即判定该 Key/Provider 失败
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ha-failover">最大切换次数</Label>
            <Input
              id="ha-failover"
              type="number"
              min={0}
              max={10}
              value={cfg.ha.maxFailovers}
              onChange={(e) => {
                const n = Number(e.target.value) || 0
                void persist({ ...cfg, ha: { ...cfg.ha, maxFailovers: n } })
              }}
            />
            <p className="text-xs text-muted-foreground">Provider 之间最多尝试切换的次数</p>
          </div>
        </CardContent>
      </Card>

      {/* 关于 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">关于</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>天机 AI · 高可用客户端 v0.1.0</p>
          <p>技术栈：Electron + Vite + React 19 + Tailwind v4 + shadcn/ui + lunar-javascript</p>
          <p>
            运行形态：
            {isElectron
              ? `Electron ${window.api?.versions.electron}`
              : 'Web 浏览器（未使用桌面安全存储）'}
          </p>
          <p className="mt-2 text-xs">
            默认配置：{JSON.stringify(defaultConfig().providers[0].baseURL)} · 模型{' '}
            {defaultConfig().providers[0].model}
          </p>
        </CardContent>
      </Card>

      <ProviderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSave={upsertProvider}
      />

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除 Provider？</AlertDialogTitle>
            <AlertDialogDescription>
              将移除「{deleting?.name}」及其全部 API Key 配置，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && removeProvider(deleting)}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
