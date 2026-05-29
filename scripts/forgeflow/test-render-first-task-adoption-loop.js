#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildFirstTaskAdoptionLoop, parseArgs, renderMarkdown } = require('./render-first-task-adoption-loop');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-first-task-adoption-loop-'));
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
const result = buildFirstTaskAdoptionLoop({ root, projectDir });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--json']);

const checks = [
  ['returns an adoption decision', ['repeat', 'fix', 'defer', 'expand'].includes(result.decision)],
  ['summarizes counts only', !markdown.includes('Helped choose next step.') && !markdown.includes('source: Project')],
  ['uses first task evidence', result.evidence.first_task_status !== 'needs-evidence'],
  ['renders markdown', markdown.includes('# Forgeflow First Task Adoption Loop') && markdown.includes('Decision:')],
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
console.log('first task adoption loop: ok');
