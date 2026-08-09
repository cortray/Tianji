// 本地 mock OpenAI 兼容服务器：用于端到端验证 AI 流式链路（无真实 Key 也可测）
const http = require('http')

const PORT = Number(process.env.PORT || 18331)
const TEXT = '你好，世界！这是一条来自 mock 模型的流式回复。'

const server = http.createServer((req, res) => {
  const url = req.url || ''
  if (url.includes('/chat/completions')) {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      let json = {}
      try {
        json = JSON.parse(body || '{}')
      } catch {
        json = {}
      }
      const model = json.model || ''
      if (model === 'mock-fail') {
        // 模拟服务端错误，用于验证故障切换
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: { message: 'mock 模拟服务端错误' } }))
        return
      }
      if (!json.stream) {
        // 非流式：测试连接用
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'pong' } }] }))
        return
      }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      })
      const chars = Array.from(TEXT)
      let i = 0
      const timer = setInterval(() => {
        if (i < chars.length) {
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chars[i] } }] })}\n\n`)
          i++
        } else {
          res.write('data: [DONE]\n\n')
          clearInterval(timer)
          res.end()
        }
      }, 30)
    })
  } else {
    res.writeHead(404)
    res.end('not found')
  }
})

server.listen(PORT, () => {
  console.log(`[mock-ai] listening on http://127.0.0.1:${PORT}`)
})
