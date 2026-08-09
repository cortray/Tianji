import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { loadConfig } from '../../lib/storage'
import { getAllSkills } from '../../lib/skills'
import { useTheme } from '../../lib/theme'
import type { AppConfig } from '../../lib/types'
import { Icon, type IconName } from '../../components/ui/Icon'
import { Badge, Button } from '../../components/ui'

function OverviewPage() {
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

  const entries: {
    page: string
    icon: IconName
    iconBg: string
    iconColor: string
    title: string
    desc: string
  }[] = [
    {
      page: 'bazi',
      icon: 'calendar3',
      iconBg: '#efecfd',
      iconColor: '#6d5ce7',
      title: '八字排盘',
      desc: '四柱、十神、大运、流年本地精确计算，一键 AI 命理分析'
    },
    {
      page: 'chat',
      icon: 'chat-dots',
      iconBg: '#e6f9f0',
      iconColor: '#10b981',
      title: 'AI 对话',
      desc: '内置「八字命理」技能驱动，流式输出，多会话管理'
    },
    {
      page: 'settings',
      icon: 'gear',
      iconBg: '#fdf3dc',
      iconColor: '#d97706',
      title: '设置',
      desc: '模型 Provider、API Key、高可用参数、明暗主题'
    }
  ]

  return (
    <View className={`page-pad ${themeClass}`}>
      {/* 头部 */}
      <View className='hero card'>
        <View className='hero-icon'>
          <Icon name='magic' size={44} color='#ffffff' />
        </View>
        <Text className='hero-title'>天机 AI</Text>
        <Text className='hero-sub'>本地八字排盘 · 高可用 AI 对话</Text>
        <View className='hero-badges'>
          <Badge>本地排盘</Badge>
          <Badge tone='success'>多模型容灾</Badge>
          <Badge tone='warning'>流式输出</Badge>
        </View>
      </View>

      {/* 统计 */}
      <View className='stats-row'>
        <View className='stat card'>
          <Icon name='plug-fill' size={34} color='#6d5ce7' />
          <Text className='stat-num'>{stats.providers}</Text>
          <Text className='stat-label'>启用 Provider</Text>
        </View>
        <View className='stat card'>
          <Icon name='key-fill' size={34} color='#d97706' />
          <Text className='stat-num'>{stats.keys}</Text>
          <Text className='stat-label'>API Key</Text>
        </View>
        <View className='stat card'>
          <Icon name='layers' size={34} color='#10b981' />
          <Text className='stat-num'>{stats.skills}</Text>
          <Text className='stat-label'>内置技能</Text>
        </View>
      </View>

      {/* 入口列表 */}
      <View className='card'>
        {entries.map((e) => (
          <View key={e.page} className='list-item' onClick={() => go(e.page)}>
            <View className='list-item-icon' style={{ backgroundColor: e.iconBg }}>
              <Icon name={e.icon} size={34} color={e.iconColor} />
            </View>
            <View className='flex flex-col flex-1'>
              <Text className='list-item-title'>{e.title}</Text>
              <Text className='list-item-desc'>{e.desc}</Text>
            </View>
            <Icon name='chevron-right' size={26} color='#c7cbd6' />
          </View>
        ))}
      </View>

      {/* 说明 */}
      <View className='card'>
        <View className='flex items-center gap-sm'>
          <Icon name='shield-check' size={30} color='#6d5ce7' />
          <Text className='card-title'>高可用策略</Text>
        </View>
        <Text className='card-body'>
          多 Provider 按优先级尝试，同一 Provider 可配多个 Key 轮询，首 token 超时自动切换，失败过程实时可视化。
          仅需在「设置」中配置一个 DeepSeek Key 即可使用。
        </Text>
      </View>

      <Button block size='large' onClick={() => go('bazi')}>
        开始排盘
      </Button>
      <View className='footer-note'>命理分析仅供文化学习与娱乐参考</View>
    </View>
  )
}

export default OverviewPage

