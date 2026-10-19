/**
 * smoke_review.mjs —— 间隔重复（复习本）功能冒烟
 *
 * 覆盖完整闭环：空态 → 开新词 → 翻卡 → 三档评分 → 结算 → localStorage 落库
 *    → 首页角标联动 → 到期词回到队列 → 词卡上「加入复习本」。
 *
 * 为什么单独一个脚本：复习逻辑全在浏览器端（localStorage + 纯函数），
 * 单元测试跑不到 React 交互与 storage 的真实行为，这里用真浏览器兜底。
 *
 * 用法：node scripts/smoke_review.mjs [distDir]
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.resolve(process.argv[2] || path.join(ROOT, 'dist'));

const EXECUTABLES = [
  'C:/Users/shand/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

let pass = 0;
let fail = 0;
const failures = [];

function check(name, ok, detail = '') {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}${detail ? `  — ${detail}` : ''}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? `  — ${detail}` : ''}`);
  }
}

function startServer(root) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const clean = decodeURIComponent((req.url || '/').split('?')[0]);
      let file = path.join(root, clean === '/' ? 'index.html' : clean);
      if (!file.startsWith(root)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        // hash 路由：找不到资源时回落到 index.html
        file = path.join(root, 'index.html');
      }
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

function todayStr() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  const p = (x) => String(x).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

async function main() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error(`找不到构建产物：${DIST}（先跑 vite build）`);
    process.exit(2);
  }
  const { server, base } = await startServer(DIST);
  const today = todayStr();
  console.log(`复习本冒烟 · target=${base} · dist=${DIST}\n`);

  const browser = await chromium.launch({
    headless: true,
    executablePath: EXECUTABLES.find((p) => fs.existsSync(p)),
  });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  const readStore = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('dv.srs.v1') || '{}'));

  // 1) 空复习本：首访即给 5 个新词
  console.log('开新词（空复习本）');
  await page.goto(`${base}/#/review`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.rv-card', { timeout: 20000 });
  check('首访直接进入第 1 张卡', (await page.locator('.rv-progress-meta span').count()) === 2);
  const meta = await page.locator('.rv-progress-meta span').first().innerText();
  check('队列共 5 个新词', /第\s*1\s*\/\s*5/.test(meta.replace(/\s+/g, '')), meta);
  const word1 = await page.locator('.rv-word').innerText();
  check('卡片正面有单词与音标', word1.trim().length > 0 && (await page.locator('.rv-phon').count()) === 1, word1);

  // 2) 翻卡 + 评分 5 次（每张卡都要先翻面再评分）
  await page.locator('.rv-reveal').click();
  check('翻卡后出现释义与三档评分按钮', (await page.locator('.rv-grades .rv-btn').count()) === 3);
  for (let i = 0; i < 5; i++) {
    // 评级后下一张卡回到正面（reveal 按钮重新出现），需先翻面
    if (await page.locator('.rv-reveal').count()) {
      await page.locator('.rv-reveal').click();
    }
    await page.locator('.rv-btn--good').click();
    await page.waitForTimeout(120);
  }
  await page.waitForSelector('.rv-done', { timeout: 20000 });
  const stats = await page.locator('.rv-done-stats').innerText();
  check('结算显示记牢了 5', /5/.test(stats) && stats.includes('good'), stats.replace(/\n/g, ' '));

  const store = await readStore();
  const keys = Object.keys(store);
  check('5 个词已落入 localStorage', keys.length === 5, `entries=${keys.length}`);
  const goodBox = keys.every((k) => store[k].box === 1 && store[k].due === addDays(today, 1));
  check('好评一次 → box=1 且 due=+1 天', goodBox, `due=${store[keys[0]]?.due}`);
  check('词卡来源可回溯（first 为今天）', keys.every((k) => store[k].first === today));

  // 3) 首页角标联动（无到期）
  console.log('首页联动');
  await page.goto(`${base}/#/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.rv-banner', { timeout: 20000 });
  const banner = await page.locator('.rv-banner').innerText();
  check('今日已清空时角标说明', banner.includes('今日复习已清空'), banner.slice(0, 30));

  // 4) 造一个到期词
  await page.evaluate((t) => {
    const s = JSON.parse(localStorage.getItem('dv.srs.v1') || '{}');
    const k = Object.keys(s)[0];
    if (k) s[k].due = t;
    localStorage.setItem('dv.srs.v1', JSON.stringify(s));
  }, today);
  await page.reload({ waitUntil: 'networkidle' });
  const banner2 = await page.locator('.rv-banner').innerText();
  check('出现到期词时角标计数', banner2.includes('1') && banner2.includes('到期'), banner2.slice(0, 30));
  await page.locator('.rv-banner-cta').click();
  await page.waitForSelector('.rv-card', { timeout: 20000 });
  const meta2 = await page.locator('.rv-progress-meta span').first().innerText();
  check('到期词重新排进队列', /第\s*1/.test(meta2.replace(/\s+/g, '')), meta2);

  // 5) 「忘了」→ 掉回 box0 且仍是今天
  await page.locator('.rv-reveal').click();
  await page.locator('.rv-btn--again').click();
  await page.waitForTimeout(200);
  const s2 = await readStore();
  const againKey = Object.keys(s2).find((k) => s2[k].lapses === 1);
  check('点「忘了」→ box=0、due=今天、lapses+1',
    !!againKey && s2[againKey].box === 0 && s2[againKey].due === today,
    againKey ? `box=${s2[againKey].box} due=${s2[againKey].due}` : '未找到');

  // 6) 全部排到明天 → 复习页进入引导态（今日新词配额已用完，不再发新词）
  console.log('引导态');
  await page.evaluate((t) => {
    const s = JSON.parse(localStorage.getItem('dv.srs.v1') || '{}');
    for (const k of Object.keys(s)) s[k].due = t;
    localStorage.setItem('dv.srs.v1', JSON.stringify(s));
  }, addDays(today, 1));
  // 已在 /review，需整页 reload（同 hash 的 goto 不会重挂载组件，会沿用上轮 done 态）
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.rv-empty', { timeout: 20000 });
  const emptyTitle = await page.locator('.rv-empty-title').innerText();
  check('无到期且配额用完时展示引导态', emptyTitle.includes('没有到期'), emptyTitle);
  const emptyMsg = await page.locator('.rv-empty-sub').innerText();
  check('引导态说明含「词库 / 复习本」',
    /词库|复习本/.test(emptyMsg), emptyMsg.slice(0, 40));
  // 配额已用完（今天已引入 5 个新词）→ 点「先学」给出提示而非重复发词
  await page.locator('.rv-btn--go').first().click();
  await page.waitForTimeout(400);
  const errText = await page.locator('.empty .page-lede').innerText().catch(() => '');
  check('配额用尽时点「先学」不再发新词',
    /词库已|全部进入|到期/.test(errText), errText.slice(0, 40));

  // 7) 词卡上「加入复习本」
  console.log('词卡入口');
  await page.goto(`${base}/#/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.wc-srs', { timeout: 20000 });
  const before = await page.locator('.wc-srs').first().innerText();
  await page.locator('.wc-srs').first().click();
  await page.waitForTimeout(300);
  const after = await page.locator('.wc-srs').first().innerText();
  const s3 = await readStore();
  check('词卡可加入复习本',
    before.includes('加入') && after.includes('复习本中') && Object.keys(s3).length >= 6,
    `${before} → ${after}`);
  await page.locator('.wc-srs').first().click();
  await page.waitForTimeout(300);
  check('再点一次可移出复习本',
    (await page.locator('.wc-srs').first().innerText()).includes('加入'));

  check('全程无 JS 报错', errors.length === 0, errors.slice(0, 2).join('；') || '0 条');

  await ctx.close();
  await browser.close();
  server.close();

  console.log(`\n✅ ${pass} 通过 / ${fail} 失败`);
  if (fail) {
    console.log('失败项：' + failures.join('、'));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
