declare module 'lunar-javascript' {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar
    static fromYmdHms(year: number, month: number, day: number, hour: number, minute: number, second: number): Solar
    static fromDate(date: Date): Solar
    getYear(): number
    getMonth(): number
    getDay(): number
    getHour(): number
    getMinute(): number
    getSecond(): number
    toYmdHms(): string
    toYmd(): string
  }

  export class Lunar {
    static fromYmd(year: number, month: number, day: number): Lunar
    static fromSolar(solar: Solar): Lunar
    static fromDate(date: Date): Lunar
    static fromYmdHms(year: number, month: number, day: number, hour: number, minute: number, second: number): Lunar
    getSolar(): Solar
    getYear(): number
    getMonth(): number
    getDay(): number
    getYearInChinese(): string
    getMonthInChinese(): string
    getDayInChinese(): string
    getYearInGanZhi(): string
    getYearInGanZhiExact(): string
    getMonthInGanZhi(): string
    getDayInGanZhi(): string
    getTimeInGanZhi(): string
    getJieQi(): string
    getPrevJieQi(wholeDay?: boolean): JieQi
    getNextJieQi(wholeDay?: boolean): JieQi
    getEightChar(): EightChar
  }

  export class JieQi {
    getName(): string
    getSolar(): Solar
  }

  export class EightChar {
    static fromLunar(lunar: Lunar): EightChar
    getYearGan(): string
    getYearZhi(): string
    getYearHideGan(): string[]
    getYearShiShenGan(): string
    getYearShiShenZhi(): string[]
    getYearNaYin(): string
    getMonthGan(): string
    getMonthZhi(): string
    getMonthHideGan(): string[]
    getMonthShiShenGan(): string
    getMonthShiShenZhi(): string[]
    getMonthNaYin(): string
    getDayGan(): string
    getDayZhi(): string
    getDayHideGan(): string[]
    getDayShiShenGan(): string
    getDayShiShenZhi(): string[]
    getDayNaYin(): string
    getTimeGan(): string
    getTimeZhi(): string
    getTimeHideGan(): string[]
    getTimeShiShenGan(): string
    getTimeShiShenZhi(): string[]
    getTimeNaYin(): string
    getYun(gender: number, sect: number): Yun
    getYearNaYin(): string
  }

  export class Yun {
    getDaYun(n: number): DaYun[]
    getStartYear(): number
    getStartMonth(): number
    getStartDay(): number
    getStartSolar(): Solar
    isForward(): boolean
  }

  export class DaYun {
    getIndex(): number
    getStartYear(): number
    getEndYear(): number
    getStartAge(): number
    getEndAge(): number
    getGanZhi(): string
    getXun(): string
    getXunKong(): string
  }

  export class LiuNian {
    getYear(): number
    getGanZhi(): string
    getAge(): number
    getIndex(): number
  }
}
