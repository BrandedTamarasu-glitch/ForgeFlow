#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { classifyReviewAuto, parseArgs, renderMarkdown } = require('./classify-review-auto');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-review-auto-classify-'));
const findingsFile = path.join(tmp, 'findings.json');
fs.writeFileSync(findingsFile, JSON.stringify([
  { id: 'nit-1', source: 'smith', tier: 'NIT', class: 'unused-import', title: 'Unused import can be removed.', file: 'src/demo.ts' },
  { id: 'unknown-1', source: 'smith', tier: 'MUST-FIX-SAFE', class: 'needs-judgment', title: 'Maybe simplify behavior.', file: 'src/demo.ts' },
  { id: 'warden-1', source: 'warden', tier: 'MUST-FIX-SAFE', class: 'auth', title: 'Token handling needs review.', file: 'src/auth.ts' },
  { id: 'pkg-1', source: 'smith', tier: 'NIT', title: 'Format package file.', file: 'package.json' },
  { id: 'multi-1', source: 'smith', tier: 'NIT', class: 'docs-drift', title: 'Docs mention stale command.', files: ['README.md', 'docs/wiki/Home.md'] },
], null, 2));

const result = classifyReviewAuto(JSON.parse(fs.readFileSync(findingsFile, 'utf8')));
const markdown = renderMarkdown(result);
const opts = parseArgs(['--findings', findingsFile, '--json']);

const checks = [
  ['classifies allowlisted safe proposal', result.counts.safe === 1 && result.items.some((item) => item.id === 'nit-1' && item.auto_apply && item.proposal_allowed && item.policy.sandbox_required && item.policy.matched_rules.includes('allowlist-class:unused-import'))],
  ['classifies unknown as risky', result.items.some((item) => item.id === 'unknown-1' && item.bucket === 'risky' && !item.proposal_allowed && item.policy.matched_rules.some((rule) => rule.includes('unknown-or-unapproved-class')))],
  ['classifies denylist blockers', result.counts.blocker === 2 && result.items.some((item) => item.id === 'warden-1' && item.bucket === 'blocker' && item.policy.matched_rules.includes('denylist-class:auth')) && result.items.some((item) => item.id === 'pkg-1' && item.bucket === 'blocker' && item.policy.matched_rules.includes('denylist-dependency-file'))],
  ['classifies multi-file as risky', result.items.some((item) => item.id === 'multi-1' && item.bucket === 'risky' && item.policy.matched_rules.includes('multi-file-finding'))],
  ['status blocked with blockers', result.status === 'blocked'],
  ['renders boundary and policy', markdown.includes('Read-only classifier') && markdown.includes('blocker: warden-1') && markdown.includes('Proposal allowed: yes') && markdown.includes('Rules: allowlist-class:unused-import')],
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
