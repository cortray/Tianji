/**
 * 运行形态判断。本包只面向微信小程序构建，恒为 true。
 */
export const isTaro: boolean = true

/** 返回当前运行形态描述 */
export function runtimeLabel(): string {
  return '微信小程序'
}
