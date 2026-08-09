/** 运行形态判断：Electron 桌面（有 window.api）还是 Web 浏览器 */
export const isElectron: boolean = typeof window !== 'undefined' && !!window.api

/** 返回当前运行形态描述 */
export function runtimeLabel(): string {
  if (isElectron) {
    const v = window.api?.versions
    return `Electron ${v?.electron ?? ''} · Chrome ${v?.chrome ?? ''}`
  }
  return 'Web 浏览器'
}
