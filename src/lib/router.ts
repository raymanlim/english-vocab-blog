import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'issue'; date: string }
  | { name: 'archive' }
  | { name: 'category'; domain: 'ai' | 'finance' }
  | { name: 'review' }
  | { name: 'search'; q: string }
  | { name: 'about' }
  | { name: 'notfound'; path: string };

/** 极简 hash 路由：零依赖，静态托管下无需服务端 fallback */
export function parseHash(raw: string): Route {
  const hash = (raw || '').replace(/^#/, '') || '/';
  const [pathPart, queryPart] = hash.split('?');
  const segments = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(queryPart || '');

  if (segments.length === 0) return { name: 'home' };

  switch (segments[0]) {
    case 'issue':
      return segments[1]
        ? { name: 'issue', date: segments[1] }
        : { name: 'archive' };
    case 'archive':
      return { name: 'archive' };
    case 'ai':
      return { name: 'category', domain: 'ai' };
    case 'finance':
      return { name: 'category', domain: 'finance' };
    case 'review':
      return { name: 'review' };
    case 'search':
      return { name: 'search', q: params.get('q') || '' };
    case 'about':
      return { name: 'about' };
    default:
      return { name: 'notfound', path: pathPart };
  }
}

function currentHash(): string {
  return window.location.hash || '#/';
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(currentHash()));

  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(currentHash()));
      window.scrollTo({ top: 0, behavior: 'auto' });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}

export function href(to: string): string {
  return `#${to}`;
}

export function go(to: string): void {
  if (currentHash() === `#${to}`) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  window.location.hash = to;
}

/** 用于 <a> 的点击拦截，保持原生语义（可新窗口打开） */
export function linkProps(to: string) {
  return {
    href: href(to),
    onClick: (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      go(to);
    },
  };
}
