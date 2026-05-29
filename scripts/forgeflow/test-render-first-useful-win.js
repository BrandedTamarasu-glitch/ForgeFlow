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
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--json']);

const checks = [
  ['has useful signal', result.status === 'has-signal' && result.wins.length > 0],
  ['evidence summarized', result.evidence.first_run_records === 1 && result.evidence.useful_feedback === 1],
  ['next is command-only', result.next === 'forgeflow-report --refresh' && result.next_reason.includes('Refresh')],
  ['renders markdown', markdown.includes('# Forgeflow First Useful Win') && markdown.includes('## Wins')],
  ['parses args', opts.root === root && opts.projectDir === projectDir && opts.json === true],
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
