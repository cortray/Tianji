# 天机 AI · 微信小程序（Taro）

天机 AI 的微信小程序版本，基于 **Taro 4 + React + TypeScript + Vite** 构建，复用桌面/Web 版的核心逻辑：

- **本地八字排盘**：四柱、十神、藏干、纳音、五行、大运、流年全部本地计算（lunar-javascript），支持农历（闰月）、真太阳时校正
- **高可用 AI 引擎**：OpenAI 兼容抽象，多 Provider / 多 Key 故障切换，`Taro.request` 分块接收 SSE 流式输出
- **内置技能**：八字命理技能（SKILL.md + references 静态打包，`scripts/gen-skills.mjs` 生成）
- **存储**：配置 / 会话 / 排盘历史 / 草稿全部走小程序 Storage

## 目录结构

```
miniprogram/
├── config/                  # Taro 编译配置（Vite 编译器）
├── scripts/
│   └── gen-skills.mjs       # 内置技能 md → skills.gen.ts 生成脚本
├── src/
│   ├── app.ts / app.config.ts / app.scss
│   ├── lib/                 # 复用/适配的核心逻辑
│   │   ├── bazi/            # 排盘引擎（纯 TS，与桌面版同源）
│   │   ├── ai-client.ts     # 流式 AI 客户端（enableChunked SSE）
│   │   ├── storage.ts       # 小程序 Storage 适配
│   │   ├── skills.ts        # 技能系统（静态数据版）
│   │   ├── markdown.tsx     # RichText 渲染
│   │   └── theme.ts         # 明暗主题
│   ├── skills/builtin/bazi/ # 内置技能 md 源文件
│   └── pages/
│       ├── overview/        # 概览
│       ├── bazi/            # 八字排盘（表单 + 结果 + AI 分析）
│       ├── chat/            # AI 对话
│       └── settings/        # 设置（Provider / Key / 高可用参数 / 主题）
└── project.config.json      # 微信开发者工具项目配置
```

## 开发

```bash
npm install
npm run dev:weapp     # 构建并监听（dist/）
npm run build:weapp   # 生产构建
npm run typecheck     # TypeScript 检查
node scripts/gen-skills.mjs   # 修改 skills/builtin 下 md 后重新生成
```

用**微信开发者工具**导入本目录，`project.config.json` 已指向 `dist/`。

## 注意事项

1. **AppID**：默认 `touristappid`（游客模式）。正式发布需在 `project.config.json` 填自己的 AppID。
2. **域名白名单**：小程序正式环境只允许请求已备案并加入白名单的 HTTPS 域名（如你的 AI 网关域名）。开发调试可在开发者工具勾选「不校验合法域名」。
3. **流式输出**：依赖 `wx.request` 的 `enableChunked` 分块回调（基础库 2.20.1+，`project.config.json` 中 `libVersion` 为 3.0.0）。
4. **API Key 安全**：Key 存储在小程序本地 Storage，仅本机可见，但不要将包含真实 Key 的代码/数据提交到仓库。
5. **导出**：Markdown 写入小程序用户目录并同时复制到剪贴板，便于粘贴分享。
6. **主题**：深色模式通过 `themeClass`（`.theme-dark`）切换，与桌面版配置互通（同一 `tianji:config` 结构）。

## 与桌面/Web 版的关系

- 纯 TS 逻辑（`lib/bazi/*`、`lib/types.ts`、`lib/security.ts`、`lib/date.ts`）与 `src/renderer/src/lib/` 同源，改动时注意同步。
- `lib/ai-client.ts`、`lib/storage.ts`、`lib/skills.ts`、`lib/export-file.ts`、`lib/markdown.tsx` 为小程序适配实现（无 Electron IPC、无 DOM）。
