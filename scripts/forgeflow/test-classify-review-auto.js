#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { classifyReviewAuto, parseArgs, renderMarkdown } = require('./classify-review-auto');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-review-auto-classify-'));
const findingsFile = path.join(tmp, 'findings.json');
fs.writeFileSync(findingsFile, JSON.stringify([
  { id: 'nit-1', source: 'smith', tier: 'NIT', title: 'Unused import can be removed.', file: 'src/demo.ts' },
  { id: 'warden-1', source: 'warden', tier: 'MUST-FIX-SAFE', title: 'Token handling needs review.', file: 'src/auth.ts' },
  { id: 'pkg-1', source: 'smith', tier: 'NIT', title: 'Format package file.', file: 'package.json' },
], null, 2));

const result = classifyReviewAuto(JSON.parse(fs.readFileSync(findingsFile, 'utf8')));
const markdown = renderMarkdown(result);
const opts = parseArgs(['--findings', findingsFile, '--json']);

const checks = [
  ['classifies safe', result.counts.safe === 1 && result.items.some((item) => item.id === 'nit-1' && item.auto_apply)],
  ['classifies risky surfaced findings', result.counts.risky === 2 && result.items.some((item) => item.id === 'warden-1' && item.bucket === 'risky') && result.items.some((item) => item.id === 'pkg-1' && item.bucket === 'risky')],
  ['does not block when only safe and risky findings exist', result.counts.blocker === 0 && result.status === 'classified'],
  ['renders boundary', markdown.includes('Read-only classifier') && markdown.includes('risky: warden-1')],
  ['parses args', opts.findings === findingsFile && opts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('review-auto classifier: ok');
