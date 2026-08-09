import { View, Text } from '@tarojs/components'
import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { Icon, type IconName } from './Icon'

/** 卡片容器 */
export function Card({
  children,
  className,
  onClick
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
}) {
  return (
    <View className={cn('card', onClick && 'card-tappable', className)} onClick={onClick}>
      {children}
    </View>
  )
}

/** 卡片标题行（可选图标） */
export function CardTitle({
  icon,
  title,
  extra,
  desc
}: {
  icon?: IconName
  title: string
  extra?: ReactNode
  desc?: string
}) {
  return (
    <View className='card-head'>
      <View className='flex items-center gap-sm'>
        {icon && <Icon name={icon} size={30} color='#6d5ce7' />}
        <Text className='card-title'>{title}</Text>
      </View>
      {extra}
      {desc && <Text className='card-body'>{desc}</Text>}
    </View>
  )
}

/** 徽章 */
export function Badge({
  children,
  tone = 'primary',
  className
}: {
  children: ReactNode
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral'
  className?: string
}) {
  const map = {
    primary: 'badge',
    success: 'badge badge-success',
    warning: 'badge badge-warning',
    danger: 'badge badge-danger',
    neutral: 'badge badge-neutral'
  }
  return <Text className={cn(map[tone], className)}>{children}</Text>
}

/** 空状态 */
export function Empty({ icon = 'search', text }: { icon?: IconName; text: string }) {
  return (
    <View className='empty'>
      <Icon name={icon} size={72} color='#d1d5db' />
      <Text className='empty-text'>{text}</Text>
    </View>
  )
}

/** 加载中 */
export function Loading({ text = '加载中…' }: { text?: string }) {
  return (
    <View className='loading'>
      <View className='loading-spinner' />
      <Text className='text-muted text-sm'>{text}</Text>
    </View>
  )
}

/** 分段选择器 */
export function Segmented<T extends string>({
  options,
  value,
  onChange
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <View className='segmented'>
      {options.map((o) => (
        <View
          key={o.value}
          className={cn('segmented-item', value === o.value && 'segmented-active')}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </View>
      ))}
    </View>
  )
}
