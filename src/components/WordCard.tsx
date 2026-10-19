import { useEffect, useState } from 'react';
import { Inline } from '../lib/inline';
import type { Word } from '../lib/types';
import { isSpeechSupported, pickEnVoice, speak, useVoices } from '../lib/speak';
import { loadStore, onStoreChange, saveStore, scheduleNew, todayStr, wordKey } from '../lib/srs';

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

// 「加入生词本」：把词塞进间隔重复队列（今天到期），再点一次移出。
// 状态只落 localStorage，与复习页共用同一个复习本。
function SrsToggle({ word }: { word: Word }) {
  const [store, setStore] = useState(() => loadStore());
  const has = !!store[wordKey(word.word)];

  useEffect(() => onStoreChange(() => setStore(loadStore())), []);

  function toggle() {
    const next = { ...store };
    if (has) delete next[wordKey(word.word)];
    else next[wordKey(word.word)] = scheduleNew(next, word.word, todayStr());
    setStore(next);
    saveStore(next);
  }

  return (
    <button
      type="button"
      className={`wc-srs${has ? ' on' : ''}`}
      onClick={toggle}
      title={has ? '已在复习本，点击移出' : '加入复习本，稍后就考你'}
    >
      {has ? '✓ 复习本中' : '加入复习本'}
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

        <div className="wc-srs-row">
          <SrsToggle word={word} />
        </div>
      </div>
    </article>
  );
}
