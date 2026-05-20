#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { checkProjectLearnings } = require('./check-project-learnings');

const repoRoot = path.resolve(__dirname, '..', '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-check-project-learnings-'));

function project(name) {
  const dir = path.join(tmp, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeLearnings(dir, sections, boundary = true) {
  const lines = ['# Project Learnings', ''];
  if (boundary) {
    lines.push('Project learnings are guidance only. Verify current findings against current code, tests, and artifacts.', '');
  }
  for (const [heading, items] of Object.entries(sections)) {
    lines.push(`## ${heading}`, '', ...items.map((item) => `- ${item}`), '');
  }
  fs.writeFileSync(path.join(dir, 'project-learnings.md'), lines.join('\n'));
}

function writeCandidates(dir, lines) {
  fs.writeFileSync(path.join(dir, 'project-learning-candidates.jsonl'), `${lines.join('\n')}\n`);
}

const good = project('good');
writeLearnings(good, {
  'Recurring Pitfalls': ['Manifest drift can follow helper additions.'],
  'Stable Decisions': ['Keep project learnings local.'],
  'Risk Areas': ['runtime-helper: 2'],
  'Validation Patterns': ['Run focused helper tests before release checks.'],
  'Hot Files And Modules': ['scripts/forgeflow/install-manifest.js'],
  'Repeated Follow-ups': ['Refresh insights after each slice.'],
  'Recommended Approach For Next Work': ['Update manifest, docs, tests, then dogfood.'],
});
writeCandidates(good, [
  JSON.stringify({ schema_version: '1', category: 'validation-pattern', learning: 'Run focused helper tests before release checks.' }),
]);

const placeholder = project('placeholder');
writeLearnings(placeholder, Object.fromEntries([
  'Recurring Pitfalls',
  'Stable Decisions',
  'Risk Areas',
  'Validation Patterns',
  'Hot Files And Modules',
  'Repeated Follow-ups',
  'Recommended Approach For Next Work',
].map((heading) => [heading, ['No repeated pattern recorded yet.']])));

const sensitive = project('sensitive');
writeLearnings(sensitive, {
  'Recurring Pitfalls': ['token: SHOULD_NOT_PRINT'],
  'Stable Decisions': ['Keep project learnings local.'],
  'Risk Areas': [],
  'Validation Patterns': [],
  'Hot Files And Modules': [],
  'Repeated Follow-ups': [],
  'Recommended Approach For Next Work': [],
});

const badCandidate = project('bad-candidate');
writeLearnings(badCandidate, {
  'Recurring Pitfalls': ['A real pitfall.'],
  'Stable Decisions': [],
  'Risk Areas': [],
  'Validation Patterns': [],
  'Hot Files And Modules': [],
  'Repeated Follow-ups': [],
  'Recommended Approach For Next Work': [],
});
writeCandidates(badCandidate, [
  '{"category":"bad","learning":"Invalid category"}',
  '{not-json}',
]);

const invalidMetadata = project('invalid-metadata');
writeLearnings(invalidMetadata, {
  'Recurring Pitfalls': ['A real pitfall.'],
  'Stable Decisions': [],
  'Risk Areas': [],
  'Validation Patterns': [],
  'Hot Files And Modules': [],
  'Repeated Follow-ups': [],
  'Recommended Approach For Next Work': [],
});
writeCandidates(invalidMetadata, [
  JSON.stringify({ schema_version: '1', category: 'risk-area', learning: 'Good learning', confidence: 'certain' }),
  JSON.stringify({ schema_version: '1', category: 'risk-area', learning: 'Another learning', evidence_count: 0 }),
]);

const missingBoundary = project('missing-boundary');
writeLearnings(missingBoundary, {
  'Recurring Pitfalls': ['A real pitfall.'],
  'Stable Decisions': [],
  'Risk Areas': [],
  'Validation Patterns': [],
  'Hot Files And Modules': [],
  'Repeated Follow-ups': [],
  'Recommended Approach For Next Work': [],
}, false);

const goodResult = checkProjectLearnings({ projectDir: good });
const placeholderResult = checkProjectLearnings({ projectDir: placeholder });
const strictPlaceholder = spawnSync(path.join(repoRoot, 'scripts/forgeflow/check-project-learnings.js'), [
  '--project-dir',
  placeholder,
  '--strict',
  '--json',
], { encoding: 'utf8' });
const sensitiveResult = checkProjectLearnings({ projectDir: sensitive });
const sensitiveCli = spawnSync(path.join(repoRoot, 'scripts/forgeflow/check-project-learnings.js'), [
  '--project-dir',
  sensitive,
  '--json',
], { encoding: 'utf8' });
const badCandidateResult = checkProjectLearnings({ projectDir: badCandidate });
const invalidMetadataResult = checkProjectLearnings({ projectDir: invalidMetadata });
const missingBoundaryResult = checkProjectLearnings({ projectDir: missingBoundary });
const missingArg = spawnSync(path.join(repoRoot, 'scripts/forgeflow/check-project-learnings.js'), [
  '--project-dir',
], { encoding: 'utf8' });

const checks = [
  ['good passes', goodResult.status === 'pass'],
  ['counts candidates', goodResult.candidates === 1],
  ['placeholder warns', placeholderResult.status === 'warn' && placeholderResult.issues.some((item) => item.code === 'placeholder-only')],
  ['strict placeholder fails', strictPlaceholder.status === 1],
  ['sensitive fails', sensitiveResult.status === 'fail' && sensitiveResult.issues.some((item) => item.code === 'sensitive-content')],
  ['sensitive output redacted', !sensitiveCli.stdout.includes('SHOULD_NOT_PRINT') && !sensitiveCli.stderr.includes('SHOULD_NOT_PRINT')],
  ['bad candidate fails', badCandidateResult.status === 'fail' && badCandidateResult.issues.some((item) => item.code === 'candidate-category-invalid') && badCandidateResult.issues.some((item) => item.code === 'candidate-json-invalid')],
  ['invalid candidate metadata fails', invalidMetadataResult.status === 'fail' && invalidMetadataResult.issues.some((item) => item.code === 'candidate-confidence-invalid') && invalidMetadataResult.issues.some((item) => item.code === 'candidate-evidence-count-invalid')],
  ['missing proof boundary fails', missingBoundaryResult.status === 'fail' && missingBoundaryResult.issues.some((item) => item.code === 'proof-boundary-missing')],
  ['missing option value exits usage', missingArg.status === 2 && missingArg.stderr.includes('Missing value for --project-dir')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

if (failed > 0) {
  process.exit(1);
}

console.log('project learnings check: ok');
