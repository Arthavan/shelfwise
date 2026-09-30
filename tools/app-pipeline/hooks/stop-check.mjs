#!/usr/bin/env node
// Stop hook: a builder may not finish while the project fails typecheck.
// Blocks once (stop_hook_active prevents loops); the orchestrator's QA gate is the final authority.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const role = process.env.APP_PIPELINE_ROLE;
if (!['builder', 'fixer', 'polisher'].includes(role)) process.exit(0);

let input = '';
for await (const chunk of process.stdin) input += chunk;
let evt = {};
try { evt = JSON.parse(input); } catch {}
if (evt.stop_hook_active) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || evt.cwd || process.cwd();
let cmd = 'npx tsc --noEmit';
try { cmd = JSON.parse(fs.readFileSync(path.join(root, 'docs/pipeline/commands.json'), 'utf8')).typecheck || cmd; } catch {}
try {
  execSync(cmd, { cwd: root, stdio: 'pipe', timeout: 5 * 60_000 });
} catch (e) {
  const out = `${e.stdout || ''}${e.stderr || ''}`.split('\n').slice(-60).join('\n');
  process.stderr.write(`Typecheck fails, so you are not done yet. Fix these errors, then finish:\n${out}`);
  process.exit(2);
}
process.exit(0);
