#!/usr/bin/env node
// Screenshot helper for the visual reviewer.
// Usage: node tools/app-pipeline/lib/capture.mjs --out <dir> --routes /,/projects [--base http://localhost:3000] [--start]
// Captures every route at desktop (1440x900) and mobile (390x844), light and dark.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
    return acc;
  }, []),
);
const root = process.cwd();
const commands = JSON.parse(fs.readFileSync(path.join(root, 'docs/pipeline/commands.json'), 'utf8'));
const port = commands.port || 3000;
const base = args.base || `http://localhost:${port}`;
const out = path.resolve(args.out || '.app-pipeline/screens');
const routes = String(args.routes || '/').split(',').map((r) => r.trim()).filter(Boolean);
fs.mkdirSync(out, { recursive: true });

const require = createRequire(path.join(root, 'package.json'));
let chromium;
try { ({ chromium } = require('@playwright/test')); }
catch { ({ chromium } = require('playwright')); }

async function up() {
  try { const r = await fetch(base); return r.status < 500; } catch { return false; }
}

let server;
if (args.start && !(await up())) {
  console.log(`building and starting app on ${base} ...`);
  server = spawn(`${commands.build} && ${commands.start}`, { cwd: root, shell: '/bin/bash', detached: true, stdio: 'ignore', env: { ...process.env, PORT: String(port) } });
  const deadline = Date.now() + 10 * 60_000;
  while (!(await up())) {
    if (Date.now() > deadline) { console.error('server did not start'); process.exit(1); }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

const browser = await chromium.launch();
const shots = [];
try {
  for (const [vp, size] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: size, colorScheme: theme, deviceScaleFactor: vp === 'mobile' ? 2 : 1 });
      await context.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
      const page = await context.newPage();
      for (const r of routes) {
        const name = `${(r.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-') || 'home')}-${vp}-${theme}.png`;
        try {
          await page.goto(base + r, { waitUntil: 'networkidle', timeout: 45_000 });
          await page.waitForTimeout(400);
          await page.screenshot({ path: path.join(out, name), fullPage: true });
          shots.push(name);
        } catch (e) {
          console.error(`failed ${r} ${vp} ${theme}: ${e.message.split('\n')[0]}`);
        }
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  if (server) { try { process.kill(-server.pid, 'SIGKILL'); } catch {} }
}
console.log(`captured ${shots.length} screenshots in ${out}`);
for (const s of shots) console.log(path.join(out, s));
