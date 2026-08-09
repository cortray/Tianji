# 天机 AI · 高可用客户端（tianji）

一个基于 **Electron + Vite + React + TypeScript + shadcn/ui** 的高可用 AI 客户端：

- **本地八字排盘**：四柱、十神、藏干、纳音、五行、大运、流年全部本地精确计算（lunar-javascript），AI 只负责按经典典籍进行命理解读
- **高可用 AI 引擎**：OpenAI 兼容抽象层，多 Provider / 多 Key 故障切换，默认预置 DeepSeek（在「设置」页配置你的 Key）
- **内置技能**：内置「八字命理」技能（源自 bazi-skill），AI 对话按命理分析流程引导
- **双形态运行**：Electron 桌面客户端 + Web 浏览器双跑

---

## ✨ 核心功能

| 模块 | 说明 |
| --- | --- |
| 🔮 **八字排盘** | 输入出生信息（阳历/农历，含闰月）→ 本地精确排盘（立春分年、节气分月、早晚子时、大运顺逆）→ 可选真太阳时校正（经度差 + 均时差）→ 一键 AI 命理分析（流式输出，引用《穷通宝典》《滴天髓》等典籍）；排盘历史自动保存（最多 30 条，可载入/删除）；排盘报告与 AI 分析均可一键导出 Markdown（桌面保存对话框 / Web 浏览器下载） |
| 🛡️ **高可用 AI** | 多 Provider 按优先级尝试；同一 Provider 可配多个 Key 轮询；首 token 超时自动切换；失败过程实时可视化 |
| 💬 **AI 对话** | 内置「八字命理」技能驱动，流式输出，Markdown 安全渲染，可停止/清空；多会话管理（新建/切换/删除），会话历史自动持久化；一键导出对话为 Markdown |
| ⚙️ **设置** | Provider CRUD、API Key 管理（桌面版 safeStorage 加密存储）、连接测试、高可用参数、明暗主题 |
| ⚡ **性能** | 页面级 React.lazy 代码分割 + vendor 手动分包（react/radix/lucide/marked），首屏主包由 1.8MB 降至 ~270KB（gzip ~90KB） |
| 🖥️ **双形态** | Electron 桌面（Key 经主进程转发，不出本机）+ Web 浏览器（Key 存 localStorage，有风险提示） |

## 🛠 技术栈

| 层 | 选型 |
| --- | --- |
| 桌面壳 | Electron 43（`sandbox` + `contextIsolation` 安全模式） |
| 构建 | electron-vite 5 + Vite 7 |
| UI | React 19 + TypeScript 7（strict）+ shadcn/ui（Radix UI + lucide-react） |
| 样式 | Tailwind CSS v4 + tw-animate-css + next-themes |
| 排盘 | lunar-javascript 1.7（本地精确计算，无第三方依赖） |
| Markdown | marked（HTML 转义 + 链接协议过滤，防注入） |

## 🚀 快速开始

```bash
npm install        # 安装依赖
npm run dev        # 开发模式（Electron，HMR）
npm run dev:web    # 开发模式（浏览器，http://localhost:5173）
npm run build      # 桌面生产构建（out/）
npm run build:web  # Web 生产构建（out/web/）
npm run preview    # 预览桌面生产构建
npm run smoke      # 冒烟测试（加载生产构建，检查渲染与控制台）
```

> **注意（npm 11）**：若依赖安装后 electron 二进制未下载（allow-scripts 拦截 install 脚本），执行
> `node node_modules/electron/install.js` 手动补装，并可用 `npm approve-scripts esbuild` 批准 esbuild 脚本。

## ⚙️ 配置模型 Provider（管理界面）

1. 打开「设置」→「模型 Provider」→「新增 Provider」（默认模板为 DeepSeek）。
2. 填写 **Base URL**（OpenAI 兼容格式，如 `https://api.deepseek.com/v1`，不要带 `/chat/completions` 后缀）、**模型**（如 `deepseek-chat`）。
3. 在 **API Key** 文本框中填入 Key，**每行一个**——填多个 Key 可实现 Key 级轮询容灾。
4. 点击「测试连接」验证，保存即可。

只配置 DeepSeek 一个 Provider 也完全可用；想要更高可用性，可再添加 OpenAI、Moonshot、Ollama（本地）等任意 OpenAI 兼容服务，并调整优先级。

**高可用策略**（可在设置中调整）：

```
请求 → 按优先级尝试 Provider A
        ├─ A 的 Key1 → 失败 → A 的 Key2 → 失败
        └─ 切到 Provider B（Key 轮询）→ 失败 → 继续下一个
全部失败 → 提示错误
```

- **首 token 超时**：默认 30s，超过即判定该 Key/Provider 不可用
- **最大切换次数**：Provider 之间最多尝试切换的次数

**Key 安全**：
- 桌面版：Key 通过 Electron `safeStorage`（系统钥匙串）加密后落盘；AI 请求经主进程转发，Key 不出本机
- Web 版：Key 保存在浏览器 localStorage（明文），界面有风险提示，建议仅用于临时使用

## 🧩 内置技能

- 内置「八字命理」技能随应用打包（含《穷通宝典》《滴天髓》等 4 份参考典籍）
- 在「AI 对话」页选择技能后，按技能流程进行四柱八字分析与对话
- 技术说明：技能为带 frontmatter 的 Markdown 文件（格式兼容 agency-agents），作为 AI 对话的 system prompt 注入

## 📁 项目结构

```
├── scripts/smoke.cjs              # 冒烟测试
├── electron.vite.config.ts        # 桌面构建配置
├── vite.web.config.ts             # Web 构建配置
└── src/
    ├── main/
    │   ├── index.ts               # 主进程：窗口、配置/技能 IPC、文件对话框
    │   ├── store.ts               # 配置读写（safeStorage 加密 apiKeys）
    │   └── ai.ts                  # 高可用 AI：SSE 解析、多 Key 轮询、故障切换、取消、测试
    ├── preload/                   # contextBridge 暴露 window.api（类型见 index.d.ts）
    └── renderer/src/
        ├── App.tsx                # Sidebar + 页面路由
        ├── assets/index.css       # Tailwind v4 + shadcn 变量 + Markdown 排版
        ├── components/ui/         # shadcn/ui 组件（22 个）
        ├── lib/
        │   ├── types.ts           # 共享类型（Provider/会话/技能/排盘结果/AiEvent）
        │   ├── platform.ts        # Electron/Web 双形态判断
        │   ├── storage.ts         # 配置与技能存储抽象（IPC / localStorage）
        │   ├── ai-client.ts       # 渲染进程 AI 客户端（Electron IPC / Web fetch）
        │   ├── skills.ts          # 技能仓库（内置打包 + 用户导入 + frontmatter 解析）
        │   ├── markdown.tsx       # 安全 Markdown 渲染
        │   └── bazi/
        │       ├── engine.ts      # 排盘引擎（lunar-javascript 封装）
        │       ├── prompt.ts      # AI 分析提示词组装
        │       └── lunar.d.ts     # lunar-javascript 类型声明
        ├── skills/builtin/bazi/   # 内置八字技能（SKILL.md + references/）
        └── pages/                 # Overview / Bazi / Chat / Skills / Settings
```

## ⚠️ 已知限制

- Web 形态下 API Key 存于 localStorage，安全性低于桌面版（界面已提示）
- 部分 OpenAI 兼容服务可能不开放浏览器 CORS，Web 形态直连会失败，建议使用桌面版或本地 Ollama
- 排盘为本地计算，命理分析结果仅供参考，不构成任何专业建议

## 📄 License

MIT
