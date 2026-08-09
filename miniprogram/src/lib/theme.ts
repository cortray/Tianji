import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { loadConfig, saveConfig } from './storage'
import type { AppConfig } from './types'

export type Theme = 'light' | 'dark' | 'system'

export interface ThemeState {
  theme: Theme
  themeClass: string
  setTheme: (t: Theme) => void
}

/**
 * 主题 hook：读取配置中的 theme，返回当前生效主题与页面根节点 class。
 * 小程序无 next-themes，用 CSS class（.theme-dark）切换。
 */
export function useTheme(): ThemeState {
  const [theme, setThemeState] = useState<Theme>('light')

  useEffect(() => {
    void loadConfig().then((cfg) => setThemeState((cfg as AppConfig).theme ?? 'light'))
  }, [])

  const setTheme = (t: Theme): void => {
    setThemeState(t)
    void loadConfig().then((cfg) => {
      void saveConfig({ ...(cfg as AppConfig), theme: t })
    })
    if (t === 'dark') {
      Taro.setBackgroundColor({ backgroundColor: '#111827' })
      Taro.setNavigationBarColor({ frontColor: '#ffffff', backgroundColor: '#111827' })
    } else {
      Taro.setBackgroundColor({ backgroundColor: '#f9fafb' })
      Taro.setNavigationBarColor({ frontColor: '#000000', backgroundColor: '#ffffff' })
    }
  }

  return { theme, themeClass: theme === 'dark' ? 'theme-dark' : '', setTheme }
}
