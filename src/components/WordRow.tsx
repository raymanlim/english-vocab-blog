import type { SearchEntry } from '../lib/types';
import { DOMAIN_SHORT, formatDate } from '../lib/data';
import { linkProps } from '../lib/router';

export function WordRow({ entry }: { entry: SearchEntry }) {
  return (
    <a className="result-item" {...linkProps(`/issue/${entry.date}`)}>
      <div className="result-head">
        <span className="result-word">{entry.word}</span>
        {entry.phonetic && <span className="result-phon">{entry.phonetic}</span>}
      </div>
      <div className="result-brief">{entry.brief}</div>
      <div className="result-side">
        <span className={`result-tag result-tag--${entry.domain}`}>
          {DOMAIN_SHORT[entry.domain] || 'General'}
        </span>
        {formatDate(entry.date)} · {entry.issueLabel}
      </div>
    </a>
  );
}
