import { Text } from '@tarojs/components'
import type { CSSProperties } from 'react'
import { cn } from '../../lib/utils'

export type IconName =
  | 'grid' | 'chat-dots' | 'gear' | 'stars' | 'shield-check' | 'lightning-charge'
  | 'layers' | 'calendar3' | 'clock-history' | 'moon-stars' | 'sun-fill' | 'flower1'
  | 'journal-text' | 'send' | 'send-plus' | 'stop-circle' | 'arrow-repeat' | 'magic'
  | 'clipboard-data' | 'person-badge' | 'robot' | 'person' | 'key-fill' | 'plug-fill'
  | 'plug' | 'database' | 'palette' | 'display' | 'pencil' | 'shield-lock' | 'sliders'
  | 'wifi' | 'cpu' | 'file-earmark-text' | 'cloud-arrow-up'
  | 'check-circle' | 'info-circle' | 'exclamation-triangle' | 'x-circle' | 'x-lg'
  | 'chevron-down' | 'chevron-up' | 'chevron-right' | 'chevron-left' | 'arrow-right'
  | 'plus-lg' | 'trash' | 'download' | 'copy' | 'check' | 'search'

export function Icon({
  name,
  size,
  color,
  className,
  style
}: {
  name: IconName | string
  size?: number | string
  color?: string
  className?: string
  style?: CSSProperties
}) {
  return (
    <Text
      className={cn('icon', `icon-${name}`, className)}
      style={{ fontSize: size ?? 32, color, ...style }}
    />
  )
}

/** 图标按钮（按压反馈） */
export function IconBtn({
  name,
  size,
  color,
  onClick,
  className,
  style
}: {
  name: IconName | string
  size?: number | string
  color?: string
  onClick?: () => void
  className?: string
  style?: CSSProperties
}) {
  return (
    <Text
      className={cn('icon icon-btn', `icon-${name}`, className)}
      style={{ fontSize: size ?? 32, color, ...style }}
      onClick={onClick}
    />
  )
}
