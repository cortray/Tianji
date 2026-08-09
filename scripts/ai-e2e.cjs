// AI 流式链路端到端测试：
// 1) 启动本地 mock OpenAI SSE 服务器（由外部脚本启动，见 mock-ai-server.cjs）
// 2) 用临时 userData + 指向 mock 的配置启动真实应用（out/main/index.js）
// 3) 通过 Chrome DevTools Protocol 在渲染进程内调用 window.api.aiChat，验证事件流
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const os = require('os')

const MOCK_PORT = 18331
const DEBUG_PORT = 19222

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getTargets() {
  const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)
  return res.json()
}

async function main() {
  // 临时 userData + mock 配置（3 个 provider：两个会失败，一个成功 → 验证故障切换）
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tianji-e2e-'))
  const cfg = {
    providers: [
      {
        id: 'mock-fail',
        name: 'MockFail',
        baseURL: `http://127.0.0.1:${MOCK_PORT}/v1`,
        model: 'mock-fail',
        apiKeys: ['sk-test'],
        enabled: true,
        priority: 0,
        createdAt: Date.now()
      },
      {
        id: 'mock-fail2',
        name: 'MockFail2',
        baseURL: `http://127.0.0.1:${MOCK_PORT}/v1`,
        model: 'mock-fail',
        apiKeys: ['sk-test'],
        enabled: true,
        priority: 1,
        createdAt: Date.now()
      },
      {
        id: 'mock',
        name: 'Mock',
        baseURL: `http://127.0.0.1:${MOCK_PORT}/v1`,
        model: 'mock-model',
        apiKeys: ['sk-test'],
        enabled: true,
        priority: 2,
        createdAt: Date.now()
      }
    ],
    ha: { firstTokenTimeoutMs: 8000, maxFailovers: 3 },
    theme: 'dark',
    version: 1
  }
  fs.writeFileSync(path.join(tmp, 'config.json'), JSON.stringify(cfg))

  const electronBin = path.join(
    __dirname,
    '..',
    'node_modules',
    'electron',
    'dist',
    process.platform === 'win32' ? 'electron.exe' : 'electron'
  )
  const child = spawn(
    electronBin,
    [
      path.join(__dirname, '..', 'out', 'main', 'index.js'),
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${tmp}`
    ],
    { stdio: 'ignore' }
  )

  let targets = null
  for (let i = 0; i < 40; i++) {
    try {
      const t = await getTargets()
      if (Array.isArray(t) && t.some((x) => x.type === 'page')) {
        targets = t
        break
      }
    } catch {
      /* CDP 未就绪 */
    }
    await sleep(500)
  }
  if (!targets) {
    console.log('AI E2E FAIL: CDP 未就绪')
    child.kill()
    process.exit(1)
  }

  const page = targets.find((t) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = () => reject(new Error('ws error'))
  })

  let msgId = 0
  const pending = new Map()
  ws.onmessage = (ev) => {
    const m = JSON.parse(String(ev.data))
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m)
      pending.delete(m.id)
    }
  }
  const send = (method, params) =>
    new Promise((resolve) => {
      const id = ++msgId
      pending.set(id, resolve)
      ws.send(JSON.stringify({ id, method, params }))
    })
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    })
    return r.result && r.result.result ? r.result.result.value : undefined
  }

  // 场景函数：在渲染进程内跑一次真实 aiChat 调用，等待终态后返回收集结果
  const runChat = async (tag) => {
    await evaluate(`window.__e2e = { chunks: '', events: [], done: false, fail: '', rid: '' }`)
    await evaluate(`window.__e2e.off = window.api.onAiEvent((e) => {
      __e2e.events.push(e.type)
      if (e.type === 'chunk') __e2e.chunks += e.text
      if (e.type === 'done') __e2e.done = true
      if (e.type === 'fail') __e2e.fail = e.message
    })`)
    await evaluate(
      `window.api.aiChat({ messages: [{ role: 'user', content: '你好' }] }).then((rid) => { __e2e.rid = rid })`
    )
    let raw = '{}'
    for (let i = 0; i < 60; i++) {
      await sleep(300)
      raw = (await evaluate('JSON.stringify(__e2e)')) || '{}'
      const r = JSON.parse(raw)
      if (r.done || r.fail) break
    }
    const r = JSON.parse(raw)
    console.log(`[e2e:${tag}] rid:`, r.rid)
    console.log(`[e2e:${tag}] events:`, r.events.join(','))
    console.log(`[e2e:${tag}] chunks:`, JSON.stringify(r.chunks))
    if (r.fail) console.log(`[e2e:${tag}] fail:`, r.fail)
    return r
  }

  // 场景 A：故障切换 —— 前两个 provider 返回 500，第三个成功
  const a = await runChat('failover')
  const okA =
    a.done &&
    a.chunks.includes('你好，世界') &&
    a.events.filter((t) => t === 'begin').length === 3 &&
    a.events.filter((t) => t === 'error').length === 2 &&
    a.events.includes('done')

  // 场景 B：全部失败 —— 改写配置只留失败的 provider，应收到 fail 事件而非卡死
  fs.writeFileSync(
    path.join(tmp, 'config.json'),
    JSON.stringify({
      ...cfg,
      providers: [cfg.providers[0]],
      ha: { firstTokenTimeoutMs: 8000, maxFailovers: 0 }
    })
  )
  const b = await runChat('all-fail')
  const okB = b.fail.length > 0 && !b.done

  const ok = okA && okB
  console.log('场景A 故障切换:', okA ? 'PASS' : 'FAIL')
  console.log('场景B 全部失败:', okB ? 'PASS' : 'FAIL')
  console.log(ok ? 'AI E2E OK' : 'AI E2E FAIL')
  ws.close()
  child.kill()
  process.exit(ok ? 0 : 1)
}

main().catch((err) => {
  console.log('AI E2E FAIL:', err)
  process.exit(1)
})
