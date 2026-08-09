import { useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, Picker, Switch, Button, ScrollView } from '@tarojs/components'
import { computeBazi, lunarToSolar, trueSolarOffsetMinutes, type BaziInput } from '../../lib/bazi/engine'
import { buildBaziSystemPrompt, buildBaziUserPrompt } from '../../lib/bazi/prompt'
import { buildBaziMarkdown, buildAnalysisMarkdown, baziExportFileName } from '../../lib/bazi/export'
import { getSkillById } from '../../lib/skills'
import { startChat, type ChatHandle } from '../../lib/ai-client'
import {
  listBaziHistory,
  saveBaziHistory,
  deleteBaziHistory,
  loadBaziDraft,
  saveBaziDraft
} from '../../lib/storage'
import { saveMarkdownFile, copyText } from '../../lib/export-file'
import { Markdown } from '../../lib/markdown'
import { genId, formatDate } from '../../lib/date'
import { useTheme } from '../../lib/theme'
import type { BaziChart } from '../../lib/types'

const WUXING_TEXT: Record<string, string> = {
  金: '#f59e0b', 木: '#10b981', 水: '#0ea5e9', 火: '#f43f5e', 土: '#ca8a04'
}

function today(): string {
  return formatDate()
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

const DEFAULT_FORM: FormState = {
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
}

export default function BaziPage() {
  const { themeClass } = useTheme()
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [chart, setChart] = useState<BaziChart | null>(null)
  const [correction, setCorrection] = useState<CorrectionInfo | null>(null)
  const [lunarPreview, setLunarPreview] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState('')
  const [history, setHistory] = useState<BaziHistoryRecord[]>([])
  const [draftReady, setDraftReady] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const recordIdRef = useRef<string | null>(null)
  const analysisRef = useRef('')
  const handleRef = useRef<ChatHandle | null>(null)

  useEffect(() => {
    void (async () => {
      const [list, draft] = await Promise.all([listBaziHistory(), loadBaziDraft()])
      setHistory(list as BaziHistoryRecord[])
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

  // 自动保存草稿（防抖）
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
    analysisRef.current = r.analysis
    setCorrection(null)
    recordIdRef.current = r.id
    setShowHistory(false)
    Taro.showToast({ title: '已载入历史', icon: 'success' })
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
      setLunarPreview(
        `对应阳历 ${s.getYear()}-${String(s.getMonth()).padStart(2, '0')}-${String(s.getDay()).padStart(2, '0')}`
      )
    } catch {
      setLunarPreview('日期无效')
    }
  }, [form.calendar, form.lunarYear, form.lunarMonth, form.lunarLeap, form.lunarDay])

  const hourKnown = !form.hourUnknown
  const hourText = hourKnown ? form.birthTime || '' : '未知'
  const dateDesc =
    form.calendar === 'lunar'
      ? `农历${form.lunarYear}年${form.lunarLeap ? '闰' : ''}${form.lunarMonth}月${form.lunarDay}日`
      : form.birthDate

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
        Taro.showToast({ title: '请填写完整的农历生日', icon: 'none' })
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
        Taro.showToast({ title: '请选择出生日期', icon: 'none' })
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
      const id = recordIdRef.current ?? genId('bazi-')
      recordIdRef.current = id
      persistRecord({
        id,
        createdAt: Date.now(),
        title: `${form.name || '未命名'} · ${dateDesc}${hourKnown ? ' ' + form.birthTime : ''}`,
        form: { ...form },
        chart: result,
        analysis: ''
      })
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
      Taro.showToast({ title: '排盘完成', icon: 'success' })
    } catch (err) {
      Taro.showToast({ title: `排盘失败：${err instanceof Error ? err.message : String(err)}`.slice(0, 30), icon: 'none' })
    }
  }

  const doAnalyze = async (): Promise<void> => {
    if (!chart) {
      Taro.showToast({ title: '请先完成排盘', icon: 'none' })
      return
    }
    const skill = await getSkillById('bazi')
    const system = buildBaziSystemPrompt(skill)
    const profile = {
      name: form.name,
      gender: form.gender,
      birthdayText: `${dateDesc}${correction ? `（真太阳时校正 ${correction.offsetMin >= 0 ? '+' : ''}${correction.offsetMin.toFixed(1)} 分钟后为 ${correction.usedTime}）` : ''}`,
      hourText: `${hourText}（${form.gender === 'male' ? '男' : '女'}）`,
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
          Taro.showToast({ title: msg.slice(0, 30), icon: 'none', duration: 3000 })
        }
      }
    )
    handleRef.current = handle
    void handle.result.finally(() => {
      setAnalyzing(false)
      setAnalysisStatus('')
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

  const confirmRemoveRecord = (r: BaziHistoryRecord): void => {
    Taro.showModal({
      title: '删除记录',
      content: `确定删除「${r.title}」吗？`,
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) void removeRecord(r)
      }
    })
  }

  const pillars = chart ? [chart.pillars.year, chart.pillars.month, chart.pillars.day, chart.pillars.hour] : []
  const pillarNames = ['年柱', '月柱', '日柱', chart?.pillars.hour ? '时柱' : '时柱(未知)']
  const wuxingKeys = chart ? Object.keys(chart.wuxing) : []
  const maxWuxing = chart ? Math.max(...wuxingKeys.map((k) => chart.wuxing[k]), 1) : 1

  return (
    <ScrollView className={`page-scroll ${themeClass}`} scrollY>
      <View className='page-pad'>
        {/* ===== 输入表单 ===== */}
        <View className='card'>
          <Text className='card-title'>出生信息</Text>

          <View className='form-row'>
            <Text className='form-label'>姓名</Text>
            <Input className='input form-input' value={form.name} placeholder='（可选）' onInput={(e) => set('name', e.detail.value)} />
          </View>

          <View className='form-row'>
            <Text className='form-label'>性别</Text>
            <Picker mode='selector' range={['男', '女']} value={form.gender === 'male' ? 0 : 1} onChange={(e) => set('gender', Number(e.detail.value) === 0 ? 'male' : 'female')}>
              <View className='input form-input form-picker'><Text>{form.gender === 'male' ? '男' : '女'}</Text><Text className='text-muted'>▾</Text></View>
            </Picker>
          </View>

          <View className='form-row'>
            <Text className='form-label'>历法</Text>
            <Picker mode='selector' range={['阳历（公历）', '农历']} value={form.calendar === 'solar' ? 0 : 1} onChange={(e) => set('calendar', Number(e.detail.value) === 0 ? 'solar' : 'lunar')}>
              <View className='input form-input form-picker'><Text>{form.calendar === 'solar' ? '阳历（公历）' : '农历'}</Text><Text className='text-muted'>▾</Text></View>
            </Picker>
          </View>

          {form.calendar === 'solar' ? (
            <View className='form-row'>
              <Text className='form-label'>阳历生日</Text>
              <Picker mode='date' value={form.birthDate} start='1900-01-01' end='2100-12-31' onChange={(e) => set('birthDate', e.detail.value)}>
                <View className='input form-input form-picker'><Text>{form.birthDate}</Text><Text className='text-muted'>▾</Text></View>
              </Picker>
            </View>
          ) : (
            <>
              <View className='form-row'>
                <Text className='form-label'>农历年</Text>
                <Input className='input form-input' type='number' value={form.lunarYear} onInput={(e) => set('lunarYear', e.detail.value)} />
              </View>
              <View className='form-row'>
                <Text className='form-label'>农历月</Text>
                <View className='flex flex-1 items-center gap-sm'>
                  <Input className='input form-input flex-1' type='number' value={form.lunarMonth} onInput={(e) => set('lunarMonth', e.detail.value)} />
                  <Text className='text-sm'>闰月</Text>
                  <Switch checked={form.lunarLeap} color='#4f46e5' onChange={(e) => set('lunarLeap', e.detail.value)} />
                </View>
              </View>
              <View className='form-row'>
                <Text className='form-label'>农历日</Text>
                <Input className='input form-input' type='number' value={form.lunarDay} onInput={(e) => set('lunarDay', e.detail.value)} />
              </View>
            </>
          )}

          <View className='form-row'>
            <Text className='form-label'>出生时辰</Text>
            {form.hourUnknown ? (
              <View className='input form-input form-picker'><Text className='text-muted'>未知（六字分析）</Text></View>
            ) : (
              <Picker mode='time' value={form.birthTime} onChange={(e) => set('birthTime', e.detail.value)}>
                <View className='input form-input form-picker'><Text>{form.birthTime}</Text><Text className='text-muted'>▾</Text></View>
              </Picker>
            )}
          </View>
          <View className='form-row'>
            <Text className='form-label'>时辰未知</Text>
            <Switch checked={form.hourUnknown} color='#4f46e5' onChange={(e) => set('hourUnknown', e.detail.value)} />
          </View>

          <View className='form-row'>
            <Text className='form-label'>出生地</Text>
            <Input className='input form-input' value={form.birthplace} placeholder='（可选）' onInput={(e) => set('birthplace', e.detail.value)} />
          </View>
          <View className='form-row'>
            <Text className='form-label'>在世状态</Text>
            <Picker mode='selector' range={['在世', '已故']} value={form.alive ? 0 : 1} onChange={(e) => set('alive', Number(e.detail.value) === 0)}>
              <View className='input form-input form-picker'><Text>{form.alive ? '在世' : '已故'}</Text><Text className='text-muted'>▾</Text></View>
            </Picker>
          </View>

          <View className='form-row'>
            <Text className='form-label'>真太阳时</Text>
            <Switch checked={form.trueSolar} color='#4f46e5' onChange={(e) => set('trueSolar', e.detail.value)} />
          </View>
          {form.trueSolar && (
            <View className='form-row'>
              <Text className='form-label'>东经（°）</Text>
              <Input className='input form-input' type='digit' value={form.longitude} onInput={(e) => set('longitude', e.detail.value)} />
            </View>
          )}

          {lunarPreview && <Text className='lunar-preview'>{lunarPreview}</Text>}

          <View className='btn btn-primary btn-block mt-md' onClick={doPaiPan}>开始排盘</View>
        </View>

        {/* ===== 历史 ===== */}
        <View className='flex items-center justify-between'>
          <Text className='text-sm text-secondary'>排盘历史（{history.length}/30）</Text>
          <Text className='link' onClick={() => setShowHistory(!showHistory)}>{showHistory ? '收起' : '查看'}</Text>
        </View>
        {showHistory && (
          <View className='card'>
            {history.length === 0 ? (
              <Text className='text-muted'>暂无历史记录</Text>
            ) : (
              history.map((r) => (
                <View key={r.id} className='session-item'>
                  <View className='flex-1' onClick={() => loadRecord(r)}>
                    <Text className='session-title'>{r.title}</Text>
                    <Text className='session-time'>{new Date(r.createdAt).toLocaleString().slice(5, 16)}{r.analysis ? ' · 已分析' : ''}</Text>
                  </View>
                  <Text className='session-del' onClick={() => confirmRemoveRecord(r)}>删除</Text>
                </View>
              ))
            )}
          </View>
        )}

        {/* ===== 排盘结果 ===== */}
        {chart && (
          <>
            <View className='card'>
              <View className='flex items-center justify-between'>
                <Text className='card-title'>四柱排盘</Text>
                <Text className='text-sm text-secondary'>{chart.lunarText}</Text>
              </View>
              <View className='pillar-row'>
                {pillarNames.map((n, i) => (
                  <View key={n} className='pillar-col'>
                    <Text className='pillar-name'>{n}</Text>
                    <Text className='pillar-gan' style={pillars[i] ? { color: WUXING_TEXT[pillars[i]!.ganWuxing] || '#111827' } : {}}>
                      {pillars[i]?.gan ?? '—'}
                    </Text>
                    <Text className='pillar-zhi' style={pillars[i] ? { color: WUXING_TEXT[pillars[i]!.zhiWuxing] || '#111827' } : {}}>
                      {pillars[i]?.zhi ?? '—'}
                    </Text>
                    <Text className='pillar-small'>{pillars[i]?.shishenGan ?? ''}</Text>
                    <Text className='pillar-small'>{pillars[i]?.hideGan.join('、') ?? ''}</Text>
                    <Text className='pillar-small text-muted'>{pillars[i]?.nayan ?? ''}</Text>
                  </View>
                ))}
              </View>
              <View className='separator' />
              <Text className='text-sm text-secondary'>日主：<Text className='font-bold' style={{ color: WUXING_TEXT[chart.dayMaster] || '#111827' }}>{chart.dayMaster}</Text>
                {'　'}流年：{chart.currentYear.year}（{chart.currentYear.ganzhi}）
              </Text>
              {correction && (
                <Text className='text-sm text-secondary correction-line'>
                  真太阳时校正：{correction.originalTime} → {correction.usedTime}（东经 {correction.longitude}°，校正 {correction.offsetMin >= 0 ? '+' : ''}{correction.offsetMin.toFixed(1)} 分钟）
                </Text>
              )}
            </View>

            <View className='card'>
              <Text className='card-title'>五行力量</Text>
              {wuxingKeys.map((k) => (
                <View key={k} className='wuxing-row'>
                  <Text className='wuxing-label' style={{ color: WUXING_TEXT[k] }}>{k}</Text>
                  <View className='wuxing-bar'>
                    <View className='wuxing-fill' style={{ width: `${(chart.wuxing[k] / maxWuxing) * 100}%`, backgroundColor: WUXING_TEXT[k] }} />
                  </View>
                  <Text className='wuxing-num'>{chart.wuxing[k]}</Text>
                </View>
              ))}
            </View>

            <View className='card'>
              <Text className='card-title'>大运</Text>
              <View className='table-scroll'>
                <View className='tbl'>
                  <View className='tbl-row tbl-head'>
                    <View className='tbl-cell'><Text>序</Text></View>
                    <View className='tbl-cell'><Text>干支</Text></View>
                    <View className='tbl-cell'><Text>年龄</Text></View>
                    <View className='tbl-cell'><Text>公历年份</Text></View>
                  </View>
                  {chart.dayun.map((d) => (
                    <View key={d.index} className='tbl-row'>
                      <View className='tbl-cell'><Text>{d.index === 0 ? '起运前' : `第${d.index}`}</Text></View>
                      <View className='tbl-cell'><Text>{d.ganzhi || '小运'}</Text></View>
                      <View className='tbl-cell'><Text>{d.startAge}-{d.endAge}岁</Text></View>
                      <View className='tbl-cell'><Text>{d.startYear}-{d.endYear}</Text></View>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </>
        )}

        {/* ===== AI 分析 ===== */}
        {chart && (
          <View className='card'>
            <Text className='card-title'>AI 命理分析</Text>
            {analysis === '' && !analyzing ? (
              <View className='btn btn-primary btn-block' onClick={() => void doAnalyze()}>
                🔮 开始 AI 分析
              </View>
            ) : (
              <>
                {analysis !== '' && <Markdown content={analysis} />}
                {analyzing && (
                  <View className='chat-status'>
                    <Text className='text-muted text-sm'>{analysisStatus || '生成中…'}</Text>
                  </View>
                )}
                {!analyzing && (
                  <View className='flex gap-sm mt-md'>
                    <Button className='btn btn-outline btn-sm flex-1' onClick={() => void doAnalyze()}>重新分析</Button>
                    <Button className='btn btn-outline btn-sm flex-1' onClick={() => void doExportAnalysis()}>导出分析</Button>
                  </View>
                )}
              </>
            )}
            {chart && analysis !== '' && (
              <Button className='btn btn-ghost btn-sm btn-block mt-sm' onClick={() => void doExport()}>导出完整排盘（Markdown）</Button>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  )
}
