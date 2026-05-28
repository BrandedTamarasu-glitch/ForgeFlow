#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildPatternReview, parseArgs, renderMarkdown } = require('./render-pattern-review');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-pattern-review-'));
const patternsDir = path.join(root, 'forgeflow-patterns');
const alpha = path.join(root, 'alpha', '.forgeflow', 'Alpha');
const beta = path.join(root, 'beta', '.forgeflow', 'Beta');
fs.mkdirSync(patternsDir, { recursive: true });
fs.mkdirSync(alpha, { recursive: true });
fs.mkdirSync(beta, { recursive: true });
fs.writeFileSync(path.join(alpha, 'project-learning-candidates.jsonl'), [
  JSON.stringify({ ts: '2026-05-01T00:00:00Z', category: 'risk-area', learning: 'Release helper should distinguish sandbox network denial from missing release', confidence: 'high' }),
  JSON.stringify({ ts: '2026-05-02T00:00:00Z', category: 'risk-area', learning: 'Release helper should distinguish sandbox network denial from missing tag', confidence: 'high' }),
].join('\n'));
fs.writeFileSync(path.join(beta, 'project-learning-candidates.jsonl'), [
  JSON.stringify({ ts: '2026-05-03T00:00:00Z', category: 'risk-area', learning: 'Release helper should distinguish sandbox network denial from missing remote evidence', confidence: 'medium' }),
].join('\n'));

const review = buildPatternReview({ root, patternsDir, period: 'all', minProjects: 2, minOccurrences: 3 });
const markdown = renderMarkdown(review);
const opts = parseArgs(['--root', root, '--patterns-dir', patternsDir, '--period', 'all', '--json']);

const checks = [
  ['schema version', review.schema_version === '1'],
  ['dry-run candidates', review.candidates.length === 1 && review.candidates[0].status === 'ready-for-human-review'],
  ['redaction checklist', review.redaction_checklist.some((item) => item.includes('private URLs'))],
  ['markdown renders', markdown.includes('# Forgeflow Pattern Review') && markdown.includes('Redaction Checklist') && markdown.includes('Pattern promotion is manual')],
  ['parse args', opts.root === root && opts.patternsDir === patternsDir && opts.json === true && opts.dryRun === true],
  ['does not write log', !fs.existsSync(path.join(patternsDir, '.learnings-log.jsonl'))],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('pattern review: ok');
