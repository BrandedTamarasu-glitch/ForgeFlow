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
  '+// forgeflow: lean: direct implementation until a second caller appears',
  '+// forgeflow: upgrade when: another export flow needs the same manager',
  '+// forgeflow: native-first',
  'diff --git a/package.json b/package.json',
  '--- a/package.json',
  '+++ b/package.json',
  '@@ -1,3 +1,6 @@',
  '+{',
  '+  "dependencies": {',
  '+    "left-pad": "^1.3.0"',
  '+  }',
  '+  // forgeflow: no-new-deps',
  '+}',
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
const semanticSort = buildLeanReview({ root: process.cwd(), diffText: [
  'diff --git a/src/sort.js b/src/sort.js',
  '--- a/src/sort.js',
  '+++ b/src/sort.js',
  '@@ -1,1 +1,7 @@',
  '+function customSort(items) {',
  '+  return items.sort((a, b) => a.label.localeCompare(b.label));',
  '+}',
  '',
].join('\n') });
const calibrationBoundary = buildLeanReview({ root: process.cwd(), diffText: [
  'diff --git a/src/servo.js b/src/servo.js',
  '--- a/src/servo.js',
  '+++ b/src/servo.js',
  '@@ -1,1 +1,7 @@',
  '+const calibrationOffset = 0;',
  '+function ExportManager() {',
  '+  return calibrationOffset;',
  '+}',
  '',
].join('\n') });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-lean-review-'));
const diffFile = path.join(tmp, 'diff.patch');
fs.writeFileSync(diffFile, diff);
const projectDir = path.join(tmp, '.forgeflow', 'Demo');
fs.mkdirSync(path.join(projectDir, 'context'), { recursive: true });
fs.writeFileSync(path.join(projectDir, 'context', 'code-topology.json'), JSON.stringify({
  nodes: [
    { path: 'src/demo.js', fan_in: 0, fan_out: 1 },
    { path: 'package.json', fan_in: 3, fan_out: 0 },
  ],
  changed_file_neighbors: [
    { path: 'src/demo.js', read_next: [{ path: 'src/existing-helper.js' }] },
  ],
}, null, 2));
fs.writeFileSync(path.join(projectDir, 'context', 'invocation-hints.json'), JSON.stringify({
  invocation_hints: [
    { kind: 'package-script', path: 'package.json', suggested_invocation: 'npm test' },
  ],
}, null, 2));
const fromFile = buildLeanReview({ root: tmp, diff: diffFile });
const withProjectEvidence = buildLeanReview({ root: tmp, projectDir, diff: diffFile });
const opts = parseArgs(['--root', tmp, '--project-dir', projectDir, '--diff', diffFile, '--json']);

const foundTags = new Set(result.findings.map((item) => item.class));
const packageFinding = withProjectEvidence.findings.find((item) => item.file === 'package.json');
const demoFinding = withProjectEvidence.findings.find((item) => item.file === 'src/demo.js' && item.class === 'shrink');
const checks = [
  ['tag vocabulary stable', TAGS.join(',') === 'delete,stdlib,native,reuse,yagni,shrink,prose-bloat'],
  ['parses changed files', parsed.length === 5 && parsed.some((file) => file.file === 'src/demo.js')],
  ['detects every planned tag', TAGS.every((tag) => foundTags.has(tag))],
  ['skips hard boundary scopes', result.skipped.some((item) => item.file === 'src/auth.js') && result.skipped.some((item) => item.file === 'src/form.js')],
  ['schema compatible findings', schema.status === 'pass' && result.findings.every((item) => item.source === 'forgeflow-lean-review' && item.tier === 'NIT' && item.file && item.line > 0)],
  ['adds precision fields', result.findings.every((item) => item.confidence && item.replacement && item.estimated_net_lines > 0 && Array.isArray(item.why_safe) && Array.isArray(item.why_not_safe) && Array.isArray(item.proof))],
  ['renders markdown with estimate', markdown.includes('# Forgeflow Lean Review') && markdown.includes('Estimated net removable lines:') && markdown.includes('## Skipped Boundaries') && markdown.includes('Confidence:') && markdown.includes('Replacement:')],
  ['renders lean marker summary', markdown.includes('## Lean Markers') && markdown.includes('marker-missing-detail')],
  ['clean diff ships', clean.status === 'clean' && clean.final_line === 'Lean already. Ship.' && renderMarkdown(clean).includes('Lean already. Ship.')],
  ['semantic sort false positive suppressed', semanticSort.status === 'clean' && semanticSort.skipped.some((item) => item.reasons.includes('suppressed-stdlib') && item.reasons.includes('sort-semantics-present'))],
  ['calibration boundary suppresses simplification', calibrationBoundary.status === 'clean' && calibrationBoundary.skipped.some((item) => item.file === 'src/servo.js' && item.reasons.includes('calibration-boundary-scope'))],
  ['reads diff file safely', fromFile.findings_count === result.findings_count],
  ['dependency delta gets project evidence', packageFinding && packageFinding.project_evidence.some((item) => item.includes('dependency delta: added left-pad')) && packageFinding.project_evidence.some((item) => item.includes('invocation hint'))],
  ['topology evidence enriches findings', demoFinding && demoFinding.project_evidence.some((item) => item.includes('static topology')) && demoFinding.project_evidence.some((item) => item.includes('second-caller evidence'))],
  ['project evidence boundary reported', withProjectEvidence.project_evidence.boundary.includes('static and advisory')],
  ['lean markers report issues', result.lean_markers.count === 4 && result.lean_markers.invalid_count === 1 && result.lean_markers.issues.some((item) => item.issue === 'marker-conflicts-with-dependency-addition')],
  ['parses args', opts.root === tmp && opts.projectDir === projectDir && opts.diff === diffFile && opts.json === true],
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
