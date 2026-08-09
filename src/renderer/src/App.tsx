import { lazy, Suspense, useState, type ReactNode } from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Toaster } from '@/components/ui/sonner'
import { useTheme } from 'next-themes'
import { Sparkles, Sun, Moon, Monitor } from 'lucide-react'
import { navGroups, getPageTitle, type PageId } from '@/lib/nav'
import { runtimeLabel } from '@/lib/platform'
import { OverviewPage } from '@/pages/OverviewPage'

// 非首屏页面按需加载（代码分割）
const BaziPage = lazy(() => import('@/pages/BaziPage').then((m) => ({ default: m.BaziPage })))
const ChatPage = lazy(() => import('@/pages/ChatPage').then((m) => ({ default: m.ChatPage })))
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
)

function PageLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-sm text-muted-foreground">
      <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
      加载中…
    </div>
  )
}

function renderPage(id: PageId, go: (id: PageId) => void) {
  const wrap = (node: ReactNode) => <Suspense fallback={<PageLoading />}>{node}</Suspense>
  switch (id) {
    case 'overview':
      return <OverviewPage go={go} />
    case 'bazi':
      return wrap(<BaziPage />)
    case 'chat':
      return wrap(<ChatPage />)
    case 'settings':
      return wrap(<SettingsPage />)
  }
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
          <Sparkles className="size-4" />
          <span>主题 · {theme === 'dark' ? '深色' : theme === 'light' ? '浅色' : '跟随系统'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="mr-2 size-4" /> 浅色
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="mr-2 size-4" /> 深色
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor className="mr-2 size-4" /> 跟随系统
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AppSidebar({ active, onNavigate }: { active: PageId; onNavigate: (id: PageId) => void }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </div>
          <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-semibold">天机</span>
            <span className="truncate text-xs text-muted-foreground">高可用客户端</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.id}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={active === item.id}
                      onClick={() => onNavigate(item.id)}
                      tooltip={item.label}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                      {item.badge && <Badge variant="secondary">{item.badge}</Badge>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <div className="p-2 group-data-[collapsible=icon]:p-1">
          <ThemeToggle />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function Shell() {
  const [active, setActive] = useState<PageId>('overview')

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar active={active} onNavigate={setActive} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <span className="text-sm font-medium">{getPageTitle(active)}</span>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {runtimeLabel()}
            </Badge>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{renderPage(active, setActive)}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function App() {
  return (
    <>
      <Shell />
      <Toaster position="bottom-right" richColors />
    </>
  )
}
