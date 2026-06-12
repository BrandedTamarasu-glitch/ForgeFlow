#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { checkReviewEvidenceSchema } = require('./check-review-evidence-schema');
const { buildLeanReview, parseArgs, parseDiff, renderMarkdown, TAGS } = require('./render-lean-review');

const diff = [
  'diff --git a/src/demo.js b/src/demo.js',
  '--- a/src/demo.js',
  '+++ b/src/demo.js',
  '@@ -1,1 +1,36 @@',
  '+function manualSort(items) {',
  '+  for (let i = 0; i < items.length; i += 1) {',
  '+    for (let j = 0; j < items.length; j += 1) {}',
  '+  }',
  '+}',
  '+function customDatePicker() { return "calendar widget"; }',
  '+// new helper can reuse existing same pattern',
  '+const futureProofPluginRegistry = {};',
  '+class ExportManager {}',
  '+if (false) console.log("dead code");',
  'diff --git a/docs/guide.md b/docs/guide.md',
  '--- a/docs/guide.md',
  '+++ b/docs/guide.md',
  '@@ -1,1 +1,16 @@',
  '+This paragraph explains the feature in a long narrative form.',
  '+It repeats context that the command output already has.',
  '+It adds another sentence without a new decision.',
  '+It adds another sentence without a new decision need.',
  '+It adds another sentence without a new boundary.',
  '+It adds another sentence without a new upgrade trigger.',
  '+It adds another sentence without a new artifact.',
  '+It adds another sentence without a new action.',
  '+It adds another sentence without a new result.',
  'diff --git a/src/auth.js b/src/auth.js',
  '--- a/src/auth.js',
  '+++ b/src/auth.js',
  '@@ -1,1 +1,5 @@',
  '+function customSortAuthTokens(tokens) {',
  '+  return tokens;',
  '+}',
  'diff --git a/src/form.js b/src/form.js',
  '--- a/src/form.js',
  '+++ b/src/form.js',
  '@@ -1,1 +1,5 @@',
  '+// accessibility keyboard validation for date picker',
  '+function customDatePicker() {}',
  '',
].join('\n');

const result = buildLeanReview({ root: process.cwd(), diffText: diff });
const markdown = renderMarkdown(result);
const parsed = parseDiff(diff);
const schema = checkReviewEvidenceSchema(result.findings);
const clean = buildLeanReview({ root: process.cwd(), diffText: 'diff --git a/src/a.js b/src/a.js\n--- a/src/a.js\n+++ b/src/a.js\n@@ -1 +1 @@\n+const ok = true;\n' });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-lean-review-'));
const diffFile = path.join(tmp, 'diff.patch');
fs.writeFileSync(diffFile, diff);
const fromFile = buildLeanReview({ root: tmp, diff: diffFile });
const opts = parseArgs(['--root', tmp, '--diff', diffFile, '--json']);

const foundTags = new Set(result.findings.map((item) => item.class));
const checks = [
  ['tag vocabulary stable', TAGS.join(',') === 'delete,stdlib,native,reuse,yagni,shrink,prose-bloat'],
  ['parses changed files', parsed.length === 4 && parsed.some((file) => file.file === 'src/demo.js')],
  ['detects every planned tag', TAGS.every((tag) => foundTags.has(tag))],
  ['skips hard boundary scopes', result.skipped.some((item) => item.file === 'src/auth.js') && result.skipped.some((item) => item.file === 'src/form.js')],
  ['schema compatible findings', schema.status === 'pass' && result.findings.every((item) => item.source === 'forgeflow-lean-review' && item.tier === 'NIT' && item.file && item.line > 0)],
  ['renders markdown with estimate', markdown.includes('# Forgeflow Lean Review') && markdown.includes('Estimated net removable lines:') && markdown.includes('## Skipped Boundaries')],
  ['clean diff ships', clean.status === 'clean' && clean.final_line === 'Lean already. Ship.' && renderMarkdown(clean).includes('Lean already. Ship.')],
  ['reads diff file safely', fromFile.findings_count === result.findings_count],
  ['parses args', opts.root === tmp && opts.diff === diffFile && opts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('lean review: ok');
