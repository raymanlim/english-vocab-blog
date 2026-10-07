/**
 * audit.mjs — 多宽度布局审计
 * 检查每个路由在每个断点下是否出现横向溢出，并输出关键截图。
 * 用法：node scripts/audit.mjs [baseUrl]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SHOT_DIR = path.join(ROOT, '.audit');

const BASE = process.argv[2] || 'http://localhost:4173';

const EXECUTABLES = [
  'C:/Users/shand/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
];

const VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080, dpr: 1 },
  { name: '1440x900', width: 1440, height: 900, dpr: 1 },
  { name: '1280x800', width: 1280, height: 800, dpr: 1 },
  { name: '1024x768', width: 1024, height: 768, dpr: 1 },
  { name: '768x1024', width: 768, height: 1024, dpr: 1 },
  { name: '430x932', width: 430, height: 932, dpr: 2 },
  { name: '390x844', width: 390, height: 844, dpr: 2 },
  { name: '360x800', width: 360, height: 800, dpr: 2 },
];

const ROUTES = [
  { name: 'home', hash: '#/', wait: '.hero' },
  { name: 'issue-0911', hash: '#/issue/2026-09-11', wait: '.hero' },
  { name: 'archive', hash: '#/archive', wait: '.archive' },
  { name: 'category-ai', hash: '#/ai', wait: '.cat-head' },
  { name: 'category-finance', hash: '#/finance', wait: '.cat-head' },
  { name: 'search', hash: '#/search', wait: '.search-bar' },
  { name: 'search-q', hash: '#/search?q=risk', wait: '.result-item' },
  { name: 'about', hash: '#/about', wait: '.prose' },
  { name: 'notfound', hash: '#/nope', wait: '.page-title' },
];

const SHOTS = [
  { vp: '1920x1080', route: 'home' },
  { vp: '1440x900', route: 'home' },
  { vp: '390x844', route: 'home' },
  { vp: '360x800', route: 'home' },
  { vp: '1920x1080', route: 'archive' },
  { vp: '390x844', route: 'archive' },
  { vp: '1920x1080', route: 'category-ai' },
  { vp: '390x844', route: 'search-q' },
  { vp: '390x844', route: 'issue-0911' },
  { vp: '768x1024', route: 'home' },
];

function pickExecutable() {
  for (const p of EXECUTABLES) if (fs.existsSync(p)) return p;
  throw new Error('未找到可用的 Chromium/Chrome 可执行文件');
}

const PROBE = () => {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const bad = [];
  const all = document.querySelectorAll('body *');
  for (const el of all) {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    if (style.position === 'fixed') continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (r.right > vw + 1 || r.left < -1) {
      bad.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || '').slice(0, 56),
        left: Math.round(r.left),
        right: Math.round(r.right),
        text: (el.textContent || '').trim().slice(0, 34),
      });
    }
  }
  // 去重（同一元素重复上报）
  const seen = new Set();
  const uniq = bad.filter((b) => {
    const k = `${b.tag}|${b.cls}|${b.left}|${b.right}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return {
    innerWidth: vw,
    scrollWidth: doc.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    overflowX: doc.scrollWidth - vw,
    offenders: uniq.slice(0, 10),
    offenderCount: uniq.length,
  };
};

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  for (const f of fs.readdirSync(SHOT_DIR)) {
    if (f.endsWith('.png')) fs.unlinkSync(path.join(SHOT_DIR, f));
  }

  const browser = await chromium.launch({
    executablePath: pickExecutable(),
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });

  const failures = [];
  const report = [];

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dpr,
      isMobile: vp.width < 768,
      hasTouch: vp.width < 768,
    });
    const page = await context.newPage();

    for (const route of ROUTES) {
      const url = `${BASE}/${route.hash}`;
      try {
        await page.goto(url, { waitUntil: 'load', timeout: 30000 });
        await page.waitForSelector(route.wait, { timeout: 8000 });
        await page.waitForTimeout(260);
      } catch (err) {
        failures.push({
          vp: vp.name,
          route: route.name,
          kind: 'render',
          detail: err.message.split('\n')[0],
        });
        continue;
      }

      const probe = await page.evaluate(PROBE);
      const row = { vp: vp.name, route: route.name, ...probe };
      report.push(row);

      if (probe.overflowX > 0) {
        failures.push({
          vp: vp.name,
          route: route.name,
          kind: 'overflow',
          detail: `横向溢出 ${probe.overflowX}px（scrollWidth ${probe.scrollWidth} > ${probe.innerWidth}）`,
          offenders: probe.offenders,
        });
      }
    }

    await context.close();
  }

  // 截图
  for (const shot of SHOTS) {
    const vp = VIEWPORTS.find((v) => v.name === shot.vp);
    const route = ROUTES.find((r) => r.name === shot.route);
    if (!vp || !route) continue;

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dpr,
      isMobile: vp.width < 768,
      hasTouch: vp.width < 768,
    });
    const page = await context.newPage();
    await page.goto(`${BASE}/${route.hash}`, { waitUntil: 'load' });
    await page.waitForSelector(route.wait, { timeout: 8000 });
    await page.waitForTimeout(400);
    const file = path.join(SHOT_DIR, `${shot.route}--${shot.vp}.png`);
    await page.screenshot({ path: file, fullPage: false });
    // 全页截图（仅手机首页，用于整体评估）
    if (shot.route === 'home' && vp.width < 768) {
      await page.screenshot({
        path: path.join(SHOT_DIR, `${shot.route}--${shot.vp}--full.png`),
        fullPage: true,
      });
    }
    await context.close();
  }

  await browser.close();

  // 输出
  console.log('');
  console.log('布局审计报告');
  console.log('='.repeat(74));
  console.log(`基准地址：${BASE}`);
  console.log(`组合数：${VIEWPORTS.length} 宽度 × ${ROUTES.length} 路由 = ${report.length}`);
  console.log('');

  const byVp = new Map();
  for (const r of report) {
    if (!byVp.has(r.vp)) byVp.set(r.vp, []);
    byVp.get(r.vp).push(r);
  }

  for (const [vpName, rows] of byVp) {
    const worst = Math.max(...rows.map((r) => r.overflowX));
    const flag = worst > 0 ? '✗' : '✓';
    console.log(
      `${flag} ${vpName.padEnd(10)} 最大横向溢出 ${String(worst).padStart(4)}px   ` +
        rows.map((r) => `${r.route}:${r.overflowX > 0 ? r.overflowX : 'ok'}`).join('  ')
    );
  }

  console.log('');
  if (failures.length === 0) {
    console.log('✓ 全部通过：无横向滚动，无渲染失败');
  } else {
    console.log(`✗ 发现 ${failures.length} 个问题：`);
    for (const f of failures) {
      console.log(`  · [${f.vp}] ${f.route} — ${f.kind}: ${f.detail}`);
      if (f.offenders) {
        for (const o of f.offenders.slice(0, 5)) {
          console.log(
            `      <${o.tag} class="${o.cls}"> left=${o.left} right=${o.right} "${o.text}"`
          );
        }
      }
    }
  }
  console.log('');
  console.log(`截图目录：${SHOT_DIR}`);
  console.log('');
}

main().catch((err) => {
  console.error('审计失败：', err);
  process.exit(1);
});
