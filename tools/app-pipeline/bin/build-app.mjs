#!/usr/bin/env node
// app-pipeline orchestrator: one prompt in, a built, tested, reviewed app out.
// Plain code drives the stages; Claude Code agents fill in files; gates decide when a stage is done.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAgent } from '../lib/claude.mjs';
import { C, log, readJSON, writeJSON, exists, sh, tail, slugify, setLogFile } from '../lib/util.mjs';
import * as V from '../lib/validate.mjs';

const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STAGES = ['preflight', 'spec', 'architecture', 'design', 'scaffold', 'plan', 'tests', 'build', 'qa', 'visual', 'review', 'release', 'ship'];

// ---------- args ----------
const argv = process.argv.slice(2);
const opt = { prompt: [], parallel: null, budget: null, from: null, resume: false, skipVisual: false, deploy: null, pr: false, branch: null };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--resume') opt.resume = true;
  else if (a === '--from') { opt.from = argv[++i]; opt.resume = true; }
  else if (a === '--budget') opt.budget = Number(argv[++i]);
  else if (a === '--parallel') opt.parallel = Number(argv[++i]);
  else if (a === '--skip-visual') opt.skipVisual = true;
  else if (a === '--deploy') opt.deploy = argv[++i];
  else if (a === '--pr') opt.pr = true;
  else if (a === '--branch') opt.branch = argv[++i];
  else if (a === '--prompt-file') opt.prompt.push(fs.readFileSync(argv[++i], 'utf8'));
  else if (a === '-h' || a === '--help') { usage(); process.exit(0); }
  else opt.prompt.push(a);
}
function usage() {
  console.log(`Usage: ./build-app "<describe your app>" [options]

Options:
  --prompt-file <f>   read the app description from a file
  --resume            continue the last run where it stopped
  --from <stage>      re-run from a stage (${STAGES.join(', ')})
  --budget <usd>      overall spend cap for this run (default from pipeline.config.json)
  --parallel <n>      max builders working at once (default 4)
  --skip-visual       skip the screenshot-based visual QA loop
  --deploy vercel     deploy after release (needs VERCEL_TOKEN)
  --pr                push the branch and open a pull request (needs gh)
  --branch <name>     branch to build on (default app/<slug>)`);
}

// ---------- context ----------
const rootRes = await sh('git rev-parse --show-toplevel');
if (rootRes.code !== 0) { console.error('Run this inside a git repository.'); process.exit(1); }
const root = rootRes.out.trim();
const stateDir = path.join(root, '.app-pipeline');
const docs = path.join(root, 'docs/pipeline');
const statePath = path.join(stateDir, 'run.json');
fs.mkdirSync(stateDir, { recursive: true });
setLogFile(path.join(stateDir, 'run.log'));

const config = readJSON(path.join(KIT, 'pipeline.config.json'));
let state = opt.resume && exists(statePath) ? readJSON(statePath) : null;
if (opt.resume && !state) { console.error('Nothing to resume.'); process.exit(1); }
if (!state) {
  const prompt = opt.prompt.join(' ').trim();
  if (!prompt) { usage(); process.exit(1); }
  state = { prompt, started: new Date().toISOString(), done: {}, costs: [], tasks: {}, results: {}, logId: 0 };
}
if (opt.budget) state.budget = opt.budget;
if (opt.parallel) state.parallel = opt.parallel;
if (opt.from) {
  const i = STAGES.indexOf(opt.from);
  if (i < 0) { console.error(`Unknown stage ${opt.from}`); process.exit(1); }
  for (const s of STAGES.slice(i)) delete state.done[s];
  if (i <= STAGES.indexOf('build')) state.tasks = {};
}
const save = () => writeJSON(statePath, state);
const budget = () => state.budget ?? config.limits.runBudgetUsd;
const L = config.limits;

class BudgetError extends Error {}
const ctx = {
  root, config, stateDir,
  totalCost: () => state.costs.reduce((s, c) => s + c.usd, 0),
  budgetLeft: () => budget() - ctx.totalCost(),
  addCost: (usd, label) => { state.costs.push({ label, usd }); save(); },
  nextLogId: () => { state.logId = (state.logId || 0) + 1; return state.logId; },
};
const checkBudget = () => { if (ctx.budgetLeft() <= 0.5) throw new BudgetError(`Budget of $${budget()} reached.`); };

const commands = () => readJSON(path.join(docs, 'commands.json'));
const git = (cmd, cwd = root) => sh(`git ${cmd}`, { cwd });
async function commit(msg, cwd = root) {
  await git('add -A', cwd);
  const d = await git('diff --cached --quiet', cwd);
  if (d.code !== 0) await git(`-c user.name="${process.env.GIT_AUTHOR_NAME || 'app-pipeline'}" -c user.email="${process.env.GIT_AUTHOR_EMAIL || 'app-pipeline@localhost'}" commit -q --no-verify -m ${JSON.stringify(msg)}`, cwd);
}

const FILES = `Pipeline files live in docs/pipeline/ (SPEC.md, spec.json, ARCHITECTURE.md, architecture.json, DESIGN.md, commands.json, tasks.json).`;

/** Run an agent, then a gate; on gate problems, re-run the agent with the problems (escalating model on the last try). */
async function agentWithGate(role, label, prompt, gate, { attempts = 3, cwd = root, env } = {}) {
  let problems = [];
  for (let i = 1; i <= attempts; i++) {
    checkBudget();
    const p = i === 1 ? prompt : `${prompt}\n\n## Your previous attempt did not pass the automatic gate\nFix every item below, keep what already works:\n${problems.map((x) => `- ${x}`).join('\n')}`;
    const r = await runAgent({ ctx, role, label: i === 1 ? label : `${label}-retry${i - 1}`, prompt: p, cwd, env, escalate: i === attempts && i > 1 });
    problems = await gate(r);
    if (!problems.length) { log(`gate passed: ${label}`, C.green); return true; }
    log(`gate failed: ${label}\n  - ${problems.slice(0, 8).join('\n  - ')}`, C.yellow);
  }
  throw new Error(`${label} could not pass its gate after ${attempts} attempts:\n- ${problems.join('\n- ')}`);
}

/** Run named checks from commands.json. Returns [{name, ok, out}]. e2e runs only if build passes. */
async function runChecks(names, cwd = root, env = {}) {
  const cmds = commands();
  const results = [];
  for (const n of names) {
    if (!cmds[n]) continue;
    if (n === 'e2e' && results.some((r) => r.name === 'build' && !r.ok)) { results.push({ name: n, ok: false, out: 'skipped because build failed' }); continue; }
    log(`  check ${n}: ${C.dim(cmds[n])}`);
    const r = await sh(cmds[n], { cwd, env: { CI: '1', ...env }, timeoutMin: L.commandTimeoutMin });
    results.push({ name: n, ok: r.code === 0, out: r.out });
    log(`  ${r.code === 0 ? '✓' : '✗'} ${n}`, r.code === 0 ? C.green : C.red);
  }
  return results;
}
const failuresText = (res, lines = 150) => res.filter((r) => !r.ok).map((r) => `### ${r.name} failed\n\`\`\`\n${tail(r.out, r.name === 'e2e' ? lines + 100 : lines)}\n\`\`\``).join('\n\n');

// ---------- stages ----------
const stage = {};

stage.preflight = async () => {
  const v = await sh(`${config.claudeBin} --version`);
  if (v.code !== 0) throw new Error('Claude Code CLI not found. Install it and sign in: https://code.claude.com');
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 20) throw new Error(`Node 20+ required (found ${process.versions.node}).`);
  const slug = slugify(state.prompt.split(/[.\n]/)[0]);
  state.branch = opt.branch || state.branch || `app/${slug}-${Date.now().toString(36).slice(-4)}`;
  const cur = (await git('rev-parse --abbrev-ref HEAD')).out.trim();
  if (cur !== state.branch) {
    const r = await git(`checkout -q -b ${state.branch}`);
    if (r.code !== 0) throw new Error(`Could not create branch ${state.branch}: ${r.out}`);
  }
  const gi = path.join(root, '.gitignore');
  const g = exists(gi) ? fs.readFileSync(gi, 'utf8') : '';
  if (!g.includes('.app-pipeline')) fs.appendFileSync(gi, `${g && !g.endsWith('\n') ? '\n' : ''}.app-pipeline/\n`);
  fs.mkdirSync(docs, { recursive: true });
  fs.writeFileSync(path.join(docs, 'PROMPT.md'), `# Original prompt\n\n${state.prompt}\n`);
  await commit('app-pipeline: start run');
  state.baseCommit = (await git('rev-parse HEAD')).out.trim();
};

stage.spec = async () => {
  let feedback = '';
  for (let round = 0; round <= L.specRounds; round++) {
    await agentWithGate('product-analyst', `spec-r${round}`,
      `Original prompt from the user:\n"""\n${state.prompt}\n"""\n\nWrite docs/pipeline/SPEC.md and docs/pipeline/spec.json.${feedback}`,
      async () => V.validateSpec(docs));
    if (round === L.specRounds) break;
    await agentWithGate('spec-critic', `spec-critic-r${round}`,
      `Original prompt:\n"""\n${state.prompt}\n"""\n\nReview docs/pipeline/SPEC.md and docs/pipeline/spec.json. Write docs/pipeline/critique.json.`,
      async () => V.validateCritique(docs), { attempts: 2 });
    const c = readJSON(path.join(docs, 'critique.json'));
    state.results.specScore = c.score;
    const blocking = c.issues.filter((i) => i.severity !== 'minor');
    log(`spec score ${c.score}/10, ${blocking.length} blocking/major issues`);
    if (c.score >= L.specPassScore && !c.issues.some((i) => i.severity === 'blocking')) break;
    feedback = `\n\n## Critic feedback to address (the spec already exists; revise it)\n${c.issues.map((i) => `- [${i.severity}] ${i.where}: ${i.problem} → ${i.fix}`).join('\n')}`;
  }
  await commit('app-pipeline: spec');
};

stage.architecture = async () => {
  await agentWithGate('architect', 'architecture',
    `Read docs/pipeline/SPEC.md and docs/pipeline/spec.json. Write docs/pipeline/ARCHITECTURE.md and docs/pipeline/architecture.json.`,
    async () => V.validateArchitecture(docs));
  await commit('app-pipeline: architecture');
};

stage.design = async () => {
  await agentWithGate('designer', 'design',
    `Read docs/pipeline/SPEC.md, spec.json, ARCHITECTURE.md and architecture.json. Write docs/pipeline/DESIGN.md.`,
    async () => V.validateDesign(docs));
  await commit('app-pipeline: design');
};

stage.scaffold = async () => {
  await agentWithGate('scaffolder', 'scaffold',
    `${FILES}\nScaffold the project in the repository root (${root}) and write docs/pipeline/commands.json. Playwright's config must read the port from process.env.PORT (default ${3000}) for both webServer and baseURL so several copies can run side by side.`,
    async () => {
      const p = V.validateCommands(docs);
      if (p.length) return p;
      const res = await runChecks(['install', 'lint', 'typecheck', 'build', 'test', 'e2e']);
      return res.filter((r) => !r.ok).map((r) => `${r.name} failed:\n${tail(r.out, 40)}`);
    });
  await commit('app-pipeline: scaffold');
};

stage.plan = async () => {
  await agentWithGate('planner', 'plan',
    `${FILES}\nThe skeleton is in place and dependencies are installed. Write docs/pipeline/tasks.json. Up to ${state.parallel || L.parallelBuilders} builders work in parallel.`,
    async () => V.validateTasks(docs));
  await commit('app-pipeline: plan');
};

stage.tests = async () => {
  const cmds = commands();
  await agentWithGate('test-author', 'tests',
    `${FILES}\nWrite the Playwright acceptance tests in ${cmds.testDir}. Every acceptance criterion id in spec.json must appear in a test title.`,
    async () => {
      const { missing } = V.testCoverage(root, docs, cmds.testDir);
      const p = missing.length ? [`no test title mentions: ${missing.join(', ')}`] : [];
      const l = await sh(cmds.e2e_list, { cwd: root, timeoutMin: 5 });
      if (l.code !== 0) p.push(`e2e_list failed:\n${tail(l.out, 40)}`);
      return p;
    });
  await commit('app-pipeline: acceptance tests');
};

async function buildTask(task, cwd, env, attempt, extra = '') {
  const t = readJSON(path.join(docs, 'tasks.json')).tasks.find((x) => x.id === task);
  const grep = (t.acs || []).join('|');
  const prompt = `${FILES}\n\n## Your task\n\`\`\`json\n${JSON.stringify(t, null, 2)}\n\`\`\`\n\nAcceptance tests for this task: \`npx playwright test -g "${grep}"\`${env?.PORT ? ` (use PORT=${env.PORT}; another builder may be using the default port)` : ''}.${extra}`;
  const r = await runAgent({ ctx, role: 'builder', label: `build-${task}${attempt > 1 ? '-a' + attempt : ''}`, prompt, cwd, env, escalate: attempt >= L.taskAttempts });
  const tc = await sh(commands().typecheck, { cwd, timeoutMin: 10 });
  return { ok: r.ok && tc.code === 0, typeErrors: tc.code === 0 ? '' : tail(tc.out, 60) };
}

async function runTaskWithRetries(id, cwd, env) {
  let extra = '';
  for (let a = 1; a <= L.taskAttempts; a++) {
    checkBudget();
    const r = await buildTask(id, cwd, env, a, extra);
    if (r.ok) return true;
    extra = `\n\n## A previous attempt left the project failing typecheck\nContinue from the current state of the files and fix:\n\`\`\`\n${r.typeErrors}\n\`\`\``;
  }
  return false;
}

stage.build = async () => {
  const tasks = readJSON(path.join(docs, 'tasks.json')).tasks;
  const batches = V.planBatches(tasks, state.parallel || L.parallelBuilders);
  log(`build plan: ${batches.map((b) => `[${b.join(' ')}]`).join(' → ')}`);
  // Worktrees live next to the repo (same filesystem, so node_modules can be hard-linked, and outside the
  // repo so the app's own lint/typecheck/test globs never see them).
  const wtBase = path.join(path.dirname(root), `.${path.basename(root)}-app-pipeline-wt`);
  for (const batch of batches) {
    const todo = batch.filter((id) => state.tasks[id]?.status !== 'done');
    if (!todo.length) continue;
    checkBudget();
    if (todo.length === 1) {
      const ok = await runTaskWithRetries(todo[0], root, {});
      state.tasks[todo[0]] = { status: ok ? 'done' : 'failed' };
      await commit(`app-pipeline: ${todo[0]}${ok ? '' : ' (incomplete)'}`);
      save();
      continue;
    }
    // Parallel: one git worktree per task, merged back in order.
    const head = (await git('rev-parse HEAD')).out.trim();
    const runs = todo.map(async (id, i) => {
      const wt = path.join(wtBase, id);
      await sh(`rm -rf "${wt}"`);
      await git(`worktree prune`);
      await git(`branch -D ap/${id}`);
      const add = await git(`worktree add -q -b ap/${id} "${wt}" ${head}`);
      if (add.code !== 0) throw new Error(`worktree add failed: ${add.out}`);
      // Share installed deps; copy untracked env files.
      if (exists(path.join(root, 'node_modules'))) {
        const cp = await sh(`cp -al "${path.join(root, 'node_modules')}" "${path.join(wt, 'node_modules')}"`, { timeoutMin: 5 });
        if (cp.code !== 0) { await sh(`rm -rf "${path.join(wt, 'node_modules')}"`); fs.symlinkSync(path.join(root, 'node_modules'), path.join(wt, 'node_modules')); }
      }
      for (const f of fs.readdirSync(root)) if (/^\.env/.test(f) && !exists(path.join(wt, f))) fs.copyFileSync(path.join(root, f), path.join(wt, f));
      const ok = await runTaskWithRetries(id, wt, { PORT: String(3100 + i) });
      await sh(`rm -rf "${path.join(wt, 'node_modules')}"`, { timeoutMin: 5 });
      await commit(`app-pipeline: ${id}${ok ? '' : ' (incomplete)'}`, wt);
      return { id, ok };
    });
    const results = await Promise.all(runs);
    const serialRetry = [];
    for (const { id, ok } of results) {
      const m = await git(`merge -q --no-ff --no-edit ap/${id}`);
      if (m.code !== 0) {
        await git('merge --abort');
        log(`merge conflict for ${id}; will rebuild it on the main tree`, C.yellow);
        serialRetry.push(id);
      } else state.tasks[id] = { status: ok ? 'done' : 'failed' };
      await git(`worktree remove --force "${path.join(wtBase, id)}"`);
      await git(`branch -D ap/${id}`);
      save();
    }
    for (const id of serialRetry) {
      const ok = await runTaskWithRetries(id, root, {});
      state.tasks[id] = { status: ok ? 'done' : 'failed' };
      await commit(`app-pipeline: ${id} (rebuilt after conflict)`);
      save();
    }
  }
  const failed = Object.entries(state.tasks).filter(([, v]) => v.status !== 'done').map(([k]) => k);
  if (failed.length) log(`tasks left incomplete: ${failed.join(', ')} (the QA loop will try to close the gap)`, C.yellow);
};

/** QA loop: all checks green or fixRounds exhausted. */
async function qaLoop(label, rounds = L.fixRounds) {
  const names = ['lint', 'typecheck', 'test', 'build', 'e2e'];
  let res = await runChecks(names);
  for (let r = 1; r <= rounds && res.some((x) => !x.ok); r++) {
    checkBudget();
    await runAgent({
      ctx, role: 'fixer', label: `${label}-fix${r}`, cwd: root, escalate: r >= 2,
      prompt: `${FILES}\n\nThe project's automated checks are failing. Find the root cause of each failure and fix the application code so every check passes. Do not weaken or edit tests; if a test contradicts the spec, follow the spec and explain.\n\n${failuresText(res)}`,
    });
    await commit(`app-pipeline: ${label} fix round ${r}`);
    res = await runChecks(names);
  }
  const summary = Object.fromEntries(res.map((x) => [x.name, x.ok]));
  const e2e = res.find((x) => x.name === 'e2e');
  const m = e2e?.out.match(/(\d+) passed/); const f = e2e?.out.match(/(\d+) failed/);
  summary.e2eCounts = { passed: m ? +m[1] : 0, failed: f ? +f[1] : 0 };
  return summary;
}

stage.qa = async () => {
  state.results.qa = await qaLoop('qa');
  log(`QA: ${JSON.stringify(state.results.qa)}`);
};

stage.visual = async () => {
  if (opt.skipVisual) { log('visual QA skipped'); return; }
  const arch = readJSON(path.join(docs, 'architecture.json'));
  const routes = arch.routes.map((r) => r.example_path || r.path).filter((p) => p && !/[\[:]/.test(p));
  for (let round = 1; round <= L.visualRounds + 1; round++) {
    checkBudget();
    const out = path.join(stateDir, 'screens', `round-${round}`);
    await agentWithGate('visual-reviewer', `visual-r${round}`,
      `${FILES}\nScreenshot directory: ${out}\nRoutes to capture: ${routes.join(',')}\nCapture with: node tools/app-pipeline/lib/capture.mjs --start --out ${out} --routes ${routes.join(',')}\nWrite docs/pipeline/visual-review.json.`,
      async () => { const r = V.readScored(path.join(docs, 'visual-review.json'), 'visual'); return r.error ? [r.error] : []; },
      { attempts: 2 });
    const vr = readJSON(path.join(docs, 'visual-review.json'));
    state.results.visualScore = vr.score;
    const serious = vr.issues.filter((i) => i.severity !== 'minor');
    log(`visual score ${vr.score}/10, ${serious.length} blocker/major issues`);
    if (exists(out)) {
      fs.mkdirSync(path.join(docs, 'screens'), { recursive: true });
      for (const f of fs.readdirSync(out)) if (/-desktop-light\.png$|-mobile-light\.png$/.test(f)) fs.copyFileSync(path.join(out, f), path.join(docs, 'screens', f));
    }
    if ((vr.score >= L.visualPassScore && !serious.length) || round > L.visualRounds) break;
    await runAgent({
      ctx, role: 'polisher', label: `polish-r${round}`, cwd: root,
      prompt: `${FILES}\n\nA design director reviewed screenshots of the app (in ${out}; open them with the Read tool). Fix every issue below in the application code, following DESIGN.md. Keep all behaviour and tests passing.\n\n${vr.issues.map((i) => `- [${i.severity}] ${i.id} ${i.route} (${i.viewport}, ${i.theme}): ${i.problem} → ${i.fix}`).join('\n')}`,
    });
    await commit(`app-pipeline: visual polish round ${round}`);
    state.results.qa = await qaLoop(`visual-r${round}-qa`, 2);
  }
  await commit('app-pipeline: visual review');
};

stage.review = async () => {
  for (let round = 1; round <= L.reviewRounds + 1; round++) {
    checkBudget();
    await agentWithGate('code-reviewer', `review-r${round}`,
      `${FILES}\nReview the changes in \`git diff ${state.baseCommit}..HEAD\` (the whole app). Write docs/pipeline/review.json.`,
      async () => { const r = V.readScored(path.join(docs, 'review.json'), 'review'); return r.error ? [r.error] : []; },
      { attempts: 2 });
    const rv = readJSON(path.join(docs, 'review.json'));
    const serious = rv.findings.filter((f) => f.severity !== 'minor');
    state.results.review = { verdict: rv.verdict, serious: serious.length, missing: rv.missing_acs || [] };
    log(`review: ${rv.verdict}, ${serious.length} blocking/major, missing ACs: ${(rv.missing_acs || []).join(', ') || 'none'}`);
    if ((rv.verdict === 'pass' && !serious.length) || round > L.reviewRounds) break;
    await runAgent({
      ctx, role: 'fixer', label: `review-fix-r${round}`, cwd: root, escalate: true,
      prompt: `${FILES}\n\nAn independent reviewer found these problems. Fix all blocking and major findings and implement any missing acceptance criteria; fix minor ones when cheap.\n\n${rv.findings.map((f) => `- [${f.severity}] ${f.id} ${f.file}:${f.line ?? ''} ${f.problem} → ${f.fix}`).join('\n')}${rv.missing_acs?.length ? `\n\nMissing acceptance criteria: ${rv.missing_acs.join(', ')}` : ''}`,
    });
    await commit(`app-pipeline: review fixes round ${round}`);
    state.results.qa = await qaLoop(`review-r${round}-qa`, 3);
  }
  await commit('app-pipeline: code review');
};

stage.release = async () => {
  const summary = {
    prompt: state.prompt, branch: state.branch, qa: state.results.qa, specScore: state.results.specScore,
    visualScore: state.results.visualScore, review: state.results.review, tasks: state.tasks,
    costUsd: +ctx.totalCost().toFixed(2), costByStage: state.costs,
  };
  await runAgent({
    ctx, role: 'release-manager', label: 'release', cwd: root,
    prompt: `${FILES}\n\nRun summary:\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\nWrite README.md, .env.example and docs/pipeline/REPORT.md.`,
  });
  await commit('app-pipeline: release docs');
  if (opt.deploy) {
    const cmd = config.deploy?.[opt.deploy];
    if (!cmd) log(`no deploy command configured for "${opt.deploy}"`, C.yellow);
    else {
      log(`deploying with ${opt.deploy} ...`);
      const r = await sh(cmd, { cwd: root, timeoutMin: 20 });
      const url = (r.out.match(/https:\/\/[^\s"']+/g) || []).pop();
      state.results.deployUrl = r.code === 0 ? url : null;
      log(r.code === 0 ? `deployed: ${url}` : `deploy failed:\n${tail(r.out, 30)}`, r.code === 0 ? C.green : C.red);
    }
  }
};

stage.ship = async () => {
  if (!opt.pr) return;
  const p = await git(`push -u origin ${state.branch}`);
  if (p.code !== 0) { log(`push failed:\n${tail(p.out, 20)}`, C.red); return; }
  const pr = await sh(`gh pr create --head ${state.branch} --title ${JSON.stringify('App: ' + state.prompt.slice(0, 60))} --body-file docs/pipeline/REPORT.md`, { cwd: root });
  state.results.prUrl = (pr.out.match(/https:\/\/\S+/) || [])[0];
  log(pr.code === 0 ? `pull request: ${state.results.prUrl}` : `gh pr create failed:\n${tail(pr.out, 20)}`, pr.code === 0 ? C.green : C.red);
};

// ---------- main ----------
log(C.bold(`app-pipeline · ${state.prompt.slice(0, 80)}${state.prompt.length > 80 ? '…' : ''}`));
log(C.dim(`repo ${root} · budget $${budget()} · spent so far $${ctx.totalCost().toFixed(2)}`));
let exitCode = 0;
try {
  for (const s of STAGES) {
    if (state.done[s]) { log(C.dim(`skip ${s} (done)`)); continue; }
    log(C.bold(`── ${s} ──`));
    state.current = s; save();
    await stage[s]();
    state.done[s] = true; save();
  }
  const q = state.results.qa || {};
  const green = ['lint', 'typecheck', 'build', 'e2e'].every((k) => q[k] !== false);
  log(C.bold('\n══ finished ══'));
  log(`branch        ${state.branch}`);
  log(`checks        ${green ? C.green('all green') : C.red('some checks still failing, see docs/pipeline/REPORT.md')}  e2e ${q.e2eCounts?.passed ?? '?'} passed / ${q.e2eCounts?.failed ?? '?'} failed`);
  if (state.results.visualScore !== undefined) log(`visual score  ${state.results.visualScore}/10`);
  if (state.results.review) log(`review        ${state.results.review.verdict}`);
  if (state.results.deployUrl) log(`deployed      ${state.results.deployUrl}`);
  if (state.results.prUrl) log(`pull request  ${state.results.prUrl}`);
  log(`cost          $${ctx.totalCost().toFixed(2)}`);
  log(`run it        ${(() => { try { const c = commands(); return `${c.install} && ${c.db_reset ? c.db_reset + ' && ' : ''}${c.dev || 'npm run dev'}`; } catch { return 'see README.md'; } })()}`);
  exitCode = green ? 0 : 2;
} catch (e) {
  save();
  log(`\n${e instanceof BudgetError ? 'Stopped' : 'Failed'} during "${state.current}": ${e.message}`, C.red);
  log(`Fix the cause if needed, then continue with: ./build-app --resume${e instanceof BudgetError ? ' --budget <higher>' : ''}`, C.yellow);
  exitCode = 1;
}
save();
process.exit(exitCode);
