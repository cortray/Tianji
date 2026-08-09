import type { BaziChart } from '../types'
import { formatDateTime } from '../date'

export interface BaziExportInput {
  name: string
  gender: 'male' | 'female'
  /** 出生日期描述（含农历/校正等） */
  dateDesc: string
  hourText: string
  birthplace: string
  alive: boolean
  correction?: {
    offsetMin: number
    originalTime: string
    usedTime: string
    longitude: number
  } | null
  chart: BaziChart
  analysis: string
}

/** 将排盘结果（+ AI 分析）组装为 Markdown 文本 */
export function buildBaziMarkdown(input: BaziExportInput): string {
  const { chart, correction } = input
  const gender = input.gender === 'male' ? '男' : '女'
  const lines: string[] = []

  lines.push('# 八字排盘 · 天机 AI', '')

  // 基本信息
  lines.push('## 基本信息', '')
  lines.push(`- 姓名：${input.name || '（未提供）'}`)
  lines.push(`- 性别：${gender}`)
  lines.push(`- 出生日期：${input.dateDesc}`)
  lines.push(`- 出生时辰：${input.hourText || '未知'}`)
  if (correction) {
    lines.push(
      `- 真太阳时校正：${correction.originalTime} → ${correction.usedTime}（东经 ${correction.longitude}°，校正 ${
        correction.offsetMin >= 0 ? '+' : ''
      }${correction.offsetMin.toFixed(1)} 分钟）`
    )
  }
  lines.push(`- 出生地：${input.birthplace || '（未提供）'}`)
  lines.push(`- 在世状态：${input.alive ? '在世' : '已故'}`)
  lines.push(`- 农历：${chart.lunarText}`)
  lines.push(`- 日主：${chart.dayMaster}`)
  lines.push(`- 当前流年：${chart.currentYear.year} 年（${chart.currentYear.ganzhi}）`)
  lines.push('')

  // 四柱排盘
  lines.push('## 四柱排盘', '')
  const pillars = [chart.pillars.year, chart.pillars.month, chart.pillars.day, chart.pillars.hour]
  const headers = ['柱', '年柱', '月柱', '日柱', chart.pillars.hour ? '时柱' : '时柱（未知）']
  const rows: Record<string, string[]> = {
    天干: pillars.map((p) => (p ? `${p.gan}（${p.ganWuxing}）` : '—')),
    地支: pillars.map((p) => (p ? `${p.zhi}（${p.zhiWuxing}）` : '—')),
    十神: pillars.map((p) => (p ? p.shishenGan : '—')),
    藏干: pillars.map((p) => (p ? p.hideGan.join('、') : '—')),
    纳音: pillars.map((p) => (p ? p.nayan : '—'))
  }
  lines.push(`| ${headers.join(' | ')} |`)
  lines.push(`| ${headers.map(() => '---').join(' | ')} |`)
  for (const [label, cells] of Object.entries(rows)) {
    lines.push(`| ${label} | ${cells.join(' | ')} |`)
  }
  lines.push('')

  // 五行力量
  lines.push('## 五行力量', '')
  lines.push(
    `| ${Object.keys(chart.wuxing).join(' | ')} |`,
    `| ${Object.keys(chart.wuxing)
      .map(() => '---')
      .join(' | ')} |`,
    `| ${Object.values(chart.wuxing).join(' | ')} |`
  )
  lines.push('')

  // 大运
  lines.push('## 大运', '')
  lines.push('| 序 | 干支 | 年龄 | 公历年份 |', '| --- | --- | --- | --- |')
  for (const d of chart.dayun) {
    lines.push(
      `| ${d.index === 0 ? '起运前' : `第 ${d.index} 步`} | ${d.ganzhi || '（小运）'} | ${d.startAge} - ${d.endAge} 岁 | ${d.startYear} - ${d.endYear} |`
    )
  }
  lines.push('')

  // AI 命理分析
  if (input.analysis) {
    lines.push('## AI 命理分析', '')
    lines.push(input.analysis, '')
  }

  lines.push('---', '')
  lines.push(`> 由 天机 AI 客户端生成 · ${formatDateTime()}`)
  lines.push('> 命理分析仅供参考，人生在于自身的努力和选择。')

  return lines.join('\n')
}

/** 生成导出文件名（不含扩展名） */
export function baziExportFileName(name: string, dateDesc: string): string {
  const safe = name.trim() || '未命名'
  const date = dateDesc.replace(/[^\d-]/g, '').slice(0, 10) || ''
  return `八字排盘_${safe}_${date}`.replace(/[\\/:*?"<>|]/g, '_')
}

/** 仅导出 AI 命理分析内容（不含排盘表格） */
export function buildAnalysisMarkdown(input: {
  name: string
  dateDesc: string
  dayMaster: string
  currentYear: string
  analysis: string
}): string {
  const lines: string[] = []
  lines.push('# AI 命理分析 · 天机 AI', '')
  lines.push(`- 姓名：${input.name || '（未提供）'}`)
  lines.push(`- 出生日期：${input.dateDesc}`)
  lines.push(`- 日主：${input.dayMaster}`)
  lines.push(`- 当前流年：${input.currentYear}`)
  lines.push('')
  lines.push('---', '')
  lines.push(input.analysis || '（暂无分析内容）', '')
  lines.push('---', '')
  lines.push(`> 由 天机 AI 客户端生成 · ${formatDateTime()}`)
  lines.push('> 命理分析仅供参考，人生在于自身的努力和选择。')
  return lines.join('\n')
}
