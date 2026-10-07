import { IssueView } from '../components/IssueView';
import { latestIssue } from '../lib/data';

export function IssuePage({ date }: { date: string }) {
  return <IssueView date={date} isLatest={latestIssue?.date === date} />;
}
