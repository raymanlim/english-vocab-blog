import { linkProps } from '../lib/router';

export function NotFoundPage({ path }: { path: string }) {
  return (
    <div className="reading">
      <div className="page-head">
        <h1 className="page-title">404</h1>
        <p className="page-lede">
          找不到路径 <code>{path}</code>。它可能已被移除，或链接输入有误。
        </p>
      </div>
      <div className="chip-row" style={{ marginTop: 26 }}>
        <a className="chip" {...linkProps('/')}>
          返回首页
        </a>
        <a className="chip" {...linkProps('/archive')}>
          查看归档
        </a>
        <a className="chip" {...linkProps('/search')}>
          搜索单词
        </a>
      </div>
    </div>
  );
}
