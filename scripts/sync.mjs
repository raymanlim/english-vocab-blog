#!/usr/bin/env node
/**
 * sync.mjs — 把 Obsidian 英语单词 Markdown 目录同步为站点数据。
 *
 * 设计原则：
 *  1. 源目录 **只读**，绝不修改任何原始 Markdown。
 *  2. 容错优先：历史文件格式若有差异，在此适配，不要求用户回改文件。
 *  3. 输出为纯 JSON，前端零解析负担。
 *
 * 用法：
 *   npm run sync
 *   VOCAB_SOURCE="D:\\path\\to\\dir" npm run sync
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SOURCE_DIR =
  process.env.VOCAB_SOURCE ||
  'D:\\Obsidian\\obsidian_valut\\pinghe\\english words';

const DATA_DIR = path.join(ROOT, 'src', 'data');
const ISSUES_DIR = path.join(DATA_DIR, 'issues');

/* ------------------------------------------------------------------ *
 * 🔴 只读边界守卫
 *
 *   SOURCE_DIR 所在的 D:\Obsidian\obsidian_valut 整体是一个 Git 仓库
 *   （远端 raymanlim/obsidian_vault）。任何落进 vault 的文件都会被
 *   commit、push，并与其他机器上的同名文件冲突。
 *
 *   ⇒ 两条铁律：
 *     1. 本脚本**只读** SOURCE_DIR，绝不写入 vault 里的任何位置。
 *     2. 派生数据（DATA_DIR）必须位于 vault **之外**。
 *
 *   第 2 条在此硬断言：不满足直接退出，避免「悄悄把派生数据写进
 *   知识库」这种最难排查的污染。
 * ------------------------------------------------------------------ */

const VAULT_ROOT =
  process.env.VOCAB_VAULT_ROOT || 'D:\\Obsidian\\obsidian_valut';

/** target 是否位于 parent 之内（含相等）。Windows 路径大小写不敏感，统一小写比较。 */
function isInside(target, parent) {
  const p = path.resolve(parent).toLowerCase();
  const t = path.resolve(target).toLowerCase();
  if (p === t) return true;
  const rel = path.relative(p, t);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function assertOutsideVault(target) {
  if (!isInside(target, VAULT_ROOT)) return;
  console.error(
    '\n❌ 派生数据目录落在 Obsidian vault 内：\n' +
      '     目标：' + target + '\n' +
      '     vault：' + VAULT_ROOT + '\n\n' +
      '   vault 整体是一个 Git 仓库（raymanlim/obsidian_vault），\n' +
      '   整棵树都会被同步到 GitHub —— 派生数据写进去会造成跨机冲突。\n' +
      '   请把输出目录移到 vault 之外。详见 AGENTS.md §1。'
  );
  process.exit(1);
}

/**
 * 把数据源路径表示为「vault 内相对路径」（POSIX 风格）。
 *
 * ⚠️ manifest.json 里的 source 字段会随前端 bundle **发布到线上**，
 *    写本机绝对路径（`D:\Obsidian\...`）等于公开本机目录结构。
 *    不在 vault 内时退化为末级目录名。
 */
function toVaultRelative(dir) {
  const abs = path.resolve(dir);
  const rel = path.relative(path.resolve(VAULT_ROOT), abs);
  const inside = !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
  return (inside ? rel : path.basename(abs)).split(path.sep).join('/');
}

assertOutsideVault(DATA_DIR);

// 源目录本应位于 vault 内；不在则大概率是换了机器或路径漂移，提示但不阻断。
if (!isInside(SOURCE_DIR, VAULT_ROOT)) {
  console.warn(
    '  ⚠ 源目录不在预期 vault 内（' + VAULT_ROOT + '）：' + SOURCE_DIR +
      '\n    若是有意为之可忽略；否则检查 VOCAB_SOURCE / VOCAB_VAULT_ROOT。'
  );
}

/* ------------------------------------------------------------------ *
 * 工具函数
 * ------------------------------------------------------------------ */

const log = (...a) => console.log(...a);
const warn = (...a) => console.warn('  ⚠', ...a);

/** 去掉 markdown 行内标记，用于生成搜索索引与纯文本摘要 */
function stripInline(s) {
  if (!s) return '';
  return s
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1$2')
    .replace(/\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g, (_m, a, b) => b || a)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 按显示宽度截断（中文字符算 2） */
function truncate(s, max = 120) {
  if (!s) return '';
  if (s.length <= max) return s;
  return s.slice(0, max).replace(/[\s，。、；：,.;:]+$/, '') + '…';
}

/* ------------------------------------------------------------------ *
 * 领域判定
 * ------------------------------------------------------------------ */

const AI_KEYWORDS = [
  'model', 'training', 'inference', 'llm', 'token', 'neural', 'embedding',
  'transformer', 'attention', 'prompt', 'agent', 'gpu', 'context', 'benchmark',
  'dataset', 'alignment', 'quantiz', 'fine-tun', 'distillat', 'hallucinat',
  '模型', '训练', '推理', '算法', '参数', '显存', '算力', '分词', '向量',
  '注意力', '提示', '智能体', '上下文', '对齐', '微调', '量化', '蒸馏',
  '神经网络', '数据集', '评测', '缓存',
];

const FIN_KEYWORDS = [
  'stock', 'bond', 'yield', 'market', 'invest', 'price', 'equity', 'return',
  'risk', 'portfolio', 'hedge', 'volatil', 'option', 'rate', 'capital',
  'dividend', 'valuation', 'liquid', 'leverage', 'spread', 'credit',
  '股票', '债券', '收益率', '市场', '投资', '估值', '风险', '组合', '对冲',
  '波动', '期权', '利率', '股息', '流动性', '杠杆', '利差', '信用', '久期',
  '套利', '保证金', '在险价值', '夏普',
];

/**
 * 三层判定：① 词义中的【AI】/【金融】标记
 *            ② _index.md 的累计清单（权威）
 *            ③ 关键词启发式
 */
function resolveDomain(meaningText, wholeText, word, indexMap) {
  const m = meaningText || '';
  const hasAi = /【AI[^】]*】/.test(m) || /【[^】]*AI[^】]*】/.test(m);
  const hasFin = /【金融[^】]*】/.test(m) || /【[^】]*金融[^】]*】/.test(m);
  if (hasAi && hasFin) return 'both';
  if (hasAi) return 'ai';
  if (hasFin) return 'finance';

  // ② 索引清单
  const key = normalizeWord(word);
  const fromIndex = indexMap.get(key);
  if (fromIndex) return fromIndex;

  // ③ 关键词启发式
  const t = (wholeText || '').toLowerCase();
  const aiScore = AI_KEYWORDS.reduce((n, k) => n + (t.includes(k) ? 1 : 0), 0);
  const finScore = FIN_KEYWORDS.reduce((n, k) => n + (t.includes(k) ? 1 : 0), 0);
  if (aiScore > finScore) return 'ai';
  if (finScore > aiScore) return 'finance';
  return 'other';
}

/**
 * 从完整词义中抽出「中文短释义」，用于词卡的视觉焦点行。
 * 例：
 *   【AI】KV 缓存；键值缓存——自回归推理时…      → KV 缓存
 *   股息；红利；**引申**：回报、好处             → 股息
 *   【金融】夏普比率——每承担一单位总波动率…      → 夏普比率
 */
function extractGloss(meaning) {
  if (!meaning) return '';
  const s = meaning.replace(/^【[^】]*】\s*/, '').trim();
  const cut = s.split(/[；;]|——|（|\(/)[0].trim().replace(/[。，、,.\s]+$/, '');
  if (cut && cut.length <= 18) return cut;
  if (cut) return cut.slice(0, 18).trim();
  const parts = s.split(/[；;]/).map((x) => x.trim()).filter(Boolean);
  const fallback = (parts[1] || parts[0] || '').split(/[（(——]/)[0].trim();
  return fallback.slice(0, 18);
}

function normalizeWord(w) {
  return String(w || '')
    .toLowerCase()
    .replace(/[（(].*?[)）]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const DOMAIN_LABEL = {
  ai: 'AI',
  finance: 'Finance',
  both: 'AI · Finance',
  other: 'General',
};

/* ------------------------------------------------------------------ *
 * _index.md：累计清单 → 领域映射表
 * ------------------------------------------------------------------ */

function loadIndexMap(file) {
  const map = new Map();
  if (!fs.existsSync(file)) return map;
  const raw = fs.readFileSync(file, 'utf8');

  const grab = (heading, domain) => {
    const re = new RegExp(
      `\\*\\*${heading}\\*\\*：([\\s\\S]*?)(?:\\n\\s*\\n|\\n>|\\n#|$)`
    );
    const hit = raw.match(re);
    if (!hit) return;
    hit[1]
      .split('·')
      .map((s) => normalizeWord(s))
      .filter(Boolean)
      .forEach((w) => {
        if (!map.has(w)) map.set(w, domain);
      });
  };

  grab('AI 领域', 'ai');
  grab('金融投资', 'finance');
  return map;
}

/* ------------------------------------------------------------------ *
 * 单文件解析
 * ------------------------------------------------------------------ */

const FIELD_LABELS = ['音标', '词性', '词义', '例句', '记忆提示'];

function splitFrontmatter(raw) {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return { meta, body: text.slice(m[0].length) };
}

/** 解析一个词块的字段 */
function parseWordFields(lines) {
  const fields = {};
  for (const label of FIELD_LABELS) {
    const prefix = `- **${label}**：`;
    const idx = lines.findIndex((l) => l.trim().startsWith(prefix));
    if (idx === -1) {
      // 兼容 `- **音标**: ` 半角冒号
      const alt = `- **${label}**: `;
      const i2 = lines.findIndex((l) => l.trim().startsWith(alt));
      if (i2 === -1) continue;
      fields[label] = collect(lines, i2, alt.length);
      continue;
    }
    fields[label] = collect(lines, idx, prefix.length);
  }
  return fields;

  function collect(arr, startIdx, prefixLen) {
    const first = arr[startIdx].trim().slice(prefixLen).trim();
    const cont = [];
    for (let i = startIdx + 1; i < arr.length; i++) {
      const t = arr[i].trim();
      if (t === '') break;
      if (/^[-*]\s/.test(t)) break;
      if (/^#{1,6}\s/.test(t)) break;
      if (/^-{3,}$/.test(t)) break;
      cont.push(t);
    }
    return { first, cont };
  }
}

/** 从词性字段抽出「（相关：a、b、c）」 */
function extractRelated(posText) {
  if (!posText) return [];
  const m = posText.match(
    /[（(]\s*(?:相关|相关词|近义|同义|同义词|近义词|参见|see also)[：:]\s*([^)）]+)[)）]/i
  );
  if (!m) return [];
  return m[1]
    .split(/[、,，/]/)
    .map((s) => s.trim())
    .filter((s) => s && s.length < 40);
}

function parseFile(file, indexMap) {
  const raw = fs.readFileSync(file, 'utf8');
  const { meta, body } = splitFrontmatter(raw);
  const lines = body.split('\n');

  const dateFromName = path.basename(file, '.md').match(/^(\d{4}-\d{2}-\d{2})$/);
  const date = meta.date || (dateFromName ? dateFromName[1] : null);
  if (!date) return null;

  const result = {
    date,
    title: meta.title || '',
    themeRaw: '',
    note: '',
    declaredIssues: [],
    words: [],
    summary: [],
    comparisons: [],
    progress: [],
  };

  let phase = 'idle'; // idle | word | table | progress
  let tableKind = null;
  let currentIssueNo = null;
  let currentWord = null;
  let tableBuf = [];

  const flushWord = () => {
    if (!currentWord) return;
    const f = parseWordFields(currentWord.lines);

    const meaning = [f['词义']?.first, ...(f['词义']?.cont || [])]
      .filter(Boolean)
      .join(' ')
      .trim();

    const exampleEn = f['例句']?.first || '';
    const exampleCn = (f['例句']?.cont || []).join(' ').trim();

    const memory = [f['记忆提示']?.first, ...(f['记忆提示']?.cont || [])]
      .filter(Boolean)
      .join(' ')
      .replace(/^💡\s*/, '')
      .trim();

    const posRaw = f['词性']?.first || '';
    const related = extractRelated(posRaw);

    const whole = [meaning, exampleEn, exampleCn, memory].join(' ');

    result.words.push({
      no: currentWord.no,
      word: currentWord.word,
      issueNoLocal: currentWord.issueNoLocal,
      phonetic: (f['音标']?.first || '').trim(),
      pos: stripInline(posRaw).replace(/[（(]\s*相关[：:][^)）]*[)）]/, '').trim(),
      posRaw: posRaw.trim(),
      related,
      meaning,
      gloss: extractGloss(meaning),
      example: exampleEn,
      exampleCn: exampleCn.replace(/^[（(]\s*/, '').replace(/\s*[)）]$/, ''),
      memory,
      domain: resolveDomain(meaning, whole, currentWord.word, indexMap),
    });
    currentWord = null;
  };

  const flushTable = () => {
    if (tableKind && tableBuf.length) {
      const rows = tableBuf
        .map((l) => l.trim())
        .filter((l) => l.startsWith('|'))
        .map((l) =>
          l
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((c) => c.trim())
        )
        .filter((cells) => !cells.every((c) => /^:?-{2,}:?$/.test(c) || c === ''));

      if (rows.length) {
        const [head, ...body2] = rows;
        if (tableKind === 'summary') {
          result.summary = body2.map((cells) => {
            const o = {};
            head.forEach((h, i) => (o[h] = cells[i] || ''));
            return {
              no: o['#'] || '',
              word: o['单词'] || '',
              phonetic: o['音标'] || '',
              domain: o['领域'] || '',
              point: o['核心要点'] || '',
            };
          });
        } else {
          result.comparisons = body2.map((cells) => {
            const o = {};
            head.forEach((h, i) => (o[h] = cells[i] || ''));
            const keys = Object.keys(o);
            return {
              item: o[keys[0]] || '',
              note: o[keys[1]] || '',
            };
          });
        }
      }
    }
    tableBuf = [];
    tableKind = null;
  };

  for (const line of lines) {
    const t = line.trim();

    // 分隔线：结束当前块
    if (/^-{3,}$/.test(t)) {
      flushWord();
      flushTable();
      phase = 'idle';
      continue;
    }

    // 引用块：主题 / 说明
    if (t.startsWith('>')) {
      const q = t.replace(/^>\s?/, '');
      const themeHit = q.match(/^主题[：:]\s*(.+)$/);
      if (themeHit) {
        result.themeRaw = themeHit[1].replace(/[（(]第\s*\d+\s*期[)）]\s*$/, '').trim();
      } else if (q && !result.note) {
        result.note = q.trim();
      }
      continue;
    }

    // H3：词条
    const h3 = t.match(/^###\s+(\d+)\s*[.、]\s*(.+)$/);
    if (h3) {
      flushWord();
      flushTable();
      currentWord = {
        no: parseInt(h3[1], 10),
        word: h3[2].trim(),
        issueNoLocal: currentIssueNo,
        lines: [],
      };
      phase = 'word';
      continue;
    }

    // H2：分区
    const h2 = t.match(/^##\s+(.+)$/);
    if (h2) {
      flushWord();
      flushTable();
      const title = h2[1].trim();
      const issueHit = title.match(/第\s*(\d+)\s*期/);
      if (issueHit) {
        currentIssueNo = parseInt(issueHit[1], 10);
        result.declaredIssues.push(currentIssueNo);
        phase = 'idle';
      } else if (/速览|概览/.test(title)) {
        tableKind = 'summary';
        phase = 'table';
      } else if (/对照|关联|辨析/.test(title)) {
        tableKind = 'comparison';
        phase = 'table';
      } else if (/进度|统计/.test(title)) {
        phase = 'progress';
      } else {
        phase = 'idle';
      }
      continue;
    }

    if (t.startsWith('#')) continue; // H1 等

    if (phase === 'word') {
      currentWord.lines.push(line);
    } else if (phase === 'table') {
      if (t.startsWith('|')) tableBuf.push(t);
    } else if (phase === 'progress') {
      if (t.startsWith('-')) result.progress.push(t.replace(/^-\s*/, '').trim());
    }
  }

  flushWord();
  flushTable();

  // 主题行的期号（权威），与 ## 第 N 期 交叉校验
  const themeIssue = raw.match(/主题[：:][^\n]*?第\s*(\d+)\s*期/);
  result.themeIssueNo = themeIssue ? parseInt(themeIssue[1], 10) : null;

  return result;
}

/* ------------------------------------------------------------------ *
 * 主流程
 * ------------------------------------------------------------------ */

function main() {
  log('');
  log('📚  英语单词站点数据同步');
  log('    源目录：' + SOURCE_DIR);

  if (!fs.existsSync(SOURCE_DIR)) {
    console.error('\n❌ 源目录不存在：' + SOURCE_DIR);
    console.error('   可通过环境变量 VOCAB_SOURCE 指定其他路径。\n');
    process.exit(1);
  }

  const indexMap = loadIndexMap(path.join(SOURCE_DIR, '_index.md'));
  log(`    索引清单：${indexMap.size} 词（用于领域兜底判定）`);

  const files = fs
    .readdirSync(SOURCE_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort();

  log(`    待解析：${files.length} 个日期文件`);
  log('');

  const parsed = [];
  const issues = [];

  for (const f of files) {
    const full = path.join(SOURCE_DIR, f);
    let r;
    try {
      r = parseFile(full, indexMap);
    } catch (err) {
      warn(`${f} 解析失败：${err.message}`);
      continue;
    }
    if (!r || !r.words.length) {
      warn(`${f} 未解析到词条，已跳过`);
      continue;
    }
    parsed.push(r);
  }

  // 期号：按日期升序累加，一个文件可能含多期（如 2026-09-11 含第 1、2 期）
  parsed.sort((a, b) => a.date.localeCompare(b.date));

  let cursor = 0;
  const warnings = [];

  for (const r of parsed) {
    const span = Math.max(1, r.declaredIssues.length);
    const startNo = cursor + 1;
    cursor += span;

    const issueLabel =
      span === 1 ? `第 ${startNo} 期` : `第 ${startNo}–${startNo + span - 1} 期`;

    // 自检：文件里声明的期号应与推算一致
    const declaredFirst = r.declaredIssues.length
      ? Math.min(...r.declaredIssues)
      : null;
    if (declaredFirst !== null && declaredFirst !== startNo) {
      warnings.push(
        `${r.date}：文件内声明第 ${declaredFirst} 期，推算为第 ${startNo} 期`
      );
    }
    if (r.themeIssueNo !== null && r.themeIssueNo !== startNo) {
      warnings.push(
        `${r.date}：主题行声明第 ${r.themeIssueNo} 期，推算为第 ${startNo} 期`
      );
    }

    const counts = { ai: 0, finance: 0, both: 0, other: 0 };
    for (const w of r.words) counts[w.domain]++;

    const theme = r.themeRaw
      .replace(/\s*\+\s*/g, ' · ')
      .replace(/\s*·\s*/g, ' · ')
      .trim();

    issues.push({
      date: r.date,
      issueNo: startNo,
      issueSpan: span,
      issueLabel,
      issueNoLabel: span === 1 ? String(startNo) : `${startNo}–${startNo + span - 1}`,
      theme,
      themeRaw: r.themeRaw,
      note: r.note,
      title: r.title,
      wordCount: r.words.length,
      counts,
      words: r.words,
      summary: r.summary,
      comparisons: r.comparisons,
      progress: r.progress,
    });
  }

  // 写出
  fs.mkdirSync(ISSUES_DIR, { recursive: true });

  // 清理旧数据，避免源文件删除后站点残留
  for (const old of fs.readdirSync(ISSUES_DIR)) {
    if (old.endsWith('.json')) fs.unlinkSync(path.join(ISSUES_DIR, old));
  }

  const totals = { issues: cursor, days: issues.length, words: 0, ai: 0, finance: 0, both: 0, other: 0 };
  const index = [];

  for (const iss of issues) {
    totals.words += iss.words.length;
    totals.ai += iss.counts.ai;
    totals.finance += iss.counts.finance;
    totals.both += iss.counts.both;
    totals.other += iss.counts.other;

    const full = {
      date: iss.date,
      issueNo: iss.issueNo,
      issueSpan: iss.issueSpan,
      issueLabel: iss.issueLabel,
      issueNoLabel: iss.issueNoLabel,
      theme: iss.theme,
      themeRaw: iss.themeRaw,
      note: iss.note,
      title: iss.title,
      counts: iss.counts,
      words: iss.words.map((w) => ({
        ...w,
        domainLabel: DOMAIN_LABEL[w.domain] || DOMAIN_LABEL.other,
      })),
      summary: iss.summary,
      comparisons: iss.comparisons,
      progress: iss.progress,
    };

    fs.writeFileSync(
      path.join(ISSUES_DIR, `${iss.date}.json`),
      JSON.stringify(full, null, 2),
      'utf8'
    );

    iss.words.forEach((w, i) => {
      index.push({
        id: `${iss.date}-${String(w.no).padStart(2, '0')}`,
        word: w.word,
        phonetic: w.phonetic,
        pos: w.pos,
        domain: w.domain,
        date: iss.date,
        issueNo: iss.issueNo,
        issueLabel: iss.issueLabel,
        no: w.no,
        idx: i,
        brief: truncate(stripInline(w.meaning), 118),
        example: w.example,
        related: w.related,
        searchText: [
          w.word,
          w.phonetic,
          w.pos,
          stripInline(w.meaning),
          w.example,
          w.exampleCn,
          w.related.join(' '),
          iss.date,
          iss.issueLabel,
          iss.theme,
        ]
          .join(' ')
          .toLowerCase(),
      });
    });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    // 只写 vault 内相对路径 —— 该字段会进前端 bundle 并发布上线，不可含本机绝对路径。
    source: toVaultRelative(SOURCE_DIR),
    totals,
    issues: issues
      .map((i) => ({
        date: i.date,
        issueNo: i.issueNo,
        issueSpan: i.issueSpan,
        issueLabel: i.issueLabel,
        issueNoLabel: i.issueNoLabel,
        theme: i.theme,
        note: i.note,
        wordCount: i.wordCount,
        counts: i.counts,
        words: i.words.map((w) => w.word),
      }))
      .sort((a, b) => b.date.localeCompare(a.date)),
  };

  fs.writeFileSync(
    path.join(DATA_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(DATA_DIR, 'index.json'),
    JSON.stringify(index),
    'utf8'
  );

  // 报告
  log('✅  同步完成');
  log('');
  log(`    日期文件：${totals.days}`);
  log(`    累计期数：${totals.issues}`);
  log(`    累计词数：${totals.words}`);
  log(`      AI ${totals.ai} · Finance ${totals.finance}` +
      (totals.both ? ` · 双领域 ${totals.both}` : '') +
      (totals.other ? ` · 未分类 ${totals.other}` : ''));
  log(`    最新一期：${manifest.issues[0]?.date} · ${manifest.issues[0]?.issueLabel} · ${manifest.issues[0]?.theme}`);
  log('');

  const otherWords = index.filter((i) => i.domain === 'other');
  if (otherWords.length) {
    warn(`以下 ${otherWords.length} 个词未能判定领域，已归入 General：`);
    otherWords.forEach((w) => log(`       ${w.date}  ${w.word}`));
  }

  if (warnings.length) {
    log('  ⚠  期号自检提示：');
    warnings.forEach((w) => log(`       ${w}`));
  }

  log('');
}

main();
