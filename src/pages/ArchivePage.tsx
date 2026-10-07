import { compactDomainText, formatDate, issuesNewestFirst, manifest } from '../lib/data';
import { linkProps } from '../lib/router';

export function ArchivePage() {
  return (
    <div className="reading">
      <div className="page-head">
        <h1 className="page-title">Archive</h1>
        <p className="page-lede">
          共 {manifest.totals.days} 天 · {manifest.totals.issues} 期 · {manifest.totals.words} 词
          （{manifest.totals.ai} AI · {manifest.totals.finance} Finance），按日期倒序。
        </p>
      </div>

      <div className="archive">
        <div className="archive-head">
          <span className="eyebrow">日期</span>
          <span className="eyebrow">期号</span>
          <span className="eyebrow">主题</span>
          <span className="eyebrow">词数</span>
          <span className="eyebrow archive-split">领域</span>
        </div>

        {issuesNewestFirst.map((issue) => (
          <a className="archive-row" key={issue.date} {...linkProps(`/issue/${issue.date}`)}>
            <span className="archive-date">{formatDate(issue.date)}</span>
            <span className="archive-issue">{issue.issueLabel}</span>
            <span className="archive-theme">{issue.theme}</span>
            <span className="archive-count">{issue.wordCount} Words</span>
            <span className="archive-split">{compactDomainText(issue.counts)}</span>
            <span className="archive-words">{issue.words.join(' · ')}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
