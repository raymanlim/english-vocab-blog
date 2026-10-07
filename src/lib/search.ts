import type { Domain, SearchEntry } from './types';

/**
 * 纯前端检索：所有关键词都必须命中（AND），命中位置决定排序权重。
 * 数据量级（数千词）下性能充足。
 *
 * 索引由调用方传入（`loadSearchIndex()`）—— 它约 160 KB，按需加载，不进主 chunk。
 */
export function search(index: SearchEntry[], query: string, limit = 300): SearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const terms = q.split(/\s+/).filter(Boolean);
  const scored: { entry: SearchEntry; score: number }[] = [];

  for (const entry of index) {
    const word = entry.word.toLowerCase();
    const brief = entry.brief.toLowerCase();
    const example = entry.example.toLowerCase();
    const meta = `${entry.date} ${entry.issueLabel} ${entry.pos}`.toLowerCase();

    let score = 1;
    let ok = true;

    for (const t of terms) {
      if (!entry.searchText.includes(t)) {
        ok = false;
        break;
      }
      if (word === t) score += 120;
      else if (word.startsWith(t)) score += 70;
      else if (word.includes(t)) score += 45;
      if (brief.includes(t)) score += 14;
      if (entry.related.some((r) => r.toLowerCase().includes(t))) score += 9;
      if (example.includes(t)) score += 5;
      if (meta.includes(t)) score += 7;
    }

    if (ok) scored.push({ entry, score });
  }

  scored.sort(
    (a, b) => b.score - a.score || b.entry.date.localeCompare(a.entry.date)
  );

  return scored.slice(0, limit).map((s) => s.entry);
}

export function filterByDomain(index: SearchEntry[], domain: Domain): SearchEntry[] {
  return index.filter((e) =>
    domain === 'ai'
      ? e.domain === 'ai' || e.domain === 'both'
      : e.domain === 'finance' || e.domain === 'both'
  );
}

/** 按日期倒序分组 */
export function groupByDate(
  entries: SearchEntry[]
): { date: string; issueLabel: string; items: SearchEntry[] }[] {
  const map = new Map<string, SearchEntry[]>();
  for (const e of entries) {
    const list = map.get(e.date);
    if (list) list.push(e);
    else map.set(e.date, [e]);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({
      date,
      issueLabel: items[0].issueLabel,
      items: items.sort((a, b) => a.no - b.no),
    }));
}

export const SEARCH_SUGGESTIONS = [
  'LLM',
  'Agent',
  'RAG',
  'Risk',
  'Volatility',
  'Yield',
  'Semiconductor',
  'Investing',
  'Attention',
  'Liquidity',
];
