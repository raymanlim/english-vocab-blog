import { useEffect, useMemo, useState } from 'react';
import { WordRow } from '../components/WordRow';
import { formatDate, issueMeta, loadSearchIndex } from '../lib/data';
import { filterByDomain, groupByDate } from '../lib/search';
import { linkProps } from '../lib/router';
import type { SearchEntry } from '../lib/types';

const META = {
  ai: {
    title: 'AI',
    lede: '模型、推理、训练、智能体与 AI 工程语境下的高频词。',
    other: 'finance' as const,
    otherLabel: 'Finance',
  },
  finance: {
    title: 'Finance',
    lede: '投资、风险、估值、市场结构与资产定价语境下的高频词。',
    other: 'ai' as const,
    otherLabel: 'AI',
  },
};

export function CategoryPage({ domain }: { domain: 'ai' | 'finance' }) {
  const [index, setIndex] = useState<SearchEntry[] | null>(null);

  // 搜索索引按需加载（约 160 KB，与搜索页共用同一份缓存）
  useEffect(() => {
    let alive = true;
    loadSearchIndex().then((data) => {
      if (alive) setIndex(data);
    });
    return () => {
      alive = false;
    };
  }, []);

  const entries = useMemo(
    () => (index ? filterByDomain(index, domain) : []),
    [index, domain]
  );
  const groups = useMemo(() => groupByDate(entries), [entries]);
  const meta = META[domain];

  return (
    <div className="reading">
      <div className="cat-head">
        <h1 className="cat-title">{meta.title}</h1>
        <span className="cat-count">
          {entries.length} Words · {groups.length} Issues
        </span>
      </div>

      <p className="page-lede" style={{ paddingTop: 20 }}>
        {meta.lede}
      </p>

      <div className="chip-row" style={{ marginTop: 22 }}>
        <a className="chip" {...linkProps(`/${meta.other}`)}>
          切换到 {meta.otherLabel}
        </a>
        <a className="chip" {...linkProps('/archive')}>
          全部归档
        </a>
        <a className="chip" {...linkProps('/search')}>
          搜索
        </a>
      </div>

      {!index && (
        <div className="empty">
          正在加载词条…
          <div className="empty-hint">首次进入需要下载一次，之后浏览器会缓存</div>
        </div>
      )}

      {index && groups.length === 0 && (
        <div className="empty">
          该分类下暂无词条。
          <div className="empty-hint">运行 npm run sync 后重试。</div>
        </div>
      )}

      {groups.map((group) => {
        const m = issueMeta(group.date);
        return (
          <section className="cat-group" key={group.date}>
            <div className="cat-group-head">
              <a className="cat-group-date" {...linkProps(`/issue/${group.date}`)}>
                {formatDate(group.date)}
              </a>
              <span className="cat-group-issue">{group.issueLabel}</span>
              <span className="cat-group-theme">{m?.theme}</span>
            </div>
            <div className="result-list" style={{ marginTop: 0 }}>
              {group.items.map((entry) => (
                <WordRow key={entry.id} entry={entry} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
