#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildFirstTaskReport, parseArgs, renderMarkdown } = require('./render-first-task-report');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-first-task-report-'));
const projectDir = path.join(root, '.forgeflow', path.basename(root));
fs.mkdirSync(projectDir, { recursive: true });
fs.writeFileSync(path.join(projectDir, 'next-work-outcomes.jsonl'), `${JSON.stringify({
  schema_version: '1',
  recorded_at: '2026-05-29T00:00:00Z',
  title: 'First task',
  source: 'Project',
  outcome: 'useful',
  confidence: 'high',
  summary: 'Helped choose next step.',
})}\n`);
const result = buildFirstTaskReport({ root, projectDir });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--json']);

const checks = [
  ['has success signal', result.status !== 'needs-evidence' && result.success_signals.includes('next-work-useful')],
  ['summarizes evidence', result.evidence.next_work_records === 1],
  ['does not render raw project records', !markdown.includes('Helped choose next step.') && !markdown.includes('First task')],
  ['renders markdown', markdown.includes('# Forgeflow First Task Report') && markdown.includes('Next:')],
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
console.log('first task report: ok');
