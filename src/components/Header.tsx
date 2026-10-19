import { useEffect, useState } from 'react';
import type { Route } from '../lib/router';
import { linkProps } from '../lib/router';

const NAV = [
  { label: 'Home', to: '/', match: 'home' },
  { label: 'Archive', to: '/archive', match: 'archive' },
  { label: 'AI', to: '/ai', match: 'cat-ai' },
  { label: 'Finance', to: '/finance', match: 'cat-finance' },
  { label: 'Review', to: '/review', match: 'review' },
  { label: 'About', to: '/about', match: 'about' },
] as const;

function activeKey(route: Route): string {
  switch (route.name) {
    case 'home':
      return 'home';
    case 'archive':
      return 'archive';
    case 'about':
      return 'about';
    case 'category':
      return route.domain === 'ai' ? 'cat-ai' : 'cat-finance';
    case 'review':
      return 'review';
    case 'issue':
    case 'search':
      return '';
    default:
      return '';
  }
}

export function Header({ route }: { route: Route }) {
  const [open, setOpen] = useState(false);
  const active = activeKey(route);

  // 路由变化后自动收起移动端菜单
  useEffect(() => {
    setOpen(false);
  }, [route.name, route.name === 'category' ? route.domain : '']);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <a className="brand" {...linkProps('/')} aria-label="返回首页">
          <span className="brand-main">Daily Vocabulary</span>
          <span className="brand-sub">AI × Finance English</span>
        </a>

        <button
          className="nav-toggle"
          aria-label={open ? '收起导航' : '展开导航'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
        </button>

        <nav className="site-nav" data-open={open ? 'true' : 'false'}>
          {NAV.map((item) => (
            <a
              key={item.label}
              className="nav-link"
              aria-current={active === item.match ? 'page' : undefined}
              {...linkProps(item.to)}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
