import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { log, C } from './util.mjs';

const PREAMBLE = `You are one stage of an automated app-building pipeline running unattended. Nobody can answer questions: never ask, never wait for approval, never stop to brainstorm with a human. When something is ambiguous, pick the option a strong senior engineer would pick, note it, and continue. Complete your stage fully before finishing.`;

/**
 * Runs one headless Claude Code agent (`claude -p`) with a given agent definition, model and effort.
 * Returns { ok, text, costUsd, raw }. Never throws.
 */
export function runAgent({ ctx, role, label, prompt, cwd, escalate = false, env = {} }) {
  const cfg = ctx.config.roles[role];
  if (!cfg) throw new Error(`No role "${role}" in pipeline.config.json`);
  const agent = cfg.agent || role;
  const model = escalate && cfg.escalate ? cfg.escalate.model : cfg.model;
  const effort = escalate && cfg.escalate ? cfg.escalate.effort : cfg.effort;
  const remaining = ctx.budgetLeft();
  const budget = Math.max(0.5, Math.min(cfg.budgetUsd ?? 5, remaining));

  const args = [
    '-p',
    '--agent', agent,
    '--model', model,
    '--output-format', 'json',
    '--permission-mode', 'bypassPermissions',
    '--max-budget-usd', String(budget),
  ];
  if (effort && !/haiku/.test(model)) args.push('--effort', effort);
  const fb = ctx.config.fallbackModels?.[model];
  if (fb) args.push('--fallback-model', fb);

  const logDir = path.join(ctx.stateDir, 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `${String(ctx.nextLogId()).padStart(3, '0')}-${label}.json`);
  prompt = `${PREAMBLE}\n\n${prompt}`;
  fs.writeFileSync(logPath.replace(/\.json$/, '.prompt.md'), prompt);

  log(`▶ ${label} ${C.dim(`(${agent} · ${model}${effort ? ' · ' + effort : ''} · cap $${budget.toFixed(2)})`)}`, C.cyan);
  const started = Date.now();

  return new Promise((resolve) => {
    const child = spawn(ctx.config.claudeBin || 'claude', args, {
      cwd,
      env: {
        ...process.env,
        APP_PIPELINE_ROLE: role,
        APP_PIPELINE_ROOT: ctx.root,
        ...env,
      },
      detached: true,
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.stdin.end(prompt);
    const timer = setTimeout(() => {
      err += `\n[app-pipeline] agent timed out after ${cfg.timeoutMin} min`;
      try { process.kill(-child.pid, 'SIGKILL'); } catch {}
    }, (cfg.timeoutMin ?? 30) * 60_000);

    child.on('close', (code) => {
      clearTimeout(timer);
      let raw = null;
      try {
        const lines = out.trim().split('\n').filter(Boolean);
        raw = JSON.parse(lines[lines.length - 1]);
      } catch {}
      fs.writeFileSync(logPath, JSON.stringify({ code, raw, stdout: raw ? undefined : out.slice(-20000), stderr: err.slice(-20000) }, null, 2));
      const costUsd = raw?.total_cost_usd ?? 0;
      ctx.addCost(costUsd, label);
      const ok = code === 0 && raw && !raw.is_error;
      const mins = ((Date.now() - started) / 60000).toFixed(1);
      log(`${ok ? '✓' : '✗'} ${label} ${C.dim(`${mins} min · $${costUsd.toFixed(2)} · total $${ctx.totalCost().toFixed(2)}`)}${ok ? '' : C.red(' ' + (raw?.subtype || `exit ${code}`) + ' ' + err.trim().split('\n').slice(-2).join(' ').slice(0, 300))}`, ok ? C.green : C.red);
      resolve({ ok, text: raw?.result ?? '', costUsd, raw, logPath });
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      log(`✗ ${label}: could not start ${ctx.config.claudeBin}: ${e.message}`, C.red);
      resolve({ ok: false, text: '', costUsd: 0, raw: null, logPath });
    });
  });
}
