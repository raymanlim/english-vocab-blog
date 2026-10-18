# AGENTS.md — 给 AI Agent 的上手说明

> 面向 **AI 编码 Agent**（Claude Code / Codex / Cursor / 云端 Agent）。
> 人类向完整文档在 `README.md`；本文只讲**接手干活必须知道的事**。
> 冲突时以本文为准，本文未覆盖的细节查 `README.md`。

---

## 0. 一分钟理解

**Daily Vocabulary · AI × Finance English —— 个人英语单词知识博客。**

不是背单词网站。是一个研究 AI / 科技 / 金融的人，每天用英语记录认知输入，
按「一天一期、一期 5 词」组织。**内容源是本地 Obsidian 知识库，本站只读不写。**

本仓库 = `D:\03_Work_Projects\english-vocab-blog`：

```
scripts/
  sync.mjs            ← Markdown → JSON（只读源目录；含 vault 边界守卫）
  dev.mjs             ← 开发启动器：sync + 监听源目录 + vite
  audit.mjs           ← 多宽度布局审计（playwright-core 复用已缓存 chromium）
  verify-live.mjs     ← 线上发布校验（真实浏览器渲染线上页面）
src/
  data/               ← 🔴 派生数据，但**必须提交**（站点内容本体，见 §1）
    manifest.json     ← 期次元数据 + 全局统计
    index.json        ← 全部词的轻量索引（搜索用）
    issues/*.json     ← 每期完整数据（import.meta.glob 按需分包）
  lib/                ← types / data / search / router / inline（路由与检索自写，约 200 行）
  components/         ← Header / Footer / IssueHero / WordCard / WordRow / IssueView / SearchBox
  pages/              ← Home / Issue / Archive / Category / Search / About / NotFound
  styles/global.css   ← 全部样式（普鲁士蓝编辑风格）
index.html
```

| 目录 | 是什么 |
|---|---|
| `src/` | **应用本体** —— Vite 5 + React 18 + TS strict，唯一运行时依赖是 React |
| `src/data/` | **派生数据 = 站点内容** —— 由 `sync.mjs` 从 Obsidian 生成 |
| `scripts/` | 同步 / 开发 / 审计 / 线上校验 |

---

## 1. 🔴 硬约束（违反会静默出错）

1. **`src/data/` 是派生数据，但必须提交进仓库**。
   它由 `scripts/sync.mjs` 从 Obsidian 生成，真源不在仓库里；
   但它**同时是站点内容本体** —— 部署时必须有它。
   提交它 → 仓库自包含，CI / 托管**无需 vault 即可构建**。
   `.gitignore` 里**刻意没有**忽略它（只有一段注释说明原因）。
   ⚠️ **不要**把它加进 `.gitignore`：CI 会构建出**空站点**且不报错。

2. **🔴 源目录只读 —— 而且边界是「整个 vault」，不是「数据源目录」**。
   内容源 `D:\Obsidian\obsidian_valut\pinghe\english words\` 所在的
   `D:\Obsidian\obsidian_valut` **整体是一个 Git 仓库**
   （远端 `raymanlim/obsidian_vault`）。
   ⇒ 任何落进 vault 的文件都会被 commit、push，并与其他机器上的同名文件冲突。
   两条铁律：
   - `sync.mjs` **只读**源目录，绝不写入 vault 里的任何位置；
   - 派生数据（`src/data/`）必须位于 vault **之外**。

   第 2 条已在 `scripts/sync.mjs` 里**硬断言**（`assertOutsideVault`）：
   不满足直接 `exit 1`，避免「悄悄把派生数据写进知识库」这种最难排查的污染。
   覆盖方式：`VOCAB_VAULT_ROOT=<路径> npm run sync`（仅测试用）。

3. **绝不修改源 Markdown**。历史文件格式有差异时，在 `sync.mjs` 里做适配，
   **不要要求用户回改文件**。这是本项目的核心设计原则。

4. **`npm run build` ≠ `npm run build:ci`，别混用**。

   | 命令 | 内容 | 用在哪 |
   |---|---|---|
   | `npm run build` | `sync.mjs && vite build` | **本机**（需要 vault） |
   | `npm run build:ci` | 纯 `vite build` | **CI / 任何没有 vault 的环境** |

   CI 里跑 `build` 必然失败（runner 上没有 vault，`sync.mjs` 会 `exit 1`）。

5. **仓库内无任何密钥**。本项目不需要 `.env` —— 没有服务端、没有 API 调用、
   没有数据库。若未来引入，一律 gitignore，**绝不提交**。

6. **`dist/` 是构建产物，不入库**。发布时才需要它（见 §5）。

---

## 2. 常用命令

```bash
# 开发
npm run dev          # sync + 监听源目录 + vite → http://localhost:5173
npm run dev:plain    # 同上但不监听（sync 一次 + vite）

# 内容同步
npm run sync         # 只重新扫描 Markdown 并生成 src/data/

# 质量门禁（提交前必须全绿）
npm run verify       # = typecheck && build:ci
npm run typecheck    # tsc --noEmit
npm run build:ci     # 纯 vite build（无 vault 也可跑）

# 本机构建 / 预览 / 审计
npm run build        # sync + build（⚠️ 需要 vault）
npm run preview      # 预览 dist/ → http://localhost:4173
npm run audit        # 多宽度布局审计（8 宽度 × 9 路由）

# 线上校验（传 URL，可多个）
node scripts/verify-live.mjs https://daily-vocab.pages.dev
```

**环境变量**

| 变量 | 作用 | 默认 |
|---|---|---|
| `VOCAB_SOURCE` | 覆盖内容源目录（换机器 / 多源 / 干跑验证） | `D:\Obsidian\obsidian_valut\pinghe\english words` |
| `VOCAB_VAULT_ROOT` | 覆盖 vault 根（只读边界断言用） | `D:\Obsidian\obsidian_valut` |

---

## 3. 日常任务

### 3.1 每日一期（自动化主路径）

由 WorkBuddy 任务「每日 5 个英语单词」（`d633c307`，每日 **11:30**）驱动：

```
生成 MD 词卡 → 写入 D:\Obsidian\obsidian_valut\pinghe\english words\YYYY-MM-DD.md
             → 更新 _index.md（期号 = 最大期号 + 1）
             → KAMI PNG + Telegram 推送
             → npm run sync（生成 src/data）
             → git-sync.sh 推 src/data 到 GitHub
             → push 触发 GitHub Actions（deploy.yml）自动部署到 Cloudflare Pages
             → （可选）node scripts/verify-live.mjs https://daily-vocab.pages.dev
```

🔴 **发布由 CI 完成**（2026-10-18 起，从 WorkBuddy App Publishing 迁移到
Cloudflare Pages）：自动化只负责 `npm run sync` + 推送 `src/data`，
**不再调用 workbuddy_sites_deploy**。push 到 main → CI 构建 → 部署，全程约 2 分钟。

> ⚠️ 两个目录别混淆：
> `pinghe\english words\` = **MD 词卡（站点源）**；
> `pinghe\英语单词\` = **PNG/HTML 归档素材（微信推送用）**。

### 3.2 手动补一期 / 改完源文件后

```bash
npm run sync                 # 重新生成 src/data/
npm run verify               # 门禁全绿
git add src/data && git commit -m "content: sync 2026-10-08 — <主题>"
```

### 3.3 干跑验证（不碰真实数据）

想验证「新格式能否被解析器识别」时，把样例词卡放进临时目录：

```bash
VOCAB_SOURCE='<临时目录>' npm run sync
```

⚠️ 跑完**必须删临时目录并重跑 `npm run sync`** 恢复真实数据，
否则 `src/data/` 会残留测试数据。

---

## 4. 质量门禁（提交前必须全绿）

```bash
npm run verify        # typecheck && build:ci
```

CI 见 `.github/workflows/verify.yml`（`npm ci` + `npm run typecheck` + `npm run build:ci`）。

> CI **只构建 + 门禁，不部署** —— 部署走 §5 的发布链路。

---

## 5. 部署

**目标平台：Cloudflare Pages（2026-10-18 起从 WorkBuddy App Publishing 迁移）。**

| 项 | 值 |
|---|---|
| 🔴 **对外唯一固定链接** | `https://daily-vocab.pages.dev` |
| 项目名 | `daily-vocab`（`pages.dev` 子域名，DNS 占用检查后选定） |
| 生产分支 | `main` |
| 发布方式 | GitHub Actions `.github/workflows/deploy.yml`（push 触发） |
| 部署目录 | **`<项目>/dist`**（由 CI 构建，`npm run build:ci`） |

**部署链路**

```
push 到 main（或每日自动化推 src/data）
  → CI: npm ci + typecheck + build:ci + dist 门禁
  → CI: wrangler pages deploy dist --project-name=daily-vocab --branch=main
```

**Secrets（仓库 Settings → Secrets → Actions）**

`CLOUDFLARE_API_TOKEN`（Pages Edit 权限）+ `CLOUDFLARE_ACCOUNT_ID`。
未配时 CI 构建照跑、部署步骤跳过（作业保持绿色），补上后自动恢复部署。

> 迁移期旧链路（App Publishing，sandboxId `2b8e1fe3…`）**并行存在**，
> 验证新站稳定 N 天后再 `workbuddy_sites_unpublish` 下线。
> Page Publishing 旧教训（shareLink 每次变、上传是合并等）迁移后不再适用。

---

## 6. 已知坑（踩过的，别再踩）

| 坑 | 现象 | 处理 |
|---|---|---|
| **沙箱下 `npm install` 被 esbuild 阻断** | `spawnSync` 报 `EBUSY -4082`，安装中止、react 都没装上 | 用 `npm install --ignore-scripts`。esbuild 平台二进制走 `optionalDependencies`（`@esbuild/win32-x64`），跳过不影响构建 |
| **上一条失败后重装不干净** | npm 认为已满足，只补 4 个包 | 必须 `rm -rf node_modules package-lock.json` 再装 |
| **`npm run build` 被守卫拦** | `[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]` | 加 `CODEBUDDY_SAFE_DELETE_ENABLED=0` 重跑。**不是代码问题** |
| **CI 里跑 `npm run build`** | `❌ 源目录不存在`，exit 1 | CI 必须用 `npm run build:ci` |
| **把 `src/data/` 加进 `.gitignore`** | CI 构建出空站点、不报错 | 见 §1 第 1 条；`src/data/` 必须提交 |
| **领域判定只靠 `【AI】` 标记** | 漏掉约 20% 的词（实测 80 词漏 16 词） | 三层兜底：标记 → `_index.md` 累计清单 → 关键词启发式。**不要砍掉后两层** |
| **混淆两个源目录** | 改错地方、站点不更新 | `english words\` = MD 站点源；`英语单词\` = PNG/HTML 素材 |
| **站点与词卡同定 8:30** | 并发竞争，重发昨天内容且不报错 | 发布必须是同一任务的串行末步（实际 ~8:40 上线） |
| **把 `shareLink` 当对外链接** | 下期即死链 | 只用 sandboxId 域名 |
| **自动化跑在 bash 里** | 写 `cd /d D:\...`（CMD 语法）会失败 | prompt 里写「在项目目录下执行」并附 npm 完整路径兜底 |

---

## 7. 提交规范

```
feat:      新增功能
content:   内容同步（src/data 更新，自动化默认前缀）
fix:       修 bug
docs:      文档
chore:     构建 / 配置 / 杂项
```

- 提交前 `git status` 确认范围，**不要 `git add -A` 不看 diff 就提交**。
- **绝对不要提交**：`node_modules/`、`dist/`、`.vite/`、`.audit/`、`.audit-live/`、
  `.*_out.txt`、`.workbuddy-ai/`、`.workbuddy/`、`.wbapp_*.genie`。
- **务必提交**：`src/data/manifest.json`、`src/data/index.json`、`src/data/issues/*.json`。

---

## 8. 与其他仓库的关系

本站是「Rayman 的内容站点矩阵」之一：

| 仓库 | 内容 | 托管 |
|---|---|---|
| `raymanlim/classic-reading` | 经典书库（零依赖 Node SSG） | Cloudflare Pages |
| `raymanlim/classic-cinema-daily` | 世界经典电影日报（Next.js） | Vercel |
| `raymanlim/fyx-material-intel` | 方宇鑫半导体材料情报站（Python SSG） | Cloudflare Pages |
| `raymanlim/michaels-blog` | Michael 每日知识双语博客（Next.js） | Vercel |
| `raymanlim/x-articl` | 阅读中枢 | Cloudflare Pages（`rayman-reading-hub.pages.dev`） |
| **`raymanlim/english-vocab-blog`（本仓库）** | 英语单词知识博客（Vite + React） | Cloudflare Pages（`daily-vocab.pages.dev`） |

**内容源仓库（只读）**

| 仓库 | 被谁读 |
|---|---|
| `raymanlim/obsidian_vault` | 本仓库读 `pinghe/english words/`；`x-articl` 读 `x/`、`youtube/`、`pinghe/` |

> 🔴 **vault 是「活」的** —— 每日自动化会往里写新词卡。
> 所以读取方（本仓库、x-articl）都必须假定文件可能**正在被写入**。
> 本仓库的应对：`sync.mjs` 以「源目录不存在就退出、绝不写 vault」为底线；
> 若未来出现读到半写文件的迹象，参照 `x-articl` 的 `stable_read()` 做法
> （读前读后 `os.stat` 比对 `(size, mtime_ns)`）。

各仓库**互相独立**，不要跨仓库引用路径。
