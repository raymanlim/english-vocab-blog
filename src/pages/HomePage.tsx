import { IssueView } from '../components/IssueView';
import { latestIssue } from '../lib/data';
import { linkProps } from '../lib/router';

export function HomePage() {
  if (!latestIssue) {
    return (
      <div className="reading">
        <div className="page-head">
          <h1 className="page-title">暂无内容</h1>
          <p className="page-lede">
            数据目录为空。请确认 Obsidian 的 <code>english words</code> 目录下存在词卡文件，
            然后运行 <code>npm run sync</code>。
          </p>
        </div>
        <div className="empty">
          <a className="chip" {...linkProps('/about')}>
            查看说明
          </a>
        </div>
      </div>
    );
  }

  return <IssueView date={latestIssue.date} isLatest />;
}
