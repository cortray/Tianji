import type { ReactNode } from 'react'
import { Button as NButton, Tag as NTag, Empty as NEmpty, Loading as NLoading } from '@nutui/nutui-react-taro'

type NButtonProps = React.ComponentProps<typeof NButton>

/** NutUI Button 封装（天机默认 primary） */
export function Button({
  type = 'primary',
  size = 'normal',
  block = false,
  plain = false,
  disabled = false,
  loading = false,
  onClick,
  children,
  style
}: Partial<NButtonProps> & { children: ReactNode }) {
  return (
    <NButton
      type={type}
      size={size}
      block={block}
      plain={plain}
      disabled={disabled}
      loading={loading}
      onClick={onClick}
      style={style}
    >
      {children}
    </NButton>
  )
}

/** 徽章/标签 */
export function Badge({
  children,
  tone = 'primary',
  className
}: {
  children: ReactNode
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'default' | 'info'
  className?: string
}) {
  return (
    <NTag type={tone} round className={className}>
      {children}
    </NTag>
  )
}

/** 空状态 */
export function Empty({ text }: { text: string }) {
  return <NEmpty description={text} image='empty' />
}

/** 加载中 */
export function Loading({ text = '加载中…' }: { text?: string }) {
  return (
    <NLoading type='spinner' style={{ color: '#6d5ce7' }}>
      {text}
    </NLoading>
  )
}
