import { useEffect, useMemo, useState } from 'react';
import { SearchBox } from '../components/SearchBox';
import { WordRow } from '../components/WordRow';
import { loadSearchIndex, totalWords } from '../lib/data';
import { SEARCH_SUGGESTIONS, search } from '../lib/search';
import type { SearchEntry } from '../lib/types';

export function SearchPage({ initialQuery }: { initialQuery: string }) {
  const [q, setQ] = useState(initialQuery);
  const [index, setIndex] = useState<SearchEntry[] | null>(null);

  // 搜索索引按需加载（约 160 KB，Vite 单独分包，不进主 chunk）
  useEffect(() => {
    let alive = true;
    loadSearchIndex().then((data) => {
      if (alive) setIndex(data);
    });
    return () => {
      alive = false;
    };
  }, []);

  // 输入时同步到地址栏（replaceState 不触发 hashchange，不会打断输入）
  useEffect(() => {
    const target = q
      ? `#/search?q=${encodeURIComponent(q)}`
      : '#/search';
    window.history.replaceState(null, '', target);
  }, [q]);

  const results = useMemo(() => (index ? search(index, q) : []), [index, q]);

  return (
    <div className="reading">
      <div className="page-head" style={{ borderBottom: 'none', paddingBottom: 22 }}>
        <h1 className="page-title">Search</h1>
        <p className="page-lede">
          检索全部 {totalWords} 个词条 —— 支持英文单词、中文释义、音标、领域与例句。
        </p>
      </div>

      <SearchBox value={q} onChange={setQ} autoFocus />

      {!index && (
        <div className="empty">
          正在加载检索索引…
          <div className="empty-hint">首次进入需要下载一次，之后浏览器会缓存</div>
        </div>
      )}

      {index && !q && (
        <>
          <div className="chip-row">
            {SEARCH_SUGGESTIONS.map((s) => (
              <button key={s} className="chip" onClick={() => setQ(s)}>
                {s}
              </button>
            ))}
          </div>
          <div className="empty">
            输入关键词开始检索
            <div className="empty-hint">
              例如「风险」「cache」「volatility」或「第 12 期」
            </div>
          </div>
        </>
      )}

      {index && q && (
        <>
          <div className="search-meta">
            <span className="search-count">
              {results.length} RESULT{results.length === 1 ? '' : 'S'}
            </span>
            {results.length === 0 && <span className="search-count">未匹配到词条</span>}
          </div>

          {results.length > 0 && (
            <div className="result-list">
              {results.map((entry) => (
                <WordRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}

          {results.length === 0 && (
            <div className="empty">
              没有找到匹配「{q}」的词条
              <div className="empty-hint">试试更短的关键词，或只输入单词的前几个字母</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
