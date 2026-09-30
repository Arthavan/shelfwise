import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

let logFile = null;
export function setLogFile(p) { logFile = p; }

export function log(msg, color = (s) => s) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
  console.log(color(line));
  if (logFile) fs.appendFileSync(logFile, line + '\n');
}

export function readJSON(p, fallback = undefined) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Cannot read JSON ${p}: ${e.message}`);
  }
}

export function writeJSON(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
}

export const exists = (p) => fs.existsSync(p);

/** Run a shell command. Resolves {code, out} (stdout+stderr interleaved, tail-capped). Never rejects. */
export function sh(cmd, { cwd, env, timeoutMin = 20, quiet = true, maxBuf = 400_000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, { cwd, env: { ...process.env, ...env }, shell: '/bin/bash', detached: true });
    let out = '';
    const onData = (d) => {
      out += d.toString();
      if (out.length > maxBuf) out = out.slice(-maxBuf);
      if (!quiet) process.stdout.write(d);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    const timer = setTimeout(() => {
      out += `\n[app-pipeline] command timed out after ${timeoutMin} min: ${cmd}\n`;
      try { process.kill(-child.pid, 'SIGKILL'); } catch {}
    }, timeoutMin * 60_000);
    child.on('close', (code) => { clearTimeout(timer); resolve({ code: code ?? 1, out }); });
    child.on('error', (e) => { clearTimeout(timer); resolve({ code: 1, out: out + String(e) }); });
  });
}

export const tail = (s, n = 120) => s.split('\n').slice(-n).join('\n');

export function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'app';
}

/** Minimal glob -> RegExp supporting **, *, ? */
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') { re += '.*'; i++; if (glob[i + 1] === '/') i++; }
      else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

/** True if two file/glob lists might touch the same path. Conservative: shared literal prefix before a wildcard counts. */
export function filesOverlap(a = [], b = []) {
  const stem = (g) => g.split(/[*?]/)[0];
  for (const x of a) for (const y of b) {
    if (x === y) return true;
    const sx = stem(x), sy = stem(y);
    const wx = sx !== x, wy = sy !== y;
    if (wx && y.startsWith(sx)) return true;
    if (wy && x.startsWith(sy)) return true;
    if (wx && wy && (sx.startsWith(sy) || sy.startsWith(sx))) return true;
  }
  return false;
}
