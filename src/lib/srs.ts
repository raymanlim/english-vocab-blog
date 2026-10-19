/**
 * srs.ts —— 间隔重复（Spaced Repetition）复习调度
 *
 * 为什么做这个
 * ------------
 * 每天 5 个新词，三千多个日子之后回头看，最早那批基本忘光了。字典站真正的
 * 留存价值不在「读过」，而在「到点回来还能认出来」。间隔重复就是干这个的：
 * 记住的词越推越远，忘了的词拉回当天。
 *
 * 设计约束（与本站其他部分一致）
 * ------------------------------
 * 1. **零后端**：只写 localStorage，静态托管可用，不引入任何请求。
 * 2. **零依赖**：手写 SM-2 的简化版（box 阶梯 + 三档评分），不上 anki 依赖。
 * 3. **可解释**：所有状态一眼能看懂（box 是第几级、下次是哪天），
 *    不做黑箱调度——用户自己能看到「这个词 15 天后再来」。
 *
 * 数据形态
 * --------
 * key = 单词（小写去空格），value = { box, due, seen, lapses, first, last }。
 * `due` 是本地时区的 YYYY-MM-DD；到期日 <= 今天就该复习。
 */

const LS_KEY = 'dv.srs.v1';

/** 每级 box 的下次间隔（天）。box 0 = 今天/已忘，逐级翻倍以上。 */
export const INTERVALS = [0, 1, 2, 4, 7, 15, 30, 60, 120];

export const BOX_MAX = INTERVALS.length - 1;

export type Grade = 'again' | 'hard' | 'good';

export interface SrsEntry {
  /** 第几级（0..BOX_MAX），越大间隔越长 */
  box: number;
  /** 下次到期日 YYYY-MM-DD（本地时区） */
  due: string;
  /** 累计复习次数 */
  seen: number;
  /** 点「忘了」的次数 */
  lapses: number;
  /** 第一次进入复习本的日期（当天新词计数用） */
  first: string;
  /** 最近一次被安排的日期 */
  last: string;
}

export type SrsStore = Record<string, SrsEntry>;

/** 本地时区的今天（UTC+8）——不用 toISOString，那是 UTC，会把「早上 8 点前」算成昨天。 */
export function todayStr(d: Date = new Date()): string {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

export function dayDiff(fromIso: string, toIso: string): number {
  const [ay, am, ad] = fromIso.split('-').map(Number);
  const [by, bm, bd] = toIso.split('-').map(Number);
  const a = Date.UTC(ay, (am || 1) - 1, ad || 1);
  const b = Date.UTC(by, (bm || 1) - 1, bd || 1);
  return Math.round((b - a) / 86400000);
}

export function wordKey(word: string): string {
  return String(word || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/* ------------------------------------------------------------------ 存储 */

export function loadStore(): SrsStore {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object') return {};
    // 容错：坏行直接丢掉，别让一条脏数据毁掉整个复习本
    const out: SrsStore = {};
    for (const k of Object.keys(parsed)) {
      const e = parsed[k];
      if (e && typeof e.box === 'number' && typeof e.due === 'string') {
        out[k] = {
          box: Math.max(0, Math.min(BOX_MAX, Math.round(e.box))),
          due: e.due,
          seen: Number(e.seen) || 0,
          lapses: Number(e.lapses) || 0,
          first: e.first || e.due,
          last: e.last || e.due,
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function saveStore(store: SrsStore): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent('srs-change'));
  } catch {
    /* 隐私模式 / 超额：静默失败，不影响阅读 */
  }
}

/** 订阅复习本变化（跨组件同步：词卡点了「加入生词本」，首页角标要跟着变） */
export function onStoreChange(fn: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('srs-change', fn);
  return () => window.removeEventListener('srs-change', fn);
}

/* ------------------------------------------------------------- 调度算法 */

/** 把某个词纳入复习本（或重置为「今天重来」） */
export function scheduleNew(store: SrsStore, word: string, today: string): SrsEntry {
  const k = wordKey(word);
  const prev = store[k];
  const e: SrsEntry = prev
    ? { ...prev, box: 0, due: today, lapses: prev.lapses + 1, last: today }
    : { box: 0, due: today, seen: 0, lapses: 0, first: today, last: today };
  return e;
}

/** 三档评分 → 新的 schedule。
 *  - again（忘了）：掉回 box 0，今天再见
 *  - hard（模糊）：停在当前级，间隔取本级（不前进，也不清零）
 *  - good（记得）：升一级，按下级间隔排期 */
export function gradeEntry(e: SrsEntry, grade: Grade, today: string): SrsEntry {
  let box = e.box;
  let lapses = e.lapses;
  if (grade === 'again') {
    box = 0;
    lapses += 1;
  } else if (grade === 'good') {
    box = Math.min(BOX_MAX, box + 1);
  }
  const due = addDays(today, INTERVALS[box]);
  return {
    box,
    due,
    seen: e.seen + 1,
    lapses,
    first: e.first,
    last: today,
  };
}

/* ------------------------------------------------------------- 队列构建 */

/** 到期队列：due <= today，越早到期排越前，同到期按 box 从低到高（越不熟越先） */
export function dueWords(store: SrsStore, today: string, limit = 40): string[] {
  return Object.keys(store)
    .filter((k) => store[k].due <= today)
    .sort((a, b) => {
      const x = store[a], y = store[b];
      if (x.due !== y.due) return x.due < y.due ? -1 : 1;
      if (x.box !== y.box) return x.box - y.box;
      return a < b ? -1 : a > b ? 1 : 0;
    })
    .slice(0, limit);
}

/** 今天已经引入过几个新词（用来限制每日新词配额） */
export function newIntroducedToday(store: SrsStore, today: string): number {
  return Object.keys(store).filter((k) => store[k].first === today).length;
}

/** 稳定哈希：同一天、同一个词，猜出来的顺序永远一样（避免刷新页面就换一批词）。 */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** 从没见过的词里挑 n 个：按 (当天日期+词) 的哈希排序取前 n 个，稳定且分散。 */
export function pickNewWords(allWords: string[], store: SrsStore, n: number, today: string): string[] {
  const unseen = allWords.filter((w) => !store[wordKey(w)]);
  if (unseen.length <= n) return unseen;
  return unseen
    .map((w) => ({ w, h: hash32(`${today}|${wordKey(w)}`) }))
    .sort((a, b) => (a.h - b.h) || (a.w < b.w ? -1 : 1))
    .slice(0, n)
    .map((x) => x.w);
}

export interface Queue {
  due: string[];
  fresh: string[];
  /** 队列中的词 → 词条详情所属期次日期（用于按需加载） */
  dates: Record<string, string>;
  /** 队列里有多少是今天新加入的 */
  total: number;
}

/**
 * 组装今天要复习的队列。
 * `wordDates` 是「词 → 期次日期」的映射，取自 manifest（不需要加载全部期次）。
 */
export function buildQueue(
  allWords: string[],
  wordDates: Record<string, string>,
  store: SrsStore,
  opts: { today: string; newPerDay?: number; dueLimit?: number },
): Queue {
  const today = opts.today;
  const newPerDay = opts.newPerDay ?? 5;
  const remaining = Math.max(0, newPerDay - newIntroducedToday(store, today));
  const due = dueWords(store, today, opts.dueLimit ?? 40);
  const fresh = pickNewWords(allWords, store, remaining, today);
  const dates: Record<string, string> = {};
  for (const w of due.concat(fresh)) {
    const d = wordDates[wordKey(w)];
    if (d) dates[wordKey(w)] = d;
  }
  return { due, fresh, dates, total: due.length + fresh.length };
}

/** 复习本概况（角标用，不加载任何期次数据） */
export function srsSummary(store: SrsStore, allWords: string[], today: string): {
  due: number; fresh: number; total: number; totalWords: number; tracked: number;
} {
  const due = dueWords(store, today, 999).length;
  const remaining = Math.max(0, 5 - newIntroducedToday(store, today));
  const tracked = Object.keys(store).length;
  const fresh = Math.min(remaining, Math.max(0, allWords.length - tracked));
  return { due, fresh, total: due + fresh, totalWords: allWords.length, tracked };
}
