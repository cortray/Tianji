// lunar-javascript 1.7.x 类型声明（官方未附带 .d.ts）
declare module 'lunar-javascript' {
  export class Solar {
    static fromYmdHms(y: number, m: number, d: number, h: number, min: number, s: number): Solar
    static fromDate(d: Date): Solar
    getYear(): number
    getMonth(): number
    getDay(): number
    getHour(): number
    getMinute(): number
    getSecond(): number
  }

  export class Lunar {
    static fromDate(d: Date): Lunar
    static fromSolar(s: Solar): Lunar
    /** month 传负数表示闰月，如 -4 表示闰四月 */
    static fromYmd(year: number, month: number, day: number): Lunar
    getSolar(): Solar
    getYearInChinese(): string
    getMonthInChinese(): string
    getDayInChinese(): string
    getYearInGanZhiExact(): string
    getMonthInGanZhiExact(): string
    getDayInGanZhi(): string
    getTimeInGanZhi(): string
  }

  export class EightChar {
    static fromLunar(l: Lunar): EightChar
    getYear(): string
    getMonth(): string
    getDay(): string
    getTime(): string
    getYearGan(): string
    getYearZhi(): string
    getMonthGan(): string
    getMonthZhi(): string
    getDayGan(): string
    getDayZhi(): string
    getTimeGan(): string
    getTimeZhi(): string
    getYearHideGan(): string[]
    getMonthHideGan(): string[]
    getDayHideGan(): string[]
    getTimeHideGan(): string[]
    getYearShiShenGan(): string
    getMonthShiShenGan(): string
    getDayShiShenGan(): string
    getTimeShiShenGan(): string
    getYearShiShenZhi(): string[]
    getMonthShiShenZhi(): string[]
    getDayShiShenZhi(): string[]
    getTimeShiShenZhi(): string[]
    getYearNaYin(): string
    getMonthNaYin(): string
    getDayNaYin(): string
    getTimeNaYin(): string
    getYearWuXing(): string
    getMonthWuXing(): string
    getDayWuXing(): string
    getTimeWuXing(): string
    /** gender: 1 男 0 女；sect: 2 晚子时日柱算当天（默认） */
    getYun(gender: number, sect?: number): Yun
  }

  export class Yun {
    isForward(): boolean
    getDaYun(n?: number): DaYun[]
  }

  export class DaYun {
    getIndex(): number
    getGanZhi(): string
    getStartAge(): number
    getEndAge(): number
    getStartYear(): number
    getEndYear(): number
    getLiuNian(n?: number): LiuNian[]
  }

  export class LiuNian {
    getYear(): number
    getAge(): number
    getGanZhi(): string
  }
}
