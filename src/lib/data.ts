import manifestJson from '../data/manifest.json';
import type { Issue, IssueMeta, Manifest, SearchEntry } from './types';

export const manifest = manifestJson as unknown as Manifest;

/**
 * 搜索索引（约 160 KB）改为**按需加载**。
 *
 * 它只在搜索页与分类页用到；静态 import 会让它进主 chunk、拖慢首屏。
 * 词条总数改从 `manifest.totals.words` 取（见 `totalWords`），无需加载索引。
 * Vite 会把动态 import 的 JSON 单独分包，首次进入搜索 / 分类页时才下载。
 */
let searchIndexCache: SearchEntry[] | null = null;

export async function loadSearchIndex(): Promise<SearchEntry[]> {
  if (searchIndexCache) return searchIndexCache;
  const mod = await import('../data/index.json');
  searchIndexCache = mod.default as unknown as SearchEntry[];
  return searchIndexCache;
}

/** 词条总数 —— 取自 manifest，无需加载搜索索引 */
export const totalWords: number = manifest.totals.words;

/** 全部期次，最新在前 */
export const issuesNewestFirst: IssueMeta[] = manifest.issues;

/** 全部期次，最早在前 */
export const issuesOldestFirst: IssueMeta[] = [...manifest.issues].reverse();

export const latestIssue: IssueMeta | undefined = issuesNewestFirst[0];

const issueModules = import.meta.glob<{ default: Issue }>('../data/issues/*.json');

const cache = new Map<string, Issue>();

/** 按需加载某一期的完整数据（Vite 会为每期单独分包） */
export async function loadIssue(date: string): Promise<Issue | null> {
  const cached = cache.get(date);
  if (cached) return cached;

  const key = `../data/issues/${date}.json`;
  const loader = issueModules[key];
  if (!loader) return null;

  const mod = await loader();
  const issue = mod.default;
  cache.set(date, issue);
  return issue;
}

/** 同步取用已加载过的期次 */
export function getLoadedIssue(date: string): Issue | null {
  return cache.get(date) ?? null;
}

export function issueMeta(date: string): IssueMeta | undefined {
  return issuesNewestFirst.find((i) => i.date === date);
}

/** 上一期 / 下一期（按时间顺序） */
export function adjacent(date: string): { prev?: IssueMeta; next?: IssueMeta } {
  const idx = issuesNewestFirst.findIndex((i) => i.date === date);
  if (idx === -1) return {};
  return {
    prev: issuesNewestFirst[idx + 1], // 更早一期
    next: issuesNewestFirst[idx - 1], // 更晚一期
  };
}

export function formatDate(date: string): string {
  return date.replace(/-/g, '.');
}

export function domainCountsText(counts: Record<string, number>): string {
  const parts: string[] = [];
  if (counts.ai) parts.push(`${counts.ai} AI`);
  if (counts.finance) parts.push(`${counts.finance} FINANCE`);
  if (counts.both) parts.push(`${counts.both} BOTH`);
  if (counts.other) parts.push(`${counts.other} GENERAL`);
  return parts.join(' · ');
}

/** 紧凑版，用于归档表格等窄列 */
export function compactDomainText(counts: Record<string, number>): string {
  const parts: string[] = [];
  if (counts.ai) parts.push(`${counts.ai} AI`);
  if (counts.finance) parts.push(`${counts.finance} FIN`);
  if (counts.both) parts.push(`${counts.both} BOTH`);
  if (counts.other) parts.push(`${counts.other} GEN`);
  return parts.join(' · ');
}

export const DOMAIN_SHORT: Record<string, string> = {
  ai: 'AI',
  finance: 'Finance',
  both: 'AI · Fin',
  other: 'General',
};
