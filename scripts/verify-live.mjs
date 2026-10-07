/**
 * verify-live.mjs — 线上发布校验
 * 用真实浏览器渲染线上页面，确认内容正确、无横向溢出。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(path.resolve(__dirname, '..'), '.audit-live');

const URLS = process.argv.slice(2);
if (!URLS.length) {
  console.error('用法：node scripts/verify-live.mjs <url> [url2 ...]');
  process.exit(2);
}

const EXECUTABLES = [
  'C:/Users/shand/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, dpr: 1, mobile: false },
  { name: 'mobile', width: 390, height: 844, dpr: 2, mobile: true },
];

async function probeUrl(browser, base) {
  const out = { base, ok: false, checks: {}, shots: [] };

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dpr,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));

    try {
      await page.goto(base + '/', { waitUntil: 'load', timeout: 45000 });
      await page.waitForSelector('.hero', { timeout: 20000 });
      await page.waitForTimeout(500);

      const home = await page.evaluate(() => {
        const t = (s) => document.querySelector(s)?.textContent?.trim() || '';
        return {
          issue: t('.hero-issue'),
          date: t('.hero-date'),
          theme: t('.hero-theme'),
          stats: t('.hero-stats'),
          indexWords: [...document.querySelectorAll('.word-index-item')].map((e) =>
            e.textContent.trim()
          ),
          cards: document.querySelectorAll('.word-card').length,
          firstWord: t('.wc-word'),
          firstGloss: t('.wc-gloss'),
          firstMemory: t('.wc-memory-text').slice(0, 40),
          overflowX: document.documentElement.scrollWidth - window.innerWidth,
          title: document.title,
        };
      });

      if (vp.name === 'desktop') {
        out.checks.home = home;

        // 归档
        await page.goto(base + '/#/archive', { waitUntil: 'load' });
        await page.waitForSelector('.archive-row', { timeout: 15000 });
        out.checks.archiveRows = await page.evaluate(
          () => document.querySelectorAll('.archive-row').length
        );

        // 搜索
        await page.goto(base + '/#/search?q=risk', { waitUntil: 'load' });
        await page.waitForSelector('.result-item', { timeout: 15000 });
        out.checks.searchResults = await page.evaluate(
          () => document.querySelectorAll('.result-item').length
        );

        // 分类
        await page.goto(base + '/#/ai', { waitUntil: 'load' });
        await page.waitForSelector('.cat-group', { timeout: 15000 });
        out.checks.aiGroups = await page.evaluate(
          () => document.querySelectorAll('.cat-group').length
        );

        // 历史期（双期文件）
        await page.goto(base + '/#/issue/2026-09-11', { waitUntil: 'load' });
        await page.waitForSelector('.hero', { timeout: 15000 });
        out.checks.issue0911 = await page.evaluate(() => ({
          issue: document.querySelector('.hero-issue')?.textContent?.trim(),
          cards: document.querySelectorAll('.word-card').length,
        }));
      }

      if (vp.name === 'mobile') {
        out.checks.mobileOverflowX = home.overflowX;
        out.checks.mobileCards = home.cards;
      }

      const shot = path.join(OUT, `${new URL(base).hostname.slice(0, 12)}--${vp.name}.png`);
      await page.screenshot({ path: shot, fullPage: false });
      out.shots.push(shot);

      if (errors.length) out.checks[`${vp.name}Errors`] = errors.slice(0, 3);
    } catch (err) {
      out.checks[`${vp.name}Error`] = err.message.split('\n')[0];
    }

    await ctx.close();
  }

  out.ok =
    !!out.checks.home &&
    out.checks.home.cards > 0 &&
    out.checks.mobileOverflowX === 0 &&
    !out.checks.desktopError;

  return out;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: EXECUTABLES.find((p) => fs.existsSync(p)),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const results = [];
  for (const u of URLS) results.push(await probeUrl(browser, u));
  await browser.close();

  console.log('');
  console.log('线上发布校验');
  console.log('='.repeat(70));
  for (const r of results) {
    console.log('');
    console.log(`${r.ok ? '✓' : '✗'}  ${r.base}`);
    const h = r.checks.home;
    if (h) {
      console.log(`     标题     ${h.title}`);
      console.log(`     期号     ${h.issue}   ${h.date}`);
      console.log(`     主题     ${h.theme}`);
      console.log(`     统计     ${h.stats}`);
      console.log(`     词卡数   ${h.cards}`);
      console.log(`     首词     ${h.firstWord} — ${h.firstGloss}`);
      console.log(`     Memory   ${h.firstMemory}…`);
      console.log(`     索引     ${h.indexWords.join(' / ')}`);
    }
    console.log(`     归档行   ${r.checks.archiveRows ?? '-'}`);
    console.log(`     搜索risk ${r.checks.searchResults ?? '-'} 条`);
    console.log(`     AI 分组  ${r.checks.aiGroups ?? '-'}`);
    console.log(
      `     09-11    ${r.checks.issue0911 ? r.checks.issue0911.issue + ' / ' + r.checks.issue0911.cards + ' 词' : '-'}`
    );
    console.log(`     手机溢出 ${r.checks.mobileOverflowX ?? '-'}px`);
    if (r.checks.desktopError) console.log(`     ⚠ 渲染错误 ${r.checks.desktopError}`);
    if (r.checks.mobileError) console.log(`     ⚠ 手机错误 ${r.checks.mobileError}`);
    if (r.checks.desktopErrors) console.log(`     ⚠ JS 错误 ${r.checks.desktopErrors.join(' | ')}`);
  }
  console.log('');
  console.log(`截图：${OUT}`);
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
