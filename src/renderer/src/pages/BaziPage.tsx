import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { CalendarRange, Sparkles, Square, Loader2, Bot, History, Trash2, Download, Info } from 'lucide-react'
import { computeBazi, lunarToSolar, trueSolarOffsetMinutes, type BaziInput } from '@/lib/bazi/engine'
import { buildBaziSystemPrompt, buildBaziUserPrompt } from '@/lib/bazi/prompt'
import {
  buildBaziMarkdown,
  buildAnalysisMarkdown,
  baziExportFileName
} from '@/lib/bazi/export'
import { getSkillById } from '@/lib/skills'
import { startChat, type ChatHandle } from '@/lib/ai-client'
import { listBaziHistory, saveBaziHistory, deleteBaziHistory, loadBaziDraft, saveBaziDraft } from '@/lib/storage'
import { saveMarkdownFile } from '@/lib/export-file'
import { Markdown } from '@/lib/markdown'
import type { BaziChart } from '@/lib/types'
import { cn } from '@/lib/utils'

const WUXING_COLORS: Record<string, string> = {
  金: 'bg-amber-400',
  木: 'bg-emerald-400',
  水: 'bg-sky-400',
  火: 'bg-rose-400',
  土: 'bg-yellow-600'
}

const WUXING_TEXT: Record<string, string> = {
  金: 'text-amber-500',
  木: 'text-emerald-500',
  水: 'text-sky-500',
  火: 'text-rose-500',
  土: 'text-yellow-600'
}

function today(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

interface FormState {
  name: string
  gender: 'male' | 'female'
  calendar: 'solar' | 'lunar'
  birthDate: string
  lunarYear: string
  lunarMonth: string
  lunarLeap: boolean
  lunarDay: string
  birthTime: string
  hourUnknown: boolean
  birthplace: string
  alive: boolean
  trueSolar: boolean
  longitude: string
}

interface CorrectionInfo {
  offsetMin: number
  originalTime: string
  usedTime: string
  longitude: number
}

interface BaziHistoryRecord {
  id: string
  createdAt: number
  title: string
  form: FormState
  chart: BaziChart
  analysis: string
}

export function BaziPage() {
  const [form, setForm] = useState<FormState>({
    name: '',
    gender: 'male',
    calendar: 'solar',
    birthDate: today(),
    lunarYear: '1990',
    lunarMonth: '4',
    lunarLeap: false,
    lunarDay: '21',
    birthTime: '10:00',
    hourUnknown: false,
    birthplace: '',
    alive: true,
    trueSolar: false,
    longitude: '120'
  })
  const [chart, setChart] = useState<BaziChart | null>(null)
  const [correction, setCorrection] = useState<CorrectionInfo | null>(null)
  const [lunarPreview, setLunarPreview] = useState<string>('')
  const [analysis, setAnalysis] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState('')
  const [history, setHistory] = useState<BaziHistoryRecord[]>([])
  const [draftReady, setDraftReady] = useState(false)
  const recordIdRef = useRef<string | null>(null)
  const analysisRef = useRef<string>('')
  const handleRef = useRef<ChatHandle | null>(null)

  useEffect(() => {
    void (async () => {
      const [list, draft] = await Promise.all([listBaziHistory(), loadBaziDraft()])
      setHistory(list as BaziHistoryRecord[])
      // 恢复上次填写的内容（草稿）
      const d = draft as {
        form?: Partial<FormState>
        chart?: BaziChart | null
        analysis?: string
        correction?: CorrectionInfo | null
      } | null
      if (d?.form) {
        setForm((prev) => ({ ...prev, ...d.form }))
        if (d.chart) setChart(d.chart)
        if (d.analysis) {
          setAnalysis(d.analysis)
          analysisRef.current = d.analysis
        }
        if (d.correction) setCorrection(d.correction)
      }
      setDraftReady(true)
    })()
  }, [])

  // 自动保存草稿（防抖）：切换界面后回来仍保留填写内容与排盘结果
  useEffect(() => {
    if (!draftReady) return
    const t = setTimeout(() => {
      void saveBaziDraft({ form, chart, analysis: analysisRef.current || analysis, correction })
    }, 400)
    return () => clearTimeout(t)
  }, [form, chart, analysis, correction, draftReady])

  const persistRecord = (record: BaziHistoryRecord): void => {
    void saveBaziHistory(record)
    setHistory((list) => {
      const idx = list.findIndex((r) => r.id === record.id)
      const next = idx >= 0 ? [...list] : [record, ...list]
      if (idx >= 0) next[idx] = record
      return next.slice(0, 30)
    })
  }

  const loadRecord = (r: BaziHistoryRecord): void => {
    if (analyzing) return
    setForm(r.form)
    setChart(r.chart)
    setAnalysis(r.analysis)
    setCorrection(null)
    recordIdRef.current = r.id
    toast.success(`已载入历史：${r.title}`)
  }

  const removeRecord = async (r: BaziHistoryRecord): Promise<void> => {
    await deleteBaziHistory(r.id)
    setHistory((list) => list.filter((x) => x.id !== r.id))
    if (recordIdRef.current === r.id) recordIdRef.current = null
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]): void =>
    setForm((f) => ({ ...f, [k]: v }))

  // 农历 → 阳历即时预览
  useEffect(() => {
    if (form.calendar !== 'lunar') {
      setLunarPreview('')
      return
    }
    const ly = Number(form.lunarYear)
    const lm = Number(form.lunarMonth)
    const ld = Number(form.lunarDay)
    if (!ly || !lm || !ld) {
      setLunarPreview('')
      return
    }
    try {
      const s = lunarToSolar(ly, form.lunarLeap ? -lm : lm, ld)
      setLunarPreview(`对应阳历 ${s.getYear()}-${String(s.getMonth()).padStart(2, '0')}-${String(s.getDay()).padStart(2, '0')}`)
    } catch {
      setLunarPreview('日期无效')
    }
  }, [form.calendar, form.lunarYear, form.lunarMonth, form.lunarLeap, form.lunarDay])

  const doPaiPan = (): void => {
    let hour: number | undefined
    let minute: number | undefined
    if (!form.hourUnknown && form.birthTime) {
      const [hh, mm] = form.birthTime.split(':').map(Number)
      hour = hh
      minute = mm
    }
    const longitude = form.trueSolar ? Number(form.longitude) : undefined
    let input: BaziInput
    let solarPreview: { y: number; m: number; d: number } | null = null

    if (form.calendar === 'lunar') {
      const ly = Number(form.lunarYear)
      const lm = Number(form.lunarMonth)
      const ld = Number(form.lunarDay)
      if (!ly || !lm || !ld) {
        toast.error('请填写完整的农历生日')
        return
      }
      const s = lunarToSolar(ly, form.lunarLeap ? -lm : lm, ld)
      solarPreview = { y: s.getYear(), m: s.getMonth(), d: s.getDay() }
      input = {
        calendar: 'lunar',
        lunarYear: ly,
        lunarMonth: form.lunarLeap ? -lm : lm,
        lunarDay: ld,
        year: s.getYear(),
        month: s.getMonth(),
        day: s.getDay(),
        hour,
        minute,
        gender: form.gender,
        longitude
      }
    } else {
      if (!form.birthDate) {
        toast.error('请选择出生日期')
        return
      }
      const [y, m, d] = form.birthDate.split('-').map(Number)
      solarPreview = { y, m, d }
      input = { year: y, month: m, day: d, hour, minute, gender: form.gender, longitude }
    }

    try {
      const result = computeBazi(input)
      setChart(result)
      setAnalysis('')
      analysisRef.current = ''
      // 保存排盘历史
      const id = recordIdRef.current ?? crypto.randomUUID()
      recordIdRef.current = id
      persistRecord({
        id,
        createdAt: Date.now(),
        title: `${form.name || '未命名'} · ${dateDesc}${hourKnown ? ' ' + form.birthTime : ''}`,
        form: { ...form },
        chart: result,
        analysis: ''
      })
      // 真太阳时校正信息
      if (typeof longitude === 'number' && hour !== undefined && minute !== undefined && solarPreview) {
        const off = trueSolarOffsetMinutes(solarPreview.y, solarPreview.m, solarPreview.d, longitude)
        const total = ((hour * 60 + minute + Math.round(off)) % 1440 + 1440) % 1440
        const usedH = Math.floor(total / 60)
        const usedM = total % 60
        const pad = (n: number): string => String(n).padStart(2, '0')
        setCorrection({
          offsetMin: off,
          originalTime: `${solarPreview.y}-${pad(solarPreview.m)}-${pad(solarPreview.d)} ${pad(hour)}:${pad(minute)}`,
          usedTime: `${pad(usedH)}:${pad(usedM)}`,
          longitude
        })
      } else {
        setCorrection(null)
      }
      toast.success('排盘完成')
    } catch (err) {
      toast.error(`排盘失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const doAnalyze = async (): Promise<void> => {
    if (!chart) {
      toast.error('请先完成排盘')
      return
    }
    const skill = await getSkillById('bazi')
    const system = buildBaziSystemPrompt(skill)
    const hourText = form.hourUnknown
      ? '未知'
      : `${form.birthTime || ''}（${form.gender === 'male' ? '男' : '女'}）`
    const profile = {
      name: form.name,
      gender: form.gender,
      birthdayText: `${dateDesc}${correction ? `（真太阳时校正 ${correction.offsetMin >= 0 ? '+' : ''}${correction.offsetMin.toFixed(1)} 分钟后为 ${correction.usedTime}）` : ''}`,
      hourText,
      birthplace: form.birthplace,
      alive: form.alive
    }
    setAnalysis('')
    analysisRef.current = ''
    setAnalyzing(true)
    setAnalysisStatus('准备请求…')

    const handle = startChat(
      {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: buildBaziUserPrompt(profile, chart) }
        ],
        temperature: 0.6,
        maxTokens: 4096
      },
      {
        onBegin: (info) => setAnalysisStatus(`正在使用 ${info.providerName}（${info.model}）分析…`),
        onChunk: (t) => {
          analysisRef.current += t
          setAnalysis((a) => a + t)
        },
        onProviderError: (info) =>
          setAnalysisStatus(`${info.providerName} 失败（${info.message}），正在切换备用模型…`),
        onFail: (msg) => {
          setAnalysisStatus('')
          toast.error(msg)
        }
      }
    )
    handleRef.current = handle
    void handle.result.finally(() => {
      setAnalyzing(false)
      setAnalysisStatus('')
      // 更新历史中的分析结果
      if (recordIdRef.current && chart) {
        const id = recordIdRef.current
        persistRecord({
          id,
          createdAt: Date.now(),
          title: `${form.name || '未命名'} · ${dateDesc}${hourKnown ? ' ' + form.birthTime : ''}`,
          form: { ...form },
          chart,
          analysis: analysisRef.current
        })
      }
    })
  }

  const stopAnalysis = (): void => {
    handleRef.current?.cancel()
    handleRef.current = null
    setAnalyzing(false)
    setAnalysisStatus('已停止')
  }

  const hourKnown = !form.hourUnknown
  const hourText = hourKnown ? form.birthTime || '' : '未知'
  const dateDesc =
    form.calendar === 'lunar'
      ? `农历${form.lunarYear}年${form.lunarLeap ? '闰' : ''}${form.lunarMonth}月${form.lunarDay}日`
      : form.birthDate

  const doExport = async (): Promise<void> => {
    if (!chart) return
    const content = buildBaziMarkdown({
      name: form.name,
      gender: form.gender,
      dateDesc,
      hourText,
      birthplace: form.birthplace,
      alive: form.alive,
      correction,
      chart,
      analysis: analysisRef.current || analysis
    })
    const r = await saveMarkdownFile(`${baziExportFileName(form.name, dateDesc)}.md`, content)
    if (r.ok) toast.success(`已导出：${r.path}`)
    else if (r.message !== '已取消') toast.error(r.message ?? '导出失败')
  }

  const doExportAnalysis = async (): Promise<void> => {
    const text = analysisRef.current || analysis
    if (!text) return
    const content = buildAnalysisMarkdown({
      name: form.name,
      dateDesc,
      dayMaster: chart?.dayMaster ?? '',
      currentYear: chart ? `${chart.currentYear.year}（${chart.currentYear.ganzhi}）` : '',
      analysis: text
    })
    const r = await saveMarkdownFile(`${baziExportFileName(form.name, dateDesc)}_分析.md`, content)
    if (r.ok) toast.success(`已导出：${r.path}`)
    else if (r.message !== '已取消') toast.error(r.message ?? '导出失败')
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">八字排盘</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          本地精确计算四柱 · 十神 · 藏干 · 纳音 · 大运流年，AI 按经典典籍进行命理分析
        </p>
      </div>

      {/* 信息收集 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="size-4 text-primary" />
            出生信息
          </CardTitle>
          <CardDescription>年柱以立春分界，月柱以节气分界；晚子时（23:00 后）日柱按次日计</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="b-name">姓名（选填）</Label>
              <Input
                id="b-name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="用于分析展示"
              />
            </div>
            <div className="grid gap-2">
              <Label>性别</Label>
              <div className="flex gap-2">
                {(
                  [
                    { id: 'male', label: '男' },
                    { id: 'female', label: '女' }
                  ] as const
                ).map((g) => (
                  <Button
                    key={g.id}
                    type="button"
                    size="sm"
                    variant={form.gender === g.id ? 'default' : 'outline'}
                    onClick={() => set('gender', g.id)}
                  >
                    {g.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-2 sm:col-span-2 lg:col-span-3">
              <Label>出生历法</Label>
              <div className="flex gap-2">
                {(
                  [
                    { id: 'solar', label: '阳历（公历）' },
                    { id: 'lunar', label: '农历（阴历）' }
                  ] as const
                ).map((c) => (
                  <Button
                    key={c.id}
                    type="button"
                    size="sm"
                    variant={form.calendar === c.id ? 'default' : 'outline'}
                    onClick={() => set('calendar', c.id)}
                  >
                    {c.label}
                  </Button>
                ))}
              </div>
            </div>
            {form.calendar === 'solar' ? (
              <div className="grid gap-2">
                <Label htmlFor="b-date">阳历生日</Label>
                <Input
                  id="b-date"
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => set('birthDate', e.target.value)}
                />
              </div>
            ) : (
              <div className="grid gap-2 sm:col-span-2 lg:col-span-3">
                <Label>农历生日（支持闰月）</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Input
                    type="number"
                    placeholder="年"
                    value={form.lunarYear}
                    onChange={(e) => set('lunarYear', e.target.value)}
                    min={1900}
                    max={2100}
                  />
                  <Input
                    type="number"
                    placeholder="月"
                    value={form.lunarMonth}
                    onChange={(e) => set('lunarMonth', e.target.value)}
                    min={1}
                    max={12}
                  />
                  <Input
                    type="number"
                    placeholder="日"
                    value={form.lunarDay}
                    onChange={(e) => set('lunarDay', e.target.value)}
                    min={1}
                    max={30}
                  />
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={form.lunarLeap}
                      onChange={(e) => set('lunarLeap', e.target.checked)}
                    />
                    闰月
                  </label>
                </div>
                {lunarPreview && (
                  <p className="text-xs text-muted-foreground">{lunarPreview}</p>
                )}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="b-time">出生时辰</Label>
              <Input
                id="b-time"
                type="time"
                value={form.birthTime}
                disabled={!hourKnown}
                onChange={(e) => set('birthTime', e.target.value)}
              />
            </div>
            <div className="flex items-end gap-4 pb-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={form.hourUnknown}
                  onChange={(e) => set('hourUnknown', e.target.checked)}
                />
                时辰未知（六字分析）
              </label>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="b-solar">真太阳时校正</Label>
              <div className="flex items-center gap-2">
                <Switch
                  id="b-solar"
                  checked={form.trueSolar}
                  onCheckedChange={(v) => set('trueSolar', v)}
                />
                <Input
                  type="number"
                  className="w-24"
                  value={form.longitude}
                  disabled={!form.trueSolar}
                  onChange={(e) => set('longitude', e.target.value)}
                  step={0.5}
                  min={73}
                  max={135}
                  placeholder="经度"
                />
                <span className="text-xs text-muted-foreground">东经°</span>
              </div>
              {form.trueSolar && (
                <p className="text-xs text-muted-foreground">
                  按经度差 + 均时差校正（如哈尔滨 126°E 约 +24 分钟）
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="b-place">出生地（选填）</Label>
              <Input
                id="b-place"
                value={form.birthplace}
                onChange={(e) => set('birthplace', e.target.value)}
                placeholder="如：辽宁省丹东市"
              />
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>
              已默认按「<span className="font-medium text-foreground">在世</span>」为您分析（当前时间{' '}
              {new Date().toLocaleString()}）。如需分析已故人士的八字，请在 AI 分析时说明，将按您提到的去世年份推算。
            </span>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="排盘历史">
                  <History className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-72" align="start">
                <DropdownMenuLabel>排盘历史（最多 30 条）</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {history.length === 0 ? (
                  <DropdownMenuItem disabled>暂无历史记录</DropdownMenuItem>
                ) : (
                  history.map((r) => (
                    <DropdownMenuItem
                      key={r.id}
                      onClick={() => loadRecord(r)}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{r.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {new Date(r.createdAt).toLocaleString()}
                          {r.analysis ? ' · 已分析' : ''}
                        </span>
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          void removeRecord(r)
                        }}
                        aria-label={`删除历史 ${r.title}`}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={doPaiPan}>开始排盘</Button>
            {chart && !analyzing && (
              <Button variant="outline" onClick={() => void doAnalyze()}>
                <Sparkles className="mr-1 size-4" />
                AI 命理分析
              </Button>
            )}
            {analyzing && (
              <Button variant="outline" onClick={stopAnalysis}>
                <Square className="mr-1 size-4" />
                停止分析
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 排盘结果 */}
      {chart && (
        <>
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">四柱排盘</CardTitle>
                <CardDescription>
                  {dateDesc} {hourKnown ? form.birthTime : '（时辰未知）'}
                  {correction &&
                    ` → 真太阳时 ${correction.usedTime}（东经 ${correction.longitude}°，校正 ${
                      correction.offsetMin >= 0 ? '+' : ''
                    }${correction.offsetMin.toFixed(1)} 分钟）`}
                  {' · '}
                  {chart.lunarText} · {form.gender === 'male' ? '男' : '女'}命
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  流年 {chart.currentYear.year} · {chart.currentYear.ganzhi}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => void doExport()}>
                  <Download className="mr-1 size-3.5" />
                  导出 MD
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">柱</TableHead>
                    <TableHead className="text-center">年柱</TableHead>
                    <TableHead className="text-center">月柱</TableHead>
                    <TableHead className="text-center">日柱</TableHead>
                    <TableHead className="text-center">{chart.pillars.hour ? '时柱' : '时柱（未知）'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-muted-foreground">天干</TableCell>
                    {[
                      chart.pillars.year,
                      chart.pillars.month,
                      chart.pillars.day,
                      chart.pillars.hour
                    ].map((p, i) => (
                      <TableCell key={i} className="text-center">
                        {p ? (
                          <span className={cn('text-lg font-semibold', WUXING_TEXT[p.ganWuxing])}>
                            {p.gan}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">地支</TableCell>
                    {[
                      chart.pillars.year,
                      chart.pillars.month,
                      chart.pillars.day,
                      chart.pillars.hour
                    ].map((p, i) => (
                      <TableCell key={i} className="text-center">
                        {p ? (
                          <span className={cn('text-lg font-semibold', WUXING_TEXT[p.zhiWuxing])}>
                            {p.zhi}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">十神</TableCell>
                    {[
                      chart.pillars.year,
                      chart.pillars.month,
                      chart.pillars.day,
                      chart.pillars.hour
                    ].map((p, i) => (
                      <TableCell key={i} className="text-center text-sm">
                        {p ? p.shishenGan : '—'}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">藏干</TableCell>
                    {[
                      chart.pillars.year,
                      chart.pillars.month,
                      chart.pillars.day,
                      chart.pillars.hour
                    ].map((p, i) => (
                      <TableCell key={i} className="text-center">
                        {p ? (
                          <span className="flex flex-wrap justify-center gap-1">
                            {p.hideGan.map((g) => (
                              <Badge key={g} variant="outline" className="text-[10px]">
                                {g}
                              </Badge>
                            ))}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">纳音</TableCell>
                    {[
                      chart.pillars.year,
                      chart.pillars.month,
                      chart.pillars.day,
                      chart.pillars.hour
                    ].map((p, i) => (
                      <TableCell key={i} className="text-center text-sm text-muted-foreground">
                        {p ? p.nayan : '—'}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>

              {/* 五行力量 */}
              <div>
                <p className="mb-2 text-sm font-medium">五行力量（{chart.pillars.hour ? '八字' : '六字'}）</p>
                <div className="grid grid-cols-5 gap-3">
                  {Object.entries(chart.wuxing).map(([w, n]) => (
                    <div key={w} className="rounded-lg border p-2 text-center">
                      <div className={cn('text-base font-semibold', WUXING_TEXT[w])}>{w}</div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full rounded-full', WUXING_COLORS[w])}
                          style={{ width: `${Math.min(100, n * 20)}%` }}
                        />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{n} 个</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 大运 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">大运</CardTitle>
              <CardDescription>
                日主 {chart.dayMaster} ·{' '}
                {form.gender === 'male' ? '阳男阴女顺排' : '阴男阳女顺排'}（起运按节气折算）
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>序</TableHead>
                      <TableHead>干支</TableHead>
                      <TableHead>年龄</TableHead>
                      <TableHead>公历年份</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chart.dayun.map((d) => (
                      <TableRow key={d.index}>
                        <TableCell className="text-muted-foreground">
                          {d.index === 0 ? '起运前' : `第 ${d.index} 步`}
                        </TableCell>
                        <TableCell className="font-medium">{d.ganzhi || '（小运）'}</TableCell>
                        <TableCell>
                          {d.startAge} - {d.endAge} 岁
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {d.startYear} - {d.endYear}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}

      {/* AI 分析结果 */}
      {(analysis || analyzing) && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="size-4 text-primary" />
              AI 命理分析
            </CardTitle>
            <div className="flex items-center gap-2">
              {analyzing && (
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  {analysisStatus || '生成中…'}
                </span>
              )}
              {!analyzing && (analysisRef.current || analysis) && (
                <Button variant="outline" size="sm" onClick={() => void doExportAnalysis()}>
                  <Download className="mr-1 size-3.5" />
                  导出分析
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {analysis ? (
              <Markdown content={analysis} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">分析生成中…</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
