import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Word } from '../lib/types';
import { allWords, latestIssue, loadIssue, wordDates } from '../lib/data';
import { formatDate } from '../lib/data';
import { linkProps } from '../lib/router';
import { Inline } from '../lib/inline';
import { isSpeechSupported, pickEnVoice, speak, useVoices } from '../lib/speak';
import {
  buildQueue,
  gradeEntry,
  loadStore,
  onStoreChange,
  saveStore,
  todayStr,
  wordKey,
  INTERVALS,
  type Grade,
  type Queue,
  type SrsStore,
} from '../lib/srs';

/**
 * 复习页 —— 间隔重复（Spaced Repetition）
 *
 * 流程：到期词 → 翻卡 → 三档评分 → 结算。
 * 数据全部来自 manifest 索引 + 按需加载的那几期 JSON，不额外发请求。
 */

interface CardItem {
  key: string;
  word: Word;
  isNew: boolean;
}

const GRADE_BTNS: { grade: Grade; label: string; hint: string; key: string }[] = [
  { grade: 'again', label: '忘了', hint: '重新开始 · again', key: '1' },
  { grade: 'hard', label: '模糊', hint: '停留本级 · hard', key: '2' },
  { grade: 'good', label: '记牢了', hint: '升一级 · good', key: '3' },
];

function SpeakBtn({ text }: { text: string }) {
  const voices = useVoices();
  const voice = pickEnVoice(voices);
  if (!isSpeechSupported()) return null;
  return (
    <button
      type="button"
      className="wc-speak"
      aria-label="朗读"
      onClick={() => speak(text, voice)}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path
          d="M2 5.6h2.4L7.2 3.2v9.6L4.4 10.4H2V5.6Zm8.2.9a2.2 2.2 0 0 1 0 3.6m1.6-5.2a3.9 3.9 0 0 1 0 6.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export function ReviewPage() {
  const today = useMemo(() => todayStr(), []);
  // storeRef 是复习进行中的「权威快照」：评分只改 ref，不触发队列重建
  // （否则每评一张卡都会让 rebuild 把进度 idx 归零，永远到不了结算页）
  const storeRef = useRef<SrsStore>(loadStore());
  const [store, setStore] = useState<SrsStore>(storeRef.current);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [items, setItems] = useState<CardItem[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [tally, setTally] = useState<Record<Grade, number>>({ again: 0, hard: 0, good: 0 });
  const [error, setError] = useState<string | null>(null);

  // 词卡组件（首页/期页）里改复习本时，只同步快照与角标，不打断当前复习队列
  useEffect(() => onStoreChange(() => {
    storeRef.current = loadStore();
    setStore(storeRef.current);
  }), []);

  const rebuild = useCallback(() => {
    const q = buildQueue(allWords, wordDates, storeRef.current, { today });
    setQueue(q);
    setItems(null);
    setIdx(0);
    setRevealed(false);
    setTally({ again: 0, hard: 0, good: 0 });
    setError(null);

    // 队列为空（无到期 + 新词配额用完）→ 直接给空数组，让「无到期」引导态渲染，
    // 否则 items 停在 null 会一直卡在加载 spinner
    if (!q.total) {
      setItems([]);
      return;
    }
    const dates = Array.from(new Set(Object.values(q.dates)));
    // 只加载队列用到的那几期（通常不超过 8 期）
    Promise.all(dates.map((d) => loadIssue(d)))
      .then((issues) => {
        const byWord = new Map<string, Word>();
        for (const issue of issues) {
          if (!issue) continue;
          for (const w of issue.words) byWord.set(wordKey(w.word), w);
        }
        const list: CardItem[] = [];
        for (const w of q.due.concat(q.fresh)) {
          const hit = byWord.get(wordKey(w));
          if (hit) list.push({ key: wordKey(w), word: hit, isNew: q.fresh.includes(w) });
        }
        setItems(list);
      })
      .catch((e) => setError(String((e && e.message) || e)));
  }, [today]);

  useEffect(() => { rebuild(); }, [rebuild]);

  function grade(g: Grade) {
    if (!items || !queue) return;
    const cur = items[idx];
    if (!cur) return;
    const prev = storeRef.current[cur.key];
    const base = prev || {
      box: 0, due: today, seen: 0, lapses: 0, first: today, last: today,
    };
    const next = gradeEntry(base, g, today);
    const nextStore: SrsStore = { ...storeRef.current, [cur.key]: next };
    storeRef.current = nextStore;
    setStore(nextStore);
    saveStore(nextStore);
    setTally((t) => ({ ...t, [g]: t[g] + 1 }));
    setRevealed(false);
    setIdx((i) => i + 1);
  }

  const startFresh = useCallback(() => {
    const q = buildQueue(allWords, wordDates, storeRef.current, { today, newPerDay: 5, dueLimit: 40 });
    if (!q.fresh.length) {
      setError('词库已全部进入复习本，等它们到期即可。');
      return;
    }
    const nextStore: SrsStore = { ...storeRef.current };
    for (const w of q.fresh) {
      const k = wordKey(w);
      if (nextStore[k]) continue;
      nextStore[k] = { box: 0, due: today, seen: 0, lapses: 0, first: today, last: today };
    }
    storeRef.current = nextStore;
    setStore(nextStore);
    saveStore(nextStore);
    rebuild();
  }, [today, rebuild]);

  // 键盘：空格/回车翻卡，1/2/3 评分
  useEffect(() => {
    if (!items || idx >= items.length) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setRevealed(true);
      } else if ('123'.includes(e.key) && revealed) {
        e.preventDefault();
        grade(GRADE_BTNS[Number(e.key) - 1].grade);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const cur = items && idx < items.length ? items[idx] : null;
  // done 必须是「有卡片且全部评完」，空数组（无到期）走引导态而非结算页
  const done = !!items && items.length > 0 && idx >= items.length;
  const upcoming = useMemo(() => {
    const nextDue = Object.values(store)
      .map((e) => e.due)
      .filter((d) => d > today)
      .sort()[0];
    return nextDue || null;
  }, [store, today]);

  return (
    <div className="reading">
      <div className="page-head">
        <p className="eyebrow eyebrow--prussian">Spaced Repetition · 间隔复习</p>
        <h1 className="page-title">复习</h1>
        <p className="page-lede">
          记住的词越推越远，忘了的词拉回今天。进度只存在本机浏览器里（localStorage）。
        </p>
      </div>

      {error && (
        <div className="empty" style={{ marginBottom: 18 }}>
          <div className="empty-title">出错了</div>
          <p className="page-lede">{error}</p>
        </div>
      )}

      {!items && !error && <div className="reading loading">正在准备复习队列…</div>}

      {items && items.length === 0 && !error && (
        <div className="rv-empty">
          <p className="rv-empty-title">今天没有到期的词</p>
          <p className="rv-empty-sub">
            词库共 {allWords.length} 词，其中 {Object.keys(store).length} 词已进入复习本。
            每日配额 5 个新词，点下面的按钮立刻开始。
          </p>
          <div className="rv-empty-actions">
            <button type="button" className="rv-btn rv-btn--go" onClick={startFresh}>
              先学 5 个新词
            </button>
            {latestIssue && (
              <a className="chip" {...linkProps(`/issue/${latestIssue.date}`)}>
                回到今日新词
              </a>
            )}
          </div>
        </div>
      )}

      {cur && items && (
        <>
          <div className="rv-progress">
            <div className="rv-progress-bar">
              <i style={{ width: `${(idx / items.length) * 100}%` }} />
            </div>
            <div className="rv-progress-meta">
              <span>
                第 <strong>{idx + 1}</strong> / {items.length} 词
              </span>
              <span>
                {cur.isNew ? '新词 New' : `到期 Due · 第 ${store[cur.key]?.box ?? 0} 级`}
              </span>
            </div>
          </div>

          <article className="rv-card">
            <div className="rv-card-head">
              <span className={`tag ${cur.word.domain === 'ai' ? 'tag--ai' : cur.word.domain === 'finance' ? 'tag--finance' : 'tag--neutral'}`}>
                {cur.word.domainLabel}
              </span>
              {cur.word.pos && <span className="tag tag--neutral">{cur.word.pos}</span>}
              <a className="rv-card-from" {...linkProps(`/issue/${wordDates[cur.key] || ''}`)}>
                来自 {formatDate(wordDates[cur.key] || '')}
              </a>
            </div>

            <div className="rv-front">
              <h2 className="rv-word">{cur.word.word}</h2>
              {isSpeechSupported() && (
                <SpeakBtn text={cur.word.word} />
              )}
            </div>
            {cur.word.phonetic && <p className="rv-phon">{cur.word.phonetic}</p>}

            {!revealed ? (
              <button type="button" className="rv-reveal" onClick={() => setRevealed(true)}>
                显示答案 · 空格键也可以
              </button>
            ) : (
              <div className="rv-back">
                {cur.word.gloss && <p className="rv-gloss">{cur.word.gloss}</p>}
                {cur.word.meaning && (
                  <p className="rv-meaning">
                    <Inline text={cur.word.meaning} />
                  </p>
                )}
                {cur.word.example && (
                  <div className="rv-block">
                    <div className="wc-block-label">Example</div>
                    <p className="rv-example">{cur.word.example}</p>
                    {cur.word.exampleCn && <p className="rv-ex-cn">{cur.word.exampleCn}</p>}
                  </div>
                )}
                {cur.word.memory && (
                  <div className="rv-block">
                    <div className="wc-block-label">Memory</div>
                    <p className="rv-memory">
                      <Inline text={cur.word.memory} />
                    </p>
                  </div>
                )}
              </div>
            )}

            {revealed && (
              <div className="rv-grades">
                {GRADE_BTNS.map((b) => (
                  <button
                    key={b.grade}
                    type="button"
                    className={`rv-btn rv-btn--${b.grade}`}
                    onClick={() => grade(b.grade)}
                  >
                    <span className="rv-btn-label">
                      <i className="rv-btn-key">{b.key}</i>
                      {b.label}
                    </span>
                    <span className="rv-btn-hint">{b.hint}</span>
                  </button>
                ))}
              </div>
            )}
          </article>
        </>
      )}

      {done && (
        <div className="rv-done">
          <p className="rv-done-title">这一轮结束</p>
          <div className="rv-done-stats">
            <div><strong>{tally.good}</strong><span>记牢了 good</span></div>
            <div><strong>{tally.hard}</strong><span>模糊 hard</span></div>
            <div><strong>{tally.again}</strong><span>忘了 again</span></div>
          </div>
          <p className="rv-done-sub">
            {upcoming
              ? `下一批到期：${formatDate(upcoming)}。间隔阶梯 ${INTERVALS.slice(1).join(' / ')} 天。`
              : '所有词都记牢了，等它们到期再来。'}
            {' '}共 {Object.keys(store).length} 词在复习本里。
          </p>
          <div className="rv-empty-actions">
            <button type="button" className="rv-btn rv-btn--go" onClick={rebuild}>
              再来一轮
            </button>
            <a className="chip" {...linkProps('/archive')}>
              去看归档
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
