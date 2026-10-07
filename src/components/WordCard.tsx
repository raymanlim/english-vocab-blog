import { Inline } from '../lib/inline';
import type { Word } from '../lib/types';

function tagClass(domain: string): string {
  if (domain === 'ai') return 'tag tag--ai';
  if (domain === 'finance') return 'tag tag--finance';
  return 'tag tag--neutral';
}

export function WordCard({ word }: { word: Word }) {
  return (
    <article className="word-card" id={`w-${word.no}`}>
      <div className="wc-head">
        <div className="wc-no">{String(word.no).padStart(2, '0')}</div>
        <div>
          <h3 className="wc-word">{word.word}</h3>
          {word.phonetic && <div className="wc-phon">{word.phonetic}</div>}
        </div>
        <div className="wc-tags">
          <span className={tagClass(word.domain)}>{word.domainLabel}</span>
          {word.pos && <span className="tag tag--neutral">{word.pos}</span>}
        </div>
      </div>

      <div className="wc-body">
        {word.gloss && <p className="wc-gloss">{word.gloss}</p>}
        {word.meaning && (
          <p className="wc-meaning">
            <Inline text={word.meaning} />
          </p>
        )}

        {word.example && (
          <div className="wc-block">
            <div className="wc-block-label">Example</div>
            <p className="wc-example">{word.example}</p>
            {word.exampleCn && <p className="wc-example-cn">{word.exampleCn}</p>}
          </div>
        )}

        {word.memory && (
          <div className="wc-memory">
            <div className="wc-block-label">Memory</div>
            <p className="wc-memory-text">
              <Inline text={word.memory} />
            </p>
          </div>
        )}

        {word.related.length > 0 && (
          <div className="wc-related">
            <span className="wc-related-label">Related</span>
            {word.related.map((r) => (
              <span className="wc-related-item" key={r}>
                {r}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
