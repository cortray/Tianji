/** 补零 */
function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/**
 * 格式化日期时间，替代 toLocaleString（微信小程序对 Intl 支持不完整）。
 * 输出如 2026-08-09 14:33:05
 */
export function formatDateTime(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 格式化日期，输出如 2026-08-09 */
export function formatDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 生成唯一 id（小程序无 crypto.randomUUID，用时间戳 + 随机数兜底） */
export function genId(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 10)
  const ts = Date.now().toString(36)
  return `${prefix}${ts}${rand}`
}
