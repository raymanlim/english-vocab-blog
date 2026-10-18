import { Inline } from '../lib/inline';
import type { Word } from '../lib/types';
import { isSpeechSupported, pickEnVoice, speak, useVoices } from '../lib/speak';

function tagClass(domain: string): string {
  if (domain === 'ai') return 'tag tag--ai';
  if (domain === 'finance') return 'tag tag--finance';
  return 'tag tag--neutral';
}

// 发音按钮：声波图标 + 无障碍标签。朗读中的按钮加 .is-on 高亮。
function SpeakButton({
  label,
  text,
  voice,
}: {
  label: string;
  text: string;
  voice: SpeechSynthesisVoice | null;
}) {
  return (
    <button
      type="button"
      className="wc-speak"
      aria-label={`朗读${label}`}
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

export function WordCard({ word }: { word: Word }) {
  const voices = useVoices();
  const voice = pickEnVoice(voices);
  const canSpeak = isSpeechSupported();

  return (
    <article className="word-card" id={`w-${word.no}`}>
      <div className="wc-head">
        <div className="wc-no">{String(word.no).padStart(2, '0')}</div>
        <div className="wc-title">
          <h3 className="wc-word">
            {word.word}
            {canSpeak && <SpeakButton label="单词" text={word.word} voice={voice} />}
          </h3>
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
            <div className="wc-block-label">
              Example
              {canSpeak && <SpeakButton label="例句" text={word.example} voice={voice} />}
            </div>
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
