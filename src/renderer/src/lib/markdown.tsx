import { useMemo } from 'react'
import { marked, type Tokens } from 'marked'
import { cn } from '@/lib/utils'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function sanitizeHref(href: string): string {
  const h = href.trim()
  if (/^(https?:|mailto:|#|\/)/i.test(h)) return h
  return '#'
}

// 安全配置：原始 HTML 一律转义（防注入），链接仅放行 http(s)/mailto/#/ 相对路径
marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    html(token: { text: string }) {
      return escapeHtml(token.text)
    },
    link(token: Tokens.Link) {
      const href = sanitizeHref(token.href)
      const text = token.tokens?.length
        ? marked.parseInline(token.tokens as never)
        : token.text
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`
    }
  }
})

export function Markdown({ content, className }: { content: string; className?: string }) {
  const html = useMemo(() => marked.parse(content) as string, [content])
  return (
    <div
      className={cn('md-body break-words', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
