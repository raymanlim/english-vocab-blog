import { useEffect, useState } from 'react';
import type { Issue } from '../lib/types';
import { adjacent, getLoadedIssue, loadIssue, formatDate } from '../lib/data';
import { linkProps } from '../lib/router';
import { Inline } from '../lib/inline';
import { IssueHero } from './IssueHero';
import { WordCard } from './WordCard';

type Status = 'loading' | 'ok' | 'missing';

export function IssueView({ date, isLatest }: { date: string; isLatest: boolean }) {
  const [issue, setIssue] = useState<Issue | null>(() => getLoadedIssue(date));
  const [status, setStatus] = useState<Status>(() =>
    getLoadedIssue(date) ? 'ok' : 'loading'
  );

  useEffect(() => {
    let alive = true;
    const cached = getLoadedIssue(date);
    if (cached) {
      setIssue(cached);
      setStatus('ok');
      return;
    }
    setStatus('loading');
    loadIssue(date).then((data) => {
      if (!alive) return;
      if (data) {
        setIssue(data);
        setStatus('ok');
      } else {
        setStatus('missing');
      }
    });
    return () => {
      alive = false;
    };
  }, [date]);

  if (status === 'loading') {
    return <div className="reading loading">Loading issue…</div>;
  }

  if (status === 'missing' || !issue) {
    return (
      <div className="reading">
        <div className="page-head">
          <h1 className="page-title">未找到该期</h1>
          <p className="page-lede">
            没有 {formatDate(date)} 这一期的数据，可能尚未生成或已被移除。
          </p>
        </div>
        <div className="empty">
          <a className="chip" {...linkProps('/archive')}>
            查看全部归档
          </a>
        </div>
      </div>
    );
  }

  const { prev, next } = adjacent(issue.date);

  return (
    <div className="reading">
      <IssueHero issue={issue} isLatest={isLatest} />

      <nav className="word-index" aria-label="本期单词">
        <div className="word-index-list">
          {issue.words.map((w) => (
            <a
              key={w.no}
              className="word-index-item"
              href={`#w-${w.no}`}
              onClick={(e) => {
                e.preventDefault();
                document
                  .getElementById(`w-${w.no}`)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              <span className="word-index-no">{String(w.no).padStart(2, '0')}</span>
              <span>{w.word}</span>
            </a>
          ))}
        </div>
      </nav>

      <div className="words">
        {issue.words.map((w) => (
          <WordCard key={w.no} word={w} />
        ))}
      </div>

      {issue.summary.length > 0 && (
        <section className="issue-extra">
          <h2 className="issue-extra-title">本期速览 · Overview</h2>
          <table className="summary-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Word</th>
                <th>Phonetic</th>
                <th>Domain</th>
                <th>Key Point</th>
              </tr>
            </thead>
            <tbody>
              {issue.summary.map((r, i) => (
                <tr key={`${r.word}-${i}`}>
                  <td className="c-no">{r.no}</td>
                  <td className="c-word">{r.word}</td>
                  <td className="c-phon">{r.phonetic}</td>
                  <td className="c-domain">{r.domain}</td>
                  <td className="c-point">{r.point}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {issue.comparisons.length > 0 && (
        <section className="issue-extra">
          <h2 className="issue-extra-title">关联与对照 · Cross-reference</h2>
          <div className="compare-list">
            {issue.comparisons.map((c, i) => (
              <div className="compare-row" key={`${c.item}-${i}`}>
                <div className="compare-item">
                  <Inline text={c.item} />
                </div>
                <div className="compare-note">
                  <Inline text={c.note} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {issue.progress.length > 0 && (
        <section className="issue-extra">
          <h2 className="issue-extra-title">进度 · Progress</h2>
          <ul className="progress-list">
            {issue.progress.map((p, i) => (
              <li key={i}>
                <Inline text={p} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav className="issue-nav" aria-label="期次导航">
        {prev ? (
          <a className="issue-nav-link" {...linkProps(`/issue/${prev.date}`)}>
            <span className="issue-nav-dir">← 更早一期</span>
            <span className="issue-nav-title">
              {formatDate(prev.date)} · {prev.issueLabel}
            </span>
          </a>
        ) : (
          <span className="issue-nav-placeholder" />
        )}
        {next ? (
          <a
            className="issue-nav-link issue-nav-link--next"
            {...linkProps(`/issue/${next.date}`)}
          >
            <span className="issue-nav-dir">更晚一期 →</span>
            <span className="issue-nav-title">
              {formatDate(next.date)} · {next.issueLabel}
            </span>
          </a>
        ) : (
          <span className="issue-nav-placeholder" />
        )}
      </nav>
    </div>
  );
}
