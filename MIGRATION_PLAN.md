# 迁移评估：每日英语单词站 · WorkBuddy App Publishing → Cloudflare Pages

> 2026-10-18 18:50 评估。本文只做评估与方案，不动任何代码与线上环境。

---

## 1. 现状画像

### 站点本体

| 项 | 值 |
|:---|:---|
| 项目目录 | `D:\03_Work_Projects\english-vocab-blog` |
| 技术栈 | Vite 5 + React 18 + TypeScript strict，**纯静态**，唯一运行时依赖 React |
| 路由策略 | `base: './'` 相对路径 + **hash 路由** |
| 构建 | `npm run build` = `sync.mjs` + `vite build`；CI 侧可用 `build:ci`（仅 vite build） |
| 构建产物 | `dist/` **980 KB** |
| 内容数据 | `src/data/` 824 KB，38 期词卡 JSON（2026-09-11 起，日产 1 期），**已提交进仓库** |
| 仓库 | `github.com/raymanlim/english-vocab-blog`（main 干净，本地 = 远端 `f165678`） |
| 现有 CI | `.github/workflows/verify.yml`（仅 typecheck + build 校验，**不部署**） |

### 内容 & 发布链路（当前）

```
vault: pinghe/english words/*.md   ← 内容真源（Obsidian，AI 写词卡）
        ↓ 只读
sync.mjs → src/data/*.json         ← 派生数据，提交入库（站点内容本体）
        ↓
npm run build → dist/              ← 本机构建
        ↓
workbuddy_sites_deploy             ← 🔴 当前发布方式（App Publishing）
        ↓
https://<sandboxId>.sg2.agentos-app.run   ← 对外固定链接（200，在线）

另一侧：git-sync.sh 把 src/data 推到 GitHub（每日一次）
```

**关键发现：`src/data` 已经每天推 GitHub。** 这意味着 CI 只需 `vite build` 就能出整站——**不用在 CI 里拉 vault**（reading-hub 的 CI 复杂就在于它必须在 CI 内同步 vault；单词站的 sync 发生在发布前，产物已落仓库）。

### 每日自动化（d633c307 · 11:30 · 当前账号 · ACTIVE）

每日流程：写 MD 词卡 → One-Pager HTML → Playwright 截图 PNG → `npm sync && build` → **workbuddy_sites_deploy（写死参数）** → `verify-live.mjs <sg2 域名>` → git-sync 推 src/data。

| App Publishing 现状 | |
|:---|:---|
| appId | `wbapp_aFoHwTIOaDZtjU1SJis98M` |
| 对外固定链接 | `https://2b8e1fe3d97e4d389b683715b938d2cd.sg2.agentos-app.run` |
| 探测（18:52） | **HTTP 200**，标题「每天英语单词 · AI × Finance English」|
| Telegram 推送 | 参与（失败告警也走它） |

---

## 2. 已知 App Publishing 的坑（本机实证，全部适用）

| 坑 | 证据来源 | 迁移后是否消失 |
|:---|:---|:---|
| **上传是合并不是替换**，线上文件删不掉 | 用户级 MEMORY 记录 | ✅ Cloudflare 每次全量覆盖 |
| **unpublish 会换 sandboxId**，旧链接即作废 | 同上 | ⚠️ 迁移收尾 unpublish 时旧域名失效，需提前通知 |
| **shareLink 每次发布都变**，不可对外分享 | 同上 | ✅ `.pages.dev` 永久固定 |
| 手动重发必须显式传 `installCmd`+`startCmd`，否则假成功 | 同上 | ✅ CI 不依赖沙箱语义 |
| 依赖平台账号在线（账号 403 → 发布卡死） | 旧账号 6 条僵尸任务 | ✅ 由 GitHub+Cloudflare 托管，与账号解耦 |

---

## 3. 迁移方案对比

| 维度 | Cloudflare Pages | Vercel | Netlify |
|:---|:---|:---|:---|
| 已有先例 | ✅ fyx 情报站 + 阅读中枢（同套 deploy.yml 模板） | ✅ 经典电影日报 | ✅ Michael 双语博客 |
| 带宽/请求 | **无限**（免费） | Hobby 100 GB/月（980 KB 站点用不完） | 100 GB/月 |
| 项目名冲突风险 | ⚠️ 全局占用（`reading-hub` 踩过，必须先查） | 独立命名空间 | 独立命名空间 |
| SPA fallback | 本站 hash 路由 → **不需要** | 需 | 需 |
| **CI 复用程度** | 🔴 **可直接复用阅读中枢 deploy.yml**（改构建命令即可） | 需新写 | 需新写 |
| 发布复杂度 | `wrangler pages deploy dist` | `vercel deploy --prod` | `netlify deploy --prod` |

**推荐：Cloudflare Pages。** 理由就一条最硬：阅读中枢今早刚把这套模式完整跑通（cron 兜底 + push 触发 + wrangler 部署 + Secrets 缺失自检模板），迁移成本是三家最低，且发布随仓库 push 走，与每日自动化 `git-sync.sh` 天然对齐。

---

## 4. 推荐架构（迁移后）

```
vault: pinghe/english words/*.md
        ↓ 只读
sync.mjs → src/data/*.json          ← git-sync.sh 推 GitHub（沿用现状）
        ↓
GitHub: raymanlim/english-vocab-blog  push
        ↓
deploy.yml: npm ci + vite build → dist → wrangler pages deploy
        ↓
https://<project>.pages.dev          ← 对外新固定域名
```

### 触发器设计

| 触发 | 作用 | 说明 |
|:---|:---|:---|
| `push: [main]` | **主链路** | 自动化每天推 src/data → 秒级触发部署 |
| `schedule` | 兜底 | 每日 12:30（自动化 11:30 跑完后兜，防漏发） |
| `workflow_dispatch` | 手动 | Actions → Run workflow |

> 与阅读中枢不同：**不需要 `repository_dispatch`**。阅读中枢的内容更新在 vault 内，需事件通知；单词站的内容是先落仓库再部署，push 本身就是事件。

### 与每日自动化的改造接口

自动化 prompt 的「步骤 4：发布站点」需要整段替换：

| 现在 | 迁移后 |
|:---|:---|
| `npm sync && build` → **workbuddy_sites_deploy（参数照抄段）** → verify-live(sg2) → git-sync | `npm sync && build` → 本地构建校验 → **git-sync 推送** → CI 自动部署 → verify-live(**新 .pages.dev 域名**) |

**要点**：
- 自动化只删「调用 workbuddy_sites_deploy」那一块，前置自检（MD 写入 / 5 词条 / 期号一致）**保留**
- `verify-live.mjs` 的域名参数换成 `.pages.dev`
- 自检 BLCK 从「发布失败即 Telegram 告警」改为「推送失败即告警」

---

## 5. 迁移步骤（概要，每步可独立回滚）

1. **Cloudflare 建项目**：名称待定（候选 `daily-vocab-english` / `rayman-vocab`；⚠️ 先 `wrangler pages project list` 查占用，避免 `reading-hub` 式冲突），Production branch = `main`
2. **写 `.github/workflows/deploy.yml`**：模板复用阅读中枢（Preflight 自检 Secrets → npm ci → `npm run build:ci` → wrangler deploy → 冒烟校验）
3. **配 2 个 Secret**：`CLOUDFLARE_API_TOKEN`（Pages 权限）、`CLOUDFLARE_ACCOUNT_ID`
4. **推 yml 首次部署** → verify-live 对新域名跑通（期号 / 词卡数 / 归档 / 搜索 / 手机溢出）
5. **改自动化 d633c307 prompt**：发布段替换如上；更新 AGENTS.md / README.md 里的域名与发布说明
6. **双链路并行观察 N 天** → 确认新站每日稳定自动更新
7. **收尾**：`workbuddy_sites_unpublish` 下线旧站（⚠️ 旧 sg2 域名随即 400，需提前对外告知新域名）

---

## 6. 风险与注意

| 风险 | 影响 | 缓解 |
|:---|:---|:---|
| 旧域名是「对外固定链接」，下线后收藏夹失效 | 中 | 收尾前确认无对外引用；新域名一次性通知 |
| 自动化 prompt 改动量大（发布段写得很细） | 中 | 整段替换，保留前置探测与自检；
| GitHub 通道今天又 502（ls-remote 刚失败） | 低 | Contents API 兜底推送（今日已验证多次） |
| Cloudflare 项目名占用 | 低 | 建项目前先查 |
| 并行期两站同时更新 | 低 | 新站始终取最新；旧站更新无意义但无害 |

**结论：可迁移，且是五个站点中条件最成熟的一个**——纯静态、内容已入 git、构建一行命令、无 vault 同步依赖。预计部署侧工作量小于阅读中枢（无稀疏检出 / 无只读边界 / 无缓存语义问题），主要工作在自动化 prompt 改造上。
