#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildFirstUsefulWin, parseArgs, renderMarkdown } = require('./render-first-useful-win');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-first-win-'));
const projectDir = path.join(root, '.forgeflow', path.basename(root));
fs.mkdirSync(projectDir, { recursive: true });
fs.mkdirSync(path.join(projectDir, 'first-run-results'), { recursive: true });
fs.writeFileSync(path.join(projectDir, 'first-run-results', 'one.json'), `${JSON.stringify({
  schema_version: '1',
  runtime: 'codex',
  health: 'pass',
  smoke: 'pass',
  profile: 'pass',
  decision: 'continue',
  friction: 'none',
  next_action: 'forgeflow-trends --refresh',
}, null, 2)}\n`);
fs.writeFileSync(path.join(projectDir, 'agent-feedback.jsonl'), `${JSON.stringify({
  schema_version: '1',
  ts: '2026-05-28T00:00:00Z',
  agent: 'smith',
  signal: 'useful',
  summary: 'Caught a real issue.',
  confidence: 'high',
  evidence_count: 1,
})}\n`);

const result = buildFirstUsefulWin({ root, projectDir });
const codexResult = buildFirstUsefulWin({ root, projectDir, runtime: 'codex' });
const emptyCodex = buildFirstUsefulWin({ root: fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-first-win-empty-')), runtime: 'codex' });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--runtime', 'codex', '--json']);

const checks = [
  ['has useful signal', result.status === 'has-signal' && result.wins.length > 0],
  ['evidence summarized', result.evidence.first_run_records === 1 && result.evidence.useful_feedback === 1],
  ['first use path present', result.first_use_path.steps.length === 5 && result.first_use_path.steps[0].command === '/forgeflow-health' && result.first_use_path.stop_rule.includes('Stop and fix')],
  ['codex first use path present', codexResult.runtime === 'codex' && codexResult.first_use_path.steps[0].command === 'node scripts/forgeflow/health-check.js --json' && codexResult.first_use_path.steps[4].command.includes('--runtime codex')],
  ['next is runtime command', result.next === '/forgeflow-report --refresh' && codexResult.next === 'node scripts/forgeflow/render-forgeflow-report.js --refresh' && result.next_reason.includes('Refresh')],
  ['empty next is copy-pastable runtime command', emptyCodex.next === 'node scripts/forgeflow/render-first-run-guide.js --runtime codex' && emptyCodex.next_reason.includes('actual statuses')],
  ['renders markdown', markdown.includes('# Forgeflow First Useful Win') && markdown.includes('## Wins') && markdown.includes('## First-Use Path') && markdown.includes('Runtime: claude-code')],
  ['parses args', opts.root === root && opts.projectDir === projectDir && opts.runtime === 'codex' && opts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('first useful win: ok');
