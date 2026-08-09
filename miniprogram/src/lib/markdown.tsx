import { useMemo } from 'react'
import { marked } from 'marked'
import { RichText } from '@tarojs/components'
import { cn } from './utils'

// marked 配置：GFM + 换行，链接做协议白名单过滤（防 javascript: 注入）
marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    link({ href, title, text }: { href: string | null; title?: string | null; text: string }) {
      const safe = href && /^(https?:|mailto:|#|\/)/i.test(href) ? href : '#'
      const t = title ? ` title="${title.replace(/"/g, '&quot;')}"` : ''
      return `<a href="${safe}"${t}>${text}</a>`
    },
    image({ text }: { href: string | null; title?: string | null; text: string }) {
      // 小程序 RichText 外链图片受域名白名单限制，回退为文本
      return `[图片：${text}]`
    }
  }
})

/**
 * Markdown 渲染（小程序版）：
 * marked 输出 HTML 字符串 → <RichText nodes> 渲染。
 * 微信 RichText 只渲染白名单标签（无 script/style），天然防注入。
 */
export function Markdown({ content, className }: { content: string; className?: string }) {
  const html = useMemo(() => {
    try {
      return marked.parse(content ?? '')
    } catch {
      return String(content ?? '')
    }
  }, [content])

  return (
    <RichText
      className={cn('md-body', className)}
      // @ts-ignore nodes 支持 HTML 字符串
      nodes={html}
    />
  )
}
