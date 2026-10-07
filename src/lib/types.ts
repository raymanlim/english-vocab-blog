export type Domain = 'ai' | 'finance' | 'both' | 'other';

export interface Word {
  no: number;
  word: string;
  issueNoLocal: number | null;
  phonetic: string;
  pos: string;
  posRaw: string;
  related: string[];
  meaning: string;
  gloss: string;
  example: string;
  exampleCn: string;
  memory: string;
  domain: Domain;
  domainLabel: string;
}

export interface SummaryRow {
  no: string;
  word: string;
  phonetic: string;
  domain: string;
  point: string;
}

export interface ComparisonRow {
  item: string;
  note: string;
}

export interface Issue {
  date: string;
  issueNo: number;
  issueSpan: number;
  issueLabel: string;
  issueNoLabel: string;
  theme: string;
  themeRaw: string;
  note: string;
  title: string;
  counts: Record<Domain, number>;
  words: Word[];
  summary: SummaryRow[];
  comparisons: ComparisonRow[];
  progress: string[];
}

export interface IssueMeta {
  date: string;
  issueNo: number;
  issueSpan: number;
  issueLabel: string;
  issueNoLabel: string;
  theme: string;
  note: string;
  wordCount: number;
  counts: Record<Domain, number>;
  words: string[];
}

export interface Manifest {
  generatedAt: string;
  source: string;
  totals: {
    issues: number;
    days: number;
    words: number;
    ai: number;
    finance: number;
    both: number;
    other: number;
  };
  issues: IssueMeta[];
}

export interface SearchEntry {
  id: string;
  word: string;
  phonetic: string;
  pos: string;
  domain: Domain;
  date: string;
  issueNo: number;
  issueLabel: string;
  no: number;
  idx: number;
  brief: string;
  example: string;
  related: string[];
  searchText: string;
}
