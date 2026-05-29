#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildOutcomeCapturePlan, parseArgs, renderMarkdown } = require('./render-outcome-capture-plan');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-outcome-capture-plan-'));
const projectDir = path.join(root, '.forgeflow', path.basename(root));
const contextDir = path.join(projectDir, 'context');
fs.mkdirSync(contextDir, { recursive: true });
fs.writeFileSync(path.join(contextDir, 'project-intelligence-rollup.json'), JSON.stringify({
  next_work_confidence: { status: 'missing' },
  review_outcomes: { status: 'missing' },
  agent_feedback: { status: 'ok' },
}, null, 2));

const result = buildOutcomeCapturePlan({ root, projectDir });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--json']);

const checks = [
  ['reports missing streams', result.status === 'capture-needed' && result.missing_count === 2],
  ['keeps existing streams watch-only', result.streams.find((item) => item.name === 'agent-feedback').action === 'watch'],
  ['renders recorder prompts', markdown.includes('record-next-work-outcome') && markdown.includes('record-review-outcome')],
  ['renders boundary', markdown.includes('does not record')],
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
console.log('outcome capture plan: ok');
