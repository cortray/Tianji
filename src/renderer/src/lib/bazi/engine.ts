import { Solar, Lunar, EightChar } from 'lunar-javascript'
import type { BaziChart, DaYun, Pillar } from '../types'

export interface BaziInput {
  /** 阳历或农历（默认阳历） */
  calendar?: 'solar' | 'lunar'
  /** 农历年（如 1990） */
  lunarYear?: number
  /** 农历月，负数表示闰月（如 -4 表示闰四月） */
  lunarMonth?: number
  /** 农历日（1-30） */
  lunarDay?: number
  year: number
  month: number
  day: number
  /** 0-23；不提供则时柱未知（六字分析） */
  hour?: number
  minute?: number
  gender: 'male' | 'female'
  /** 真太阳时校正：提供经度（东经，度）时按经度差 + 均时差校正出生时间 */
  longitude?: number
}

const GAN_WUXING: Record<string, string> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
  己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水'
}

const ZHI_WUXING: Record<string, string> = {
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
  午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水'
}

export function wuxingOfGan(gan: string): string {
  return GAN_WUXING[gan] ?? ''
}

export function wuxingOfZhi(zhi: string): string {
  return ZHI_WUXING[zhi] ?? ''
}

function makePillar(
  gan: string,
  zhi: string,
  shishenGan: string,
  shishenZhi: string[],
  hideGan: string[],
  nayan: string
): Pillar {
  return {
    gan,
    zhi,
    ganWuxing: wuxingOfGan(gan),
    zhiWuxing: wuxingOfZhi(zhi),
    shishenGan,
    shishenZhi,
    hideGan,
    nayan
  }
}

/** 一年中的第几天（1-366） */
function dayOfYear(year: number, month: number, day: number): number {
  const start = Date.UTC(year, 0, 1)
  const current = Date.UTC(year, month - 1, day)
  return Math.floor((current - start) / 86400000) + 1
}

/** 均时差（分钟），Spencer 近似，范围约 ±15 分钟 */
export function equationOfTime(year: number, month: number, day: number): number {
  const n = dayOfYear(year, month, day)
  const b = (2 * Math.PI * (n - 81)) / 364
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b)
}

/**
 * 真太阳时相对北京时间（UTC+8 平太阳时）的校正分钟数。
 * 正数 = 本地真太阳时晚于北京时间（如哈尔滨东经 126°，约 +24 分钟）。
 * = (经度 - 120) × 4 分钟 + 均时差
 */
export function trueSolarOffsetMinutes(
  year: number,
  month: number,
  day: number,
  longitude: number
): number {
  return (longitude - 120) * 4 + equationOfTime(year, month, day)
}

/** 农历（支持闰月：month 传负数）转阳历 */
export function lunarToSolar(year: number, month: number, day: number): Solar {
  return Lunar.fromYmd(year, month, day).getSolar()
}

/**
 * 本地精确排盘：
 * - 年柱以立春分界、月柱以节气分界、日柱按早晚子时（晚子时日柱算当天）
 * - 十神以日干为基准、藏干展开本气/中气/余气
 * - 大运按阳男阴女顺排/阴男阳女逆排，起运按出生日距最近节气天数折算
 * - 支持农历出生（闰月）与真太阳时校正（经度差 + 均时差，可能跨天）
 */
export function computeBazi(input: BaziInput): BaziChart {
  let solar: Solar
  if (input.calendar === 'lunar' && input.lunarYear && input.lunarMonth && input.lunarDay) {
    solar = lunarToSolar(input.lunarYear, input.lunarMonth, input.lunarDay)
  } else {
    solar = Solar.fromYmdHms(input.year, input.month, input.day, 0, 0, 0)
  }

  let hour = input.hour ?? 0
  let minute = input.minute ?? 0

  // 真太阳时校正（可能跨天）
  if (typeof input.longitude === 'number') {
    const offset = trueSolarOffsetMinutes(
      solar.getYear(),
      solar.getMonth(),
      solar.getDay(),
      input.longitude
    )
    const total = ((hour * 60 + minute + Math.round(offset)) % 1440 + 1440) % 1440
    hour = Math.floor(total / 60)
    minute = total % 60
  }

  solar = Solar.fromYmdHms(solar.getYear(), solar.getMonth(), solar.getDay(), hour, minute, 0)
  const lunar = Lunar.fromSolar(solar)
  const ec = EightChar.fromLunar(lunar)

  const pillars = {
    year: makePillar(
      ec.getYearGan(),
      ec.getYearZhi(),
      ec.getYearShiShenGan(),
      ec.getYearShiShenZhi(),
      ec.getYearHideGan(),
      ec.getYearNaYin()
    ),
    month: makePillar(
      ec.getMonthGan(),
      ec.getMonthZhi(),
      ec.getMonthShiShenGan(),
      ec.getMonthShiShenZhi(),
      ec.getMonthHideGan(),
      ec.getMonthNaYin()
    ),
    day: makePillar(
      ec.getDayGan(),
      ec.getDayZhi(),
      '日主',
      ec.getDayShiShenZhi(),
      ec.getDayHideGan(),
      ec.getDayNaYin()
    ),
    hour:
      typeof input.hour === 'number'
        ? makePillar(
            ec.getTimeGan(),
            ec.getTimeZhi(),
            ec.getTimeShiShenGan(),
            ec.getTimeShiShenZhi(),
            ec.getTimeHideGan(),
            ec.getTimeNaYin()
          )
        : null
  }

  // 五行力量统计（八字共 8 字，时柱未知则 6 字）
  const wuxing: Record<string, number> = { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 }
  const count = (w: string): void => {
    if (w && wuxing[w] !== undefined) wuxing[w]++
  }
  count(wuxingOfGan(ec.getYearGan()))
  count(wuxingOfZhi(ec.getYearZhi()))
  count(wuxingOfGan(ec.getMonthGan()))
  count(wuxingOfZhi(ec.getMonthZhi()))
  count(wuxingOfGan(ec.getDayGan()))
  count(wuxingOfZhi(ec.getDayZhi()))
  if (typeof input.hour === 'number') {
    count(wuxingOfGan(ec.getTimeGan()))
    count(wuxingOfZhi(ec.getTimeZhi()))
  }

  // 大运（10 步）
  const yun = ec.getYun(input.gender === 'male' ? 1 : 0, 2)
  const dayun: DaYun[] = yun.getDaYun(10).map((d) => ({
    index: d.getIndex(),
    startAge: d.getStartAge(),
    endAge: d.getEndAge(),
    ganzhi: d.getGanZhi(),
    startYear: d.getStartYear(),
    endYear: d.getEndYear()
  }))

  // 当前流年（以立春分界）
  const now = new Date()
  const nowLunar = Lunar.fromDate(now)
  const currentYear = { year: now.getFullYear(), ganzhi: nowLunar.getYearInGanZhiExact() }

  return {
    pillars,
    wuxing,
    dayMaster: ec.getDayGan(),
    dayun,
    currentYear,
    lunarText: `${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`
  }
}
