import fs from 'node:fs';
import path from 'node:path';
import { readJSON, exists, filesOverlap } from './util.mjs';

// Each validator returns a list of problems (empty = valid).

export function validateSpec(dir) {
  const p = [];
  if (!exists(path.join(dir, 'SPEC.md'))) p.push('SPEC.md is missing');
  let s;
  try { s = readJSON(path.join(dir, 'spec.json')); } catch (e) { return [...p, e.message]; }
  for (const k of ['name', 'slug', 'summary', 'features', 'acceptance_criteria', 'screens']) if (!s[k]) p.push(`spec.json: missing "${k}"`);
  if (p.length) return p;
  if (!Array.isArray(s.features) || s.features.length === 0) p.push('spec.json: no features');
  const acs = s.acceptance_criteria || [];
  if (acs.length < 3) p.push('spec.json: fewer than 3 acceptance criteria');
  const ids = new Set();
  for (const a of acs) {
    if (!/^AC-\d+$/.test(a.id || '')) p.push(`bad AC id "${a.id}" (use AC-<n>)`);
    if (ids.has(a.id)) p.push(`duplicate AC id ${a.id}`);
    ids.add(a.id);
    if (!a.then) p.push(`${a.id}: missing "then"`);
  }
  for (const f of s.features) {
    if (f.priority === 'must' && !acs.some((a) => a.feature === f.id)) p.push(`must-have feature ${f.id} has no acceptance criteria`);
  }
  const text = JSON.stringify(s) + fs.readFileSync(path.join(dir, 'SPEC.md'), 'utf8');
  if (/\bTBD\b|\bTODO\b/.test(text)) p.push('spec contains TBD/TODO; decide and record assumptions instead');
  return p;
}

export function specIds(dir) {
  return readJSON(path.join(dir, 'spec.json')).acceptance_criteria.map((a) => a.id);
}

export function validateCritique(dir) {
  try {
    const c = readJSON(path.join(dir, 'critique.json'));
    if (typeof c.score !== 'number') return ['critique.json: score must be a number'];
    if (!Array.isArray(c.issues)) return ['critique.json: issues must be an array'];
    return [];
  } catch (e) { return [e.message]; }
}

export function validateArchitecture(dir) {
  const p = [];
  if (!exists(path.join(dir, 'ARCHITECTURE.md'))) p.push('ARCHITECTURE.md is missing');
  let a;
  try { a = readJSON(path.join(dir, 'architecture.json')); } catch (e) { return [...p, e.message]; }
  if (!Array.isArray(a.routes) || !a.routes.length) p.push('architecture.json: routes missing');
  const map = a.ac_map || {};
  for (const id of specIds(dir)) if (!map[id]) p.push(`architecture.json ac_map: ${id} not mapped`);
  return p;
}

export function validateDesign(dir) {
  const p = path.join(dir, 'DESIGN.md');
  if (!exists(p)) return ['DESIGN.md is missing'];
  const t = fs.readFileSync(p, 'utf8');
  const probs = [];
  if (!/```css/.test(t)) probs.push('DESIGN.md: no ```css token block');
  if (!/\.dark|\[data-theme|prefers-color-scheme/.test(t)) probs.push('DESIGN.md: no dark theme tokens');
  return probs;
}

export function validateCommands(dir) {
  try {
    const c = readJSON(path.join(dir, 'commands.json'));
    const missing = ['install', 'lint', 'typecheck', 'build', 'e2e', 'e2e_list', 'start', 'port', 'testDir'].filter((k) => c[k] === undefined);
    return missing.length ? [`commands.json missing: ${missing.join(', ')}`] : [];
  } catch (e) { return [e.message]; }
}

export function validateTasks(dir) {
  const p = [];
  let t;
  try { t = readJSON(path.join(dir, 'tasks.json')); } catch (e) { return [e.message]; }
  const tasks = t.tasks || [];
  if (!tasks.length) return ['tasks.json: no tasks'];
  const ids = new Set(tasks.map((x) => x.id));
  if (ids.size !== tasks.length) p.push('tasks.json: duplicate task ids');
  for (const x of tasks) {
    for (const d of x.depends_on || []) if (!ids.has(d)) p.push(`${x.id} depends on unknown ${d}`);
    if (!Array.isArray(x.files) || !x.files.length) p.push(`${x.id}: no files listed`);
  }
  if (p.length) return p;
  try { topoLevels(tasks); } catch (e) { p.push(e.message); }
  const covered = new Set(tasks.flatMap((x) => x.acs || []));
  for (const id of specIds(dir)) if (!covered.has(id)) p.push(`${id} is not covered by any task`);
  return p;
}

/** Dependency levels; throws on cycles. */
export function topoLevels(tasks) {
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const level = {};
  const visiting = new Set();
  const visit = (id) => {
    if (level[id] !== undefined) return level[id];
    if (visiting.has(id)) throw new Error(`tasks.json: dependency cycle at ${id}`);
    visiting.add(id);
    const deps = byId[id].depends_on || [];
    level[id] = deps.length ? 1 + Math.max(...deps.map(visit)) : 0;
    visiting.delete(id);
    return level[id];
  };
  tasks.forEach((t) => visit(t.id));
  return level;
}

/**
 * Turns tasks into ordered batches. Tasks in one batch have all deps satisfied by earlier batches
 * and don't overlap in files, so they can run in parallel worktrees.
 */
export function planBatches(tasks, maxParallel) {
  const level = topoLevels(tasks);
  const maxLevel = Math.max(...Object.values(level));
  const batches = [];
  for (let l = 0; l <= maxLevel; l++) {
    let pending = tasks.filter((t) => level[t.id] === l);
    while (pending.length) {
      const batch = [];
      const rest = [];
      for (const t of pending) {
        if (batch.length < maxParallel && !batch.some((b) => filesOverlap(b.files, t.files))) batch.push(t);
        else rest.push(t);
      }
      batches.push(batch.map((t) => t.id));
      pending = rest;
    }
  }
  return batches;
}

export function testCoverage(root, dir, testDir) {
  const ids = specIds(dir);
  const abs = path.join(root, testDir);
  if (!exists(abs)) return { missing: ids };
  let text = '';
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|js|mjs|tsx)$/.test(e.name)) text += fs.readFileSync(p, 'utf8') + '\n';
    }
  };
  walk(abs);
  return { missing: ids.filter((id) => !new RegExp(`${id}(?!\\d)`).test(text)) };
}

export function readScored(file, kind) {
  try {
    const r = readJSON(file);
    if (kind === 'visual') {
      if (typeof r.score !== 'number' || !Array.isArray(r.issues)) return { error: 'visual-review.json must have numeric score and issues array' };
    } else if (!Array.isArray(r.findings)) return { error: 'review.json must have a findings array' };
    return { data: r };
  } catch (e) { return { error: e.message }; }
}
