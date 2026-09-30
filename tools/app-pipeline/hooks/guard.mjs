#!/usr/bin/env node
// PreToolUse hook: enforces per-role write rules for app-pipeline agents.
// Inactive unless APP_PIPELINE_ROLE is set, so normal Claude Code sessions are unaffected.
import path from 'node:path';

const role = process.env.APP_PIPELINE_ROLE;
if (!role) process.exit(0);

let input = '';
for await (const chunk of process.stdin) input += chunk;
let evt;
try { evt = JSON.parse(input); } catch { process.exit(0); }

const root = process.env.CLAUDE_PROJECT_DIR || evt.cwd || process.cwd();
const tool = evt.tool_name;
const ti = evt.tool_input || {};

const deny = (why) => { process.stderr.write(`Blocked by app-pipeline (${role}): ${why}`); process.exit(2); };
const glob = (g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\/?/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*') + '$');
const any = (rel, globs) => globs.some((g) => glob(g).test(rel));

const KIT = ['tools/app-pipeline/**', '.claude/**'];
const BUILD_PROTECT = [...KIT, 'tests/**', 'docs/pipeline/**', 'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'playwright.config.*'];
const rules = {
  builder: { protect: BUILD_PROTECT },
  fixer: { protect: BUILD_PROTECT },
  polisher: { protect: BUILD_PROTECT },
  'test-author': { only: ['tests/**'] },
  'spec-critic': { only: ['docs/pipeline/**'] },
  'visual-reviewer': { only: ['docs/pipeline/**', '.app-pipeline/**', 'tests/visual/**', '/tmp/**'] },
  'code-reviewer': { only: ['docs/pipeline/**'] },
  'product-analyst': { only: ['docs/pipeline/**'] },
  architect: { only: ['docs/pipeline/**'] },
  designer: { only: ['docs/pipeline/**'] },
  planner: { only: ['docs/pipeline/**'] },
  scaffolder: { protect: KIT },
  'release-manager': { protect: [...KIT, 'src/**', 'app/**', 'tests/**', 'prisma/**'] },
};
const r = rules[role] || { protect: KIT };

if (['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
  const fp = ti.file_path || ti.notebook_path;
  if (fp) {
    const abs = path.resolve(root, fp);
    const rel = path.relative(root, abs);
    if (rel.startsWith('..')) {
      if (abs.startsWith('/tmp/') || abs.startsWith(process.env.TMPDIR || '/tmp/')) process.exit(0); // scratch space is fine
      deny(`${fp} is outside the project`);
    }
    if (r.only && !any(rel, r.only)) deny(`this role may only write ${r.only.join(', ')}; not ${rel}`);
    if (r.protect && any(rel, r.protect)) deny(`${rel} is owned by another stage. Work around it in your own files and mention it in your final message.`);
  }
}

if (tool === 'Bash') {
  const cmd = String(ti.command || '');
  if (/\bgit\s+(push|commit|checkout|switch|reset|rebase|merge|worktree|stash|clean|restore)\b/.test(cmd) || /\bgit\s+branch\s+-[dD]\b/.test(cmd)) {
    deny('git state is managed by the orchestrator; do not run git commands that change branches, history or the working tree.');
  }
  if (/\brm\s+-[a-z]*r[a-z]*f?\s+(\/|~|\$HOME|\.git\b|\.\s*$|\*\s*$)/.test(cmd)) deny('refusing a destructive rm.');
  if (['builder', 'fixer', 'polisher'].includes(role) && /\b(npm\s+(i|install|add)\s+[^-\s]|pnpm\s+add|yarn\s+add|bun\s+add)/.test(cmd)) {
    deny('adding dependencies is not allowed during parallel building. Use what is installed, or implement it yourself.');
  }
}
process.exit(0);
