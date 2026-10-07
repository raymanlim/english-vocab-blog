import { linkProps } from '../lib/router';
import { manifest } from '../lib/data';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <p className="footer-note">
          Daily Vocabulary · AI × Finance English
          <br />
          内容源：Obsidian <code>pinghe/english words</code> · 累计 {manifest.totals.words} 词 /{' '}
          {manifest.totals.issues} 期
        </p>
        <nav className="footer-links">
          <a className="footer-link" {...linkProps('/')}>
            首页
          </a>
          <a className="footer-link" {...linkProps('/archive')}>
            归档
          </a>
          <a className="footer-link" {...linkProps('/search')}>
            搜索
          </a>
          <a className="footer-link" {...linkProps('/about')}>
            关于
          </a>
        </nav>
      </div>
    </footer>
  );
}
