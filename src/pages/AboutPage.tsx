import { manifest } from '../lib/data';
import { linkProps } from '../lib/router';

export function AboutPage() {
  const t = manifest.totals;
  const generated = manifest.generatedAt
    ? new Date(manifest.generatedAt).toLocaleString('zh-CN', { hour12: false })
    : '—';

  return (
    <div className="reading">
      <div className="page-head">
        <h1 className="page-title">About</h1>
        <p className="page-lede">
          一个研究 AI、科技、金融与投资的人，每天用英语记录自己认知输入的个人知识博客。
        </p>
      </div>

      <div className="prose" style={{ marginTop: 36 }}>
        <h2>这不是背单词网站</h2>
        <p>
          它不提供打卡、测验、词根词缀课，也不追求「词汇量」。它记录的是真实的认知输入：
          每天在 AI 工程、半导体、金融与投资语境中实际遇到、且值得反复咀嚼的英文词。
        </p>
        <p>
          每个词都放在真实语境里解释——它在这个行业里指什么、为什么重要、容易和什么混淆。
          读一个词，顺带理解一个概念。
        </p>

        <h2>每天 5 个词</h2>
        <ul>
          <li>每天一期，通常 5 词：3 个 AI 方向 + 2 个金融投资方向</li>
          <li>每词包含：音标、词性、领域标签、中文释义、英文例句（真实语境）、中文说明、记忆重点</li>
          <li>词条之间做去重，避免重复推荐已经学过的词</li>
          <li>分类目前为 AI 与 Finance 两条主线，未来可扩展 Semiconductor、Business、Economics</li>
        </ul>

        <h2>内容从哪来</h2>
        <p>
          内容源是本地 Obsidian 知识库中的 <code>pinghe/english words</code> 目录，
          以 Markdown 为唯一事实来源。网站不修改原始文件，只读取并渲染。
        </p>
        <p>
          每天由自动化任务生成当天词卡 Markdown，写入该目录后执行一次同步，
          站点即出现最新一期。整个过程不需要数据库、后台或登录系统。
        </p>

        <h2>技术实现</h2>
        <ul>
          <li>Vite + React + TypeScript，纯静态构建，无服务端依赖</li>
          <li>同步脚本把 Markdown 解析为 JSON 数据，每期单独分包按需加载</li>
          <li>检索为纯前端实现，无需搜索引擎服务</li>
          <li>视觉体系：普鲁士蓝 · 象牙白 · 编辑排版，针对手机阅读单独适配</li>
        </ul>

        <dl className="meta-grid">
          <dt>累计期数</dt>
          <dd>{t.issues} 期</dd>
          <dt>累计词数</dt>
          <dd>
            {t.words} 词（AI {t.ai} · Finance {t.finance}
            {t.both ? ` · 双领域 ${t.both}` : ''}
            {t.other ? ` · 其他 ${t.other}` : ''}）
          </dd>
          <dt>覆盖天数</dt>
          <dd>{t.days} 天</dd>
          <dt>数据源</dt>
          <dd>
            <code>{manifest.source}</code>
          </dd>
          <dt>数据生成于</dt>
          <dd>{generated}</dd>
        </dl>
      </div>

      <div className="chip-row" style={{ marginTop: 34 }}>
        <a className="chip" {...linkProps('/')}>
          阅读最新一期
        </a>
        <a className="chip" {...linkProps('/archive')}>
          浏览全部归档
        </a>
      </div>
    </div>
  );
}
