import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { loadConfig } from '../../lib/storage'
import { getAllSkills } from '../../lib/skills'
import { useTheme } from '../../lib/theme'
import type { AppConfig } from '../../lib/types'

export default function OverviewPage() {
  const { themeClass } = useTheme()
  const [stats, setStats] = useState({ providers: 0, keys: 0, skills: 0 })

  useEffect(() => {
    void (async () => {
      const [cfg, skills] = await Promise.all([loadConfig(), getAllSkills()])
      const providers = (cfg as AppConfig).providers ?? []
      setStats({
        providers: providers.filter((p) => p.enabled).length,
        keys: providers.reduce((n, p) => n + (p.apiKeys ?? []).length, 0),
        skills: skills.length
      })
    })()
  }, [])

  const go = (page: string) => {
    void Taro.switchTab({ url: `/pages/${page}/index` })
  }

  return (
    <View className={`page-pad ${themeClass}`}>
      {/* 头部 */}
      <View className='hero card'>
        <Text className='hero-title'>天机 AI</Text>
        <Text className='hero-sub'>本地八字排盘 · 高可用 AI 对话</Text>
        <View className='hero-badges'>
          <Text className='badge'>本地排盘</Text>
          <Text className='badge badge-success'>多模型容灾</Text>
        </View>
      </View>

      {/* 统计 */}
      <View className='stats-row'>
        <View className='stat card'>
          <Text className='stat-num'>{stats.providers}</Text>
          <Text className='stat-label'>启用 Provider</Text>
        </View>
        <View className='stat card'>
          <Text className='stat-num'>{stats.keys}</Text>
          <Text className='stat-label'>API Key</Text>
        </View>
        <View className='stat card'>
          <Text className='stat-num'>{stats.skills}</Text>
          <Text className='stat-label'>内置技能</Text>
        </View>
      </View>

      {/* 入口卡片 */}
      <View className='entry card' onClick={() => go('bazi')}>
        <View className='flex flex-col flex-1'>
          <Text className='entry-title'>🔮 八字排盘</Text>
          <Text className='entry-desc'>四柱、十神、大运、流年本地精确计算，一键 AI 命理分析</Text>
        </View>
        <Text className='entry-arrow'>›</Text>
      </View>

      <View className='entry card' onClick={() => go('chat')}>
        <View className='flex flex-col flex-1'>
          <Text className='entry-title'>💬 AI 对话</Text>
          <Text className='entry-desc'>内置「八字命理」技能驱动，流式输出，多会话管理</Text>
        </View>
        <Text className='entry-arrow'>›</Text>
      </View>

      <View className='entry card' onClick={() => go('settings')}>
        <View className='flex flex-col flex-1'>
          <Text className='entry-title'>⚙️ 设置</Text>
          <Text className='entry-desc'>模型 Provider、API Key、高可用参数、明暗主题</Text>
        </View>
        <Text className='entry-arrow'>›</Text>
      </View>

      {/* 说明 */}
      <View className='card'>
        <Text className='card-title'>高可用策略</Text>
        <Text className='card-body'>
          多 Provider 按优先级尝试，同一 Provider 可配多个 Key 轮询，首 token 超时自动切换，失败过程实时可视化。
          仅需在「设置」中配置一个 DeepSeek Key 即可使用。
        </Text>
      </View>

      <View className='btn btn-primary btn-block' onClick={() => go('bazi')}>
        开始排盘
      </View>
      <View className='footer-note'>命理分析仅供文化学习与娱乐参考</View>
    </View>
  )
}
