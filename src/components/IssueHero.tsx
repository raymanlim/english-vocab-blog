import type { Issue } from '../lib/types';
import { domainCountsText, formatDate } from '../lib/data';

export function IssueHero({ issue, isLatest }: { issue: Issue; isLatest: boolean }) {
  return (
    <section className="hero">
      <div className="hero-top">
        <span className="hero-issue">Issue {issue.issueNoLabel}</span>
        <span className="hero-date">{formatDate(issue.date)}</span>
      </div>

      <div className="hero-theme-label eyebrow eyebrow--prussian">
        {isLatest ? '今日主题 · Latest' : '本期主题'}
      </div>
      <h1 className="hero-theme">{issue.theme}</h1>

      {issue.note && <p className="hero-note">{issue.note}</p>}

      <div className="hero-stats">
        <span className="stat-strong">{issue.words.length} Words</span>
        <span className="stat-sep" />
        <span className="stat-soft">{domainCountsText(issue.counts)}</span>
      </div>
    </section>
  );
}
