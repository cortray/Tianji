import {
  LayoutDashboard,
  CalendarRange,
  MessageSquareText,
  Settings,
  type LucideIcon
} from 'lucide-react'

export type PageId = 'overview' | 'bazi' | 'chat' | 'settings'

export interface NavItem {
  id: PageId
  label: string
  icon: LucideIcon
  badge?: string
}

export interface NavGroup {
  id: string
  label: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    id: 'main',
    label: '功能',
    items: [
      { id: 'overview', label: '概览', icon: LayoutDashboard },
      { id: 'bazi', label: '八字排盘', icon: CalendarRange },
      { id: 'chat', label: 'AI 对话', icon: MessageSquareText }
    ]
  },
  {
    id: 'system',
    label: '系统',
    items: [{ id: 'settings', label: '设置', icon: Settings }]
  }
]

export function getPageTitle(id: PageId): string {
  for (const g of navGroups) {
    const item = g.items.find((i) => i.id === id)
    if (item) return item.label
  }
  return id
}
