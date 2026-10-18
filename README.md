# Daily Vocabulary · AI × Finance English

一个研究 AI、科技、金融与投资的人，每天用英语记录自己认知输入的个人知识博客。

不是背单词网站。内容源是本地 Obsidian 知识库的 `pinghe/english words` 目录，
以 Markdown 为唯一事实来源，**不修改原始文件**，只读取并渲染。

---

## 快速开始

```bash
npm install          # 首次安装依赖
npm run dev          # 同步内容 + 监听源目录 + 启动开发服务器
```

打开 http://localhost:5173

```bash
npm run sync         # 只重新扫描 Markdown 并生成站点数据
npm run build        # 构建静态站点到 dist/
npm run preview      # 本地预览构建产物（http://localhost:4173）
npm run audit        # 多宽度布局审计（8 种宽度 × 9 条路由，检查横向溢出）
npm run typecheck    # TypeScript 类型检查
```

---

## 日常使用流程

```
每日自动化生成 Markdown
        ↓
写入 D:\Obsidian\obsidian_valut\pinghe\english words\
        ↓
npm run sync            （dev 模式下会自动触发，无需手动执行）
        ↓
博客出现最新一期
```

也可以把 `npm run sync` 接到现有的每日自动化任务末尾，生成词卡后自动同步。

---

## 内容源

默认目录：

```
D:\Obsidian\obsidian_valut\pinghe\english words\
```

可用环境变量覆盖（适合换机器或做多源）：

```bash
VOCAB_SOURCE="E:\other\path\english words" npm run sync
```

### 被识别的文件

| 文件 | 处理方式 |
| --- | --- |
| `YYYY-MM-DD.md` | 解析为一天一期 |
| `_index.md` | 读取「累计已学」清单，作为领域判定的权威兜底 |
| `40词总复习.md`、`*.html` 等 | 忽略 |

### 解析的字段

从每个 `### N. 单词` 词块中提取：

- `音标` `词性` `词义` `例句` `记忆提示`
- 词性中的 `（相关：a、b、c）` 自动拆成 Related 标签
- 例句自动分离英文原句与中文译文（下一行以 `（` 开头者）
- 词义中的 `【AI】` / `【金融】` 标记用于领域判定
- `## 本期速览` 表格 → 速览区
- `## 关联与对照` 表格 → 对照区
- `## 进度` 列表 → 进度区

### 领域判定（三层，逐级兜底）

1. 词义行中的 `【AI】` / `【金融】` 标记（含 `【AI/数学】` 等变体）
2. `_index.md` 的累计已学清单
3. 关键词启发式（AI / 金融领域术语表）

三者都判不出时归入 `General`，并在 sync 输出中列出，便于人工确认。

### 格式容错

- 半角冒号 `:` 与全角冒号 `：` 均可
- 一个文件含多期（如 `2026-09-11.md` 含第 1、2 期）会自动识别为「第 1–2 期」
- 词义不以 `【X】` 开头（如 `股息；红利；引申：回报、好处`）也能正确分类
- 期号按日期自动累加，并与文件内声明的期号交叉校验，不一致时输出提示

---

## 项目结构

```
english-vocab-blog/
├── scripts/
│   ├── sync.mjs          # Markdown → JSON 数据（只读源目录）
│   ├── dev.mjs           # 开发启动器：sync + 监听 + vite
│   └── audit.mjs         # 多宽度布局审计
├── src/
│   ├── data/             # 由 sync 生成 —— 🔴 派生数据，但必须提交（见下节「只读边界」）
│   │   ├── manifest.json # 期次元数据 + 全局统计
│   │   ├── index.json    # 全部词的轻量索引（搜索用）
│   │   └── issues/*.json # 每期完整数据（按需分包加载）
│   ├── lib/
│   │   ├── types.ts      # 数据结构定义
│   │   ├── data.ts       # 数据加载与检索入口
│   │   ├── search.ts     # 纯前端检索与分组
│   │   ├── router.ts     # 极简 hash 路由（零依赖）
│   │   └── inline.tsx    # 行内 Markdown 渲染（粗体/斜体/代码）
│   ├── components/
│   │   ├── Header.tsx        # 导航，手机端折叠
│   │   ├── Footer.tsx
│   │   ├── IssueHero.tsx     # 期号 / 日期 / 主题 / 统计
│   │   ├── WordCard.tsx      # 单词卡片
│   │   ├── WordRow.tsx       # 列表行（搜索 / 分类共用）
│   │   ├── IssueView.tsx     # 一期完整视图
│   │   └── SearchBox.tsx
│   ├── pages/
│   │   ├── HomePage.tsx      # 首页 = 最新一期
│   │   ├── IssuePage.tsx     # 指定日期
│   │   ├── ArchivePage.tsx   # 归档
│   │   ├── CategoryPage.tsx  # AI / Finance 分类
│   │   ├── SearchPage.tsx    # 搜索
│   │   ├── AboutPage.tsx
│   │   └── NotFoundPage.tsx
│   ├── styles/global.css     # 全部样式（普鲁士蓝编辑风格）
│   ├── App.tsx
│   └── main.tsx
└── index.html
```

---

## 路由

采用 hash 路由，静态托管无需服务端 fallback 配置。

| 路径 | 页面 |
| --- | --- |
| `#/` | 首页（最新一期） |
| `#/issue/2026-09-25` | 指定日期的一期 |
| `#/archive` | 历史归档 |
| `#/ai` `#/finance` | 分类 |
| `#/search?q=risk` | 搜索 |
| `#/about` | 关于 |

---

## 视觉体系

| 角色 | 值 |
| --- | --- |
| 主色（普鲁士蓝） | `#003153` |
| 背景（象牙白） | `#faf8f3` |
| 卡片 | `#fffefb` |
| 下沉区（Memory 块） | `#f4f0e8` |
| 正文墨色 | `#17242f` |
| 分割线 | `#e1dbd0` |
| AI 标签 | `#1d4a66` on `#e5edf3` |
| Finance 标签 | `#7a6340` on `#f2ece0` |

- 无渐变、无大圆角（统一 2px）、无阴影堆叠
- 标签统一等宽字体 + 大写 + 字距
- 英文单词为视觉焦点，英文例句使用衬线体保证长文阅读
- 内容区最大宽度 900px，Header/Footer 内层 1080px

### 响应式断点

| 区间 | 行为 |
| --- | --- |
| ≥ 1200px | 宽屏布局 |
| 768–1199px | 收窄留白，归档表收窄列宽 |
| < 768px | 单列；导航折叠为 ☰；归档改为紧凑列表；速览表改为卡片式；词卡缩小内边距但保留单词视觉层级 |

已实测 1920×1080 / 1440×900 / 1280×800 / 1024×768 / 768×1024 / 430×932 / 390×844 / 360×800
共 8 种宽度 × 9 条路由 = 72 个组合，**横向溢出均为 0**。

---

## 技术原则

- Vite + React + TypeScript，纯静态构建，无服务端、无数据库、无登录
- 唯一运行时依赖是 React；路由、检索、Markdown 行内渲染均为自写（约 200 行）
- 每期数据单独分包，首页只加载最新一期
- 构建产物：主包 gzip 约 78 KB + 每期约 3–5 KB

### 已知环境注意

在受限沙箱环境中 `npm install` 可能因 esbuild 的 postinstall 验证脚本失败，
可改用：

```bash
npm install --ignore-scripts
```

esbuild 的平台二进制通过 `optionalDependencies`（`@esbuild/win32-x64`）分发，
不依赖该脚本，跳过不影响构建。

---

## 只读边界：vault 是一个 Git 仓库

内容源 `D:\Obsidian\obsidian_valut\pinghe\english words\` 所在的
`D:\Obsidian\obsidian_valut` **整体是一个 Git 仓库**（远端 `raymanlim/obsidian_vault`），
会同步到 GitHub。因此「只读」的边界不是「数据源目录」，而是**整个 vault**：

| 铁律 | 落实方式 |
| --- | --- |
| 只读源目录，绝不写入 vault 里的任何位置 | `sync.mjs` 只调 `readdirSync` / `readFileSync` |
| 派生数据必须落在 vault **之外** | `sync.mjs` 启动即断言 `assertOutsideVault(DATA_DIR)`，不满足直接 `exit 1` |

派生数据 `src/data/` 位于项目目录内（`D:\03_Work_Projects\english-vocab-blog\src\data`），
天然在 vault 之外。断言是**防御性**的 —— 防止将来有人改路径时悄悄把数据写进知识库。

可用环境变量覆盖（换机器或测试）：

```bash
VOCAB_SOURCE="E:\other\path\english words" npm run sync
VOCAB_VAULT_ROOT="E:\other\vault"          npm run sync   # 只影响边界断言
```

---

## 仓库与 CI

| 项 | 值 |
| --- | --- |
| 仓库 | `raymanlim/english-vocab-blog`（Private） |
| 对外站点 | `https://daily-vocab.pages.dev`（Cloudflare Pages，2026-10-18 起） |

### `src/data/` 为什么提交

它是派生数据（真源是 Obsidian），但**同时是站点内容本体**。
提交它，仓库才自包含 —— CI 与任何克隆点**无需 vault 即可构建**。
代价是每天随内容增长约 3–5 KB。

### 两条构建命令别混用

| 命令 | 内容 | 用在哪 |
| --- | --- | --- |
| `npm run build` | `sync.mjs && vite build` | **本机**（需要 vault） |
| `npm run build:ci` | 纯 `vite build` | **CI / 无 vault 的环境** |

CI（`.github/workflows/verify.yml`）跑 `npm ci` + `npm run typecheck` + `npm run build:ci`，
**只构建 + 门禁，不部署**。
部署由 `.github/workflows/deploy.yml`（push 触发）构建并发布到 Cloudflare Pages
（`daily-vocab.pages.dev`）；每日自动化推 `src/data` 即自动触发。

本地提交前跑：

```bash
npm run verify        # typecheck && build:ci
```

---

## 上手须知

接手本仓库前请先读 **`AGENTS.md`** —— 里面是硬约束、已知坑与部署细节，
比本文更贴近「实际干活」。冲突时以 `AGENTS.md` 为准。
