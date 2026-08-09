import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { Cell, CellGroup, Input, TextArea, Switch } from '@nutui/nutui-react-taro'
import { loadConfig, saveConfig } from '../../lib/storage'
import { testProvider } from '../../lib/ai-client'
import { defaultConfig, type AppConfig, type ProviderConfig } from '../../lib/types'
import { useTheme } from '../../lib/theme'
import { Icon } from '../../components/ui/Icon'
import { Badge, Button, Empty } from '../../components/ui'

interface ProviderForm {
  name: string
  baseURL: string
  model: string
  apiKeys: string
  enabled: boolean
  priority: string
}

function emptyForm(): ProviderForm {
  return {
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    apiKeys: '',
    enabled: true,
    priority: '0'
  }
}

export default function SettingsPage() {
  const { theme, themeClass, setTheme } = useTheme()
  const [cfg, setCfg] = useState<AppConfig | null>(null)
  const [editing, setEditing] = useState<ProviderConfig | 'new' | null>(null)
  const [form, setForm] = useState<ProviderForm>(emptyForm())
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState<{ ok: boolean; message: string } | null>(null)
  const [haForm, setHaForm] = useState({ firstTokenTimeoutMs: '30', maxFailovers: '3' })

  useEffect(() => {
    void loadConfig().then((cfg) => {
      setCfg(cfg as AppConfig)
      setHaForm({
        firstTokenTimeoutMs: String((cfg as AppConfig).ha.firstTokenTimeoutMs / 1000),
        maxFailovers: String((cfg as AppConfig).ha.maxFailovers)
      })
    })
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
    setEditing(null)
    Taro.showToast({ title: `已保存 ${p.name}`, icon: 'success' })
  }

  const removeProvider = (p: ProviderConfig): void => {
    Taro.showModal({
      title: '删除 Provider',
      content: `确定删除「${p.name}」吗？`,
      confirmColor: '#ef4444',
      success: (res) => {
        if (!res.confirm || !cfg) return
        void persist({ ...cfg, providers: cfg.providers.filter((x) => x.id !== p.id) })
        Taro.showToast({ title: '已删除', icon: 'success' })
      }
    })
  }

  const toggleProvider = (p: ProviderConfig, enabled: boolean): void => {
    if (!cfg) return
    void persist({ ...cfg, providers: cfg.providers.map((x) => (x.id === p.id ? { ...x, enabled } : x)) })
  }

  const openEdit = (p: ProviderConfig | null): void => {
    if (p) {
      setEditing(p)
      setForm({
        name: p.name,
        baseURL: p.baseURL,
        model: p.model,
        apiKeys: p.apiKeys.join('\n'),
        enabled: p.enabled,
        priority: String(p.priority)
      })
    } else {
      setEditing('new')
      setForm(emptyForm())
    }
    setTestMsg(null)
  }

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
      Taro.showToast({ title: '请完整填写名称、Base URL 与模型', icon: 'none' })
      return
    }
    upsertProvider({
      id: typeof editing === 'object' && editing ? editing.id : `provider-${Date.now()}`,
      name: form.name.trim(),
      baseURL: form.baseURL.trim(),
      model: form.model.trim(),
      apiKeys: form.apiKeys.split('\n').map((s) => s.trim()).filter(Boolean),
      enabled: form.enabled,
      priority: Number(form.priority) || 0,
      createdAt: typeof editing === 'object' && editing ? editing.createdAt : Date.now()
    })
  }

  const saveHa = (): void => {
    if (!cfg) return
    const firstTokenTimeoutMs = (Number(haForm.firstTokenTimeoutMs) || 30) * 1000
    const maxFailovers = Number(haForm.maxFailovers) || 3
    void persist({ ...cfg, ha: { firstTokenTimeoutMs, maxFailovers } })
    Taro.showToast({ title: '高可用参数已保存', icon: 'success' })
  }

  if (!cfg) {
    return (
      <View className={`page-pad ${themeClass}`}>
        <Text className='text-muted'>加载配置中…</Text>
      </View>
    )
  }

  const sorted = [...cfg.providers].sort((a, b) => a.priority - b.priority)
  const themeOptions: { id: 'light' | 'dark' | 'system'; label: string; icon: 'sun-fill' | 'moon-stars' | 'display' }[] = [
    { id: 'light', label: '浅色', icon: 'sun-fill' },
    { id: 'dark', label: '深色', icon: 'moon-stars' },
    { id: 'system', label: '跟随系统', icon: 'display' }
  ]

  return (
    <ScrollView className='page-scroll' scrollY>
      <View className={`page-pad ${themeClass}`}>
        {/* 主题 */}
        <View className='card'>
          <View className='flex items-center gap-sm'>
            <View className='mini-icon'><Icon name='palette' size={26} color='#8b7cf6' /></View>
            <Text className='card-title'>外观主题</Text>
          </View>
          <View className='flex gap-sm'>
            {themeOptions.map((t) => (
              <View
                key={t.id}
                className={`theme-option ${theme === t.id ? 'theme-option-active' : ''}`}
                onClick={() => setTheme(t.id)}
              >
                <Icon name={t.icon} size={26} color={theme === t.id ? '#ffffff' : '#6d5ce7'} />
                <Text className={`theme-option-text ${theme === t.id ? 'theme-option-text-active' : ''}`}>{t.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Provider 管理 */}
        <View className='card'>
          <View className='flex items-center justify-between'>
            <View className='flex-1'>
              <View className='flex items-center gap-sm'>
                <View className='mini-icon'><Icon name='plug-fill' size={26} color='#10b981' /></View>
                <Text className='card-title'>模型 Provider</Text>
              </View>
              <Text className='card-body'>故障切换按优先级从低到高尝试；同一 Provider 内多个 Key 轮询</Text>
            </View>
            <Button size='small' onClick={() => openEdit(null)}>＋ 新增</Button>
          </View>

          {sorted.length === 0 ? (
            <Empty text='暂无 Provider，点击「新增」添加' />
          ) : (
            <CellGroup>
              {sorted.map((p) => (
                <Cell
                  key={p.id}
                  title={
                    <View className='flex items-center gap-sm'>
                      <Text className='provider-name'>{p.name}</Text>
                      {p.enabled ? <Badge tone='success'>启用</Badge> : <Badge tone='default'>停用</Badge>}
                      {p.priority === 0 && <Badge tone='warning'>首选</Badge>}
                    </View>
                  }
                  description={
                    <Text className='provider-detail'>{p.baseURL} · {p.model} · Key × {p.apiKeys.length} · 优先级 {p.priority}</Text>
                  }
                  extra={
                    <View className='flex items-center gap-sm'>
                      <Switch checked={p.enabled} onChange={(v) => toggleProvider(p, v)} />
                      <Text className='link' onClick={() => openEdit(p)}>编辑</Text>
                      <Text className='session-del' onClick={() => removeProvider(p)}>删除</Text>
                    </View>
                  }
                />
              ))}
            </CellGroup>
          )}
        </View>

        {/* 编辑面板 */}
        {editing !== null && (
          <View className='card'>
            <View className='flex items-center gap-sm'>
              <View className='mini-icon'><Icon name={editing === 'new' ? 'plus-lg' : 'pencil'} size={26} color='#6d5ce7' /></View>
              <Text className='card-title'>{editing === 'new' ? '新增 Provider' : '编辑 Provider'}</Text>
            </View>
            <Text className='card-body'>OpenAI 兼容接口。Base URL 形如 https://api.deepseek.com/v1（无需 /chat/completions 后缀）。</Text>

            <CellGroup>
              <Cell title='名称' extra={<Input className='cell-input' value={form.name} placeholder='如 DeepSeek' onChange={(v) => setForm((f) => ({ ...f, name: String(v ?? '') }))} />} />
              <Cell title='Base URL' extra={<Input className='cell-input' value={form.baseURL} placeholder='https://api.deepseek.com/v1' onChange={(v) => setForm((f) => ({ ...f, baseURL: String(v ?? '') }))} />} />
              <Cell title='模型' extra={<Input className='cell-input' value={form.model} placeholder='deepseek-chat' onChange={(v) => setForm((f) => ({ ...f, model: String(v ?? '') }))} />} />
              <Cell title='优先级' extra={<Input className='cell-input' type='number' value={form.priority} onChange={(v) => setForm((f) => ({ ...f, priority: String(v ?? '') }))} />} />
              <Cell title='启用' extra={<Switch checked={form.enabled} onChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />} />
            </CellGroup>
            <View className='mt-md'>
              <TextArea
                className='provider-keys'
                value={form.apiKeys}
                placeholder='sk-xxxxxxxx
sk-yyyyyyyy（每行一个，多个实现轮询容灾）'
                onChange={(v) => setForm((f) => ({ ...f, apiKeys: String(v ?? '') }))}
                rows={4}
              />
            </View>

            {testMsg && (
              <View className={`test-msg ${testMsg.ok ? 'test-ok' : 'test-fail'}`}>
                <Text className='text-sm'>{testMsg.message}</Text>
              </View>
            )}

            <View className='flex gap-sm mt-md'>
              <Button size='small' type='default' onClick={() => void doTest()} loading={testing}>
                {testing ? '测试中…' : '测试连接'}
              </Button>
              <Button size='small' onClick={submit}>保存</Button>
              <Button size='small' type='default' onClick={() => setEditing(null)}>取消</Button>
            </View>
          </View>
        )}

        {/* 高可用参数 */}
        <View className='card'>
          <View className='flex items-center gap-sm'>
            <View className='mini-icon'><Icon name='sliders' size={26} color='#d97706' /></View>
            <Text className='card-title'>高可用参数</Text>
          </View>
          <CellGroup>
            <Cell title='首 token 超时（秒）' extra={<Input className='cell-input' type='number' value={haForm.firstTokenTimeoutMs} onChange={(v) => setHaForm((f) => ({ ...f, firstTokenTimeoutMs: String(v ?? '') }))} />} />
            <Cell title='最大切换次数' extra={<Input className='cell-input' type='number' value={haForm.maxFailovers} onChange={(v) => setHaForm((f) => ({ ...f, maxFailovers: String(v ?? '') }))} />} />
          </CellGroup>
          <View className='mt-md'>
            <Button block size='small' type='default' onClick={saveHa}>保存高可用参数</Button>
          </View>
        </View>

        <View className='footer-note'>
          <Text>天机 AI · 微信小程序{cfg ? ` · 配置版本 v${cfg.version}` : ''}</Text>
        </View>
      </View>
    </ScrollView>
  )
}
