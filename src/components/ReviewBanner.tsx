import { useEffect, useState } from 'react';
import { allWords } from '../lib/data';
import { linkProps } from '../lib/router';
import { loadStore, onStoreChange, srsSummary, todayStr } from '../lib/srs';

/**
 * 首页复习入口 —— 一句话告诉用户「今天该回来复习几个词」。
 * 计数只来自 localStorage，不加载任何期次数据，渲染零成本。
 */
export function ReviewBanner() {
  const [sum, setSum] = useState(() => srsSummary(loadStore(), allWords, todayStr()));

  useEffect(() => {
    const refresh = () => setSum(srsSummary(loadStore(), allWords, todayStr()));
    refresh();
    return onStoreChange(refresh);
  }, []);

  if (sum.total === 0) {
    return (
      <div className="rv-banner rv-banner--clear">
        <span className="rv-banner-dot" aria-hidden="true" />
        <span className="rv-banner-text">
          今日复习已清空 · no cards due today
        </span>
        <a className="rv-banner-link" {...linkProps('/review')}>
          查看复习本
        </a>
      </div>
    );
  }

  return (
    <div className="rv-banner">
      <span className="rv-banner-dot" aria-hidden="true" />
      <span className="rv-banner-text">
        <strong>{sum.due}</strong> 个到期词{sum.fresh > 0 && <> · <strong>{sum.fresh}</strong> 个新词</>}
        <span className="rv-banner-sub">due today · review 5 min</span>
      </span>
      <a className="rv-banner-cta" {...linkProps('/review')}>
        开始复习 →
      </a>
    </div>
  );
}
