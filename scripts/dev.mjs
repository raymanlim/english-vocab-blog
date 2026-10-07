#!/usr/bin/env node
/**
 * dev.mjs — 开发模式启动器
 *  1. 先执行一次 sync
 *  2. 监听内容源目录，Markdown 变化时自动重新 sync
 *  3. 启动 vite dev server
 *
 * 用法：npm run dev
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SYNC = path.join(__dirname, 'sync.mjs');

const SOURCE_DIR =
  process.env.VOCAB_SOURCE ||
  'D:\\Obsidian\\obsidian_valut\\pinghe\\english words';

const NODE = process.execPath;

function runSync(reason) {
  return new Promise((resolve) => {
    const label = reason ? `（${reason}）` : '';
    console.log(`\n🔄  同步内容${label}…`);
    const child = spawn(NODE, [SYNC], { cwd: ROOT, stdio: 'inherit' });
    child.on('exit', (code) => resolve(code === 0));
  });
}

async function main() {
  const ok = await runSync();
  if (!ok) {
    console.warn('\n⚠  首次同步未成功，仍将继续启动开发服务器。\n');
  }

  // 监听源目录
  if (fs.existsSync(SOURCE_DIR)) {
    let timer = null;
    try {
      fs.watch(SOURCE_DIR, { persistent: true }, (_event, filename) => {
        if (!filename || !filename.endsWith('.md')) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          runSync(filename);
        }, 350);
      });
      console.log(`👀  已监听内容源：${SOURCE_DIR}`);
      console.log('    Markdown 变动后会自动重新同步。\n');
    } catch (err) {
      console.warn(`⚠  无法监听源目录：${err.message}\n`);
    }
  } else {
    console.warn(`⚠  源目录不存在，跳过监听：${SOURCE_DIR}\n`);
  }

  // 启动 vite
  const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const vite = spawn(NODE, [viteBin], { cwd: ROOT, stdio: 'inherit' });

  const shutdown = () => {
    vite.kill();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
