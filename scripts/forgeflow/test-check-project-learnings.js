#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { checkProjectLearnings, parseArgs } = require('./check-project-learnings');

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
  lines.push('## Sources', '', '- Generated at: 2026-05-20T00:00:00Z', '');
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
  JSON.stringify({ schema_version: '1', category: 'validation-pattern', learning: 'Run focused helper tests before release checks.', status: 'active' }),
  JSON.stringify({ schema_version: '1', category: 'recommended-approach', learning: 'Old rollout approach', status: 'superseded', superseded_by: 'Use project intelligence rollup guidance.' }),
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
const privateUrlProject = project('private-url');
writeLearnings(privateUrlProject, {
  'Recurring Pitfalls': ['Review git@github.com:private/repo.git before shipping.'],
  'Stable Decisions': [],
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
  JSON.stringify({ schema_version: '1', category: 'risk-area', learning: 'Long guidance', application_guidance: 'x'.repeat(241) }),
  JSON.stringify({ schema_version: '1', category: 'risk-area', learning: 'Bad status', status: 'retired' }),
  JSON.stringify({ schema_version: '1', category: 'risk-area', learning: 'Oversized replacement', superseded_by: 'x'.repeat(241) }),
  JSON.stringify({ schema_version: '1', category: 'risk-area', learning: 'Missing replacement', status: 'superseded' }),
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

const stale = project('stale');
writeLearnings(stale, {
  'Recurring Pitfalls': ['A real pitfall.'],
  'Stable Decisions': [],
  'Risk Areas': [],
  'Validation Patterns': [],
  'Hot Files And Modules': [],
  'Repeated Follow-ups': [],
  'Recommended Approach For Next Work': [],
});
let staleContent = fs.readFileSync(path.join(stale, 'project-learnings.md'), 'utf8');
staleContent = staleContent.replace('- Generated at: 2026-05-20T00:00:00Z', '- Generated at: 2026-03-01T00:00:00Z');
fs.writeFileSync(path.join(stale, 'project-learnings.md'), staleContent);
const missingFreshness = project('missing-freshness');
writeLearnings(missingFreshness, {
  'Recurring Pitfalls': ['A real pitfall.'],
  'Stable Decisions': [],
  'Risk Areas': [],
  'Validation Patterns': [],
  'Hot Files And Modules': [],
  'Repeated Follow-ups': [],
  'Recommended Approach For Next Work': [],
});
let missingFreshnessContent = fs.readFileSync(path.join(missingFreshness, 'project-learnings.md'), 'utf8');
missingFreshnessContent = missingFreshnessContent.replace('- Generated at: 2026-05-20T00:00:00Z\n', '');
fs.writeFileSync(path.join(missingFreshness, 'project-learnings.md'), missingFreshnessContent);

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
const privateUrlResult = checkProjectLearnings({ projectDir: privateUrlProject });
const badCandidateResult = checkProjectLearnings({ projectDir: badCandidate });
const invalidMetadataResult = checkProjectLearnings({ projectDir: invalidMetadata });
const missingBoundaryResult = checkProjectLearnings({ projectDir: missingBoundary });
const staleResult = checkProjectLearnings({ projectDir: stale, now: new Date('2026-05-20T00:00:00Z') });
const missingFreshnessResult = checkProjectLearnings({ projectDir: missingFreshness });
let missingArg = { status: 0, stderr: '' };
try {
  parseArgs(['--project-dir'], { exitOnError: false });
} catch (err) {
  missingArg = { status: err.exitCode || 1, stderr: err.message };
}

const checks = [
  ['good passes', goodResult.status === 'pass'],
  ['reads generated timestamp', goodResult.generated_at === '2026-05-20T00:00:00Z'],
  ['counts candidates', goodResult.candidates === 2],
  ['placeholder warns', placeholderResult.status === 'warn' && placeholderResult.issues.some((item) => item.code === 'placeholder-only')],
  ['strict placeholder fails', strictPlaceholder.status === 1],
  ['sensitive fails', sensitiveResult.status === 'fail' && sensitiveResult.issues.some((item) => item.code === 'sensitive-content')],
  ['sensitive output redacted', !sensitiveCli.stdout.includes('SHOULD_NOT_PRINT') && !sensitiveCli.stderr.includes('SHOULD_NOT_PRINT')],
  ['git ssh shorthand url fails', privateUrlResult.status === 'fail' && privateUrlResult.issues.some((item) => item.code === 'sensitive-content' && item.pattern === 'private-url')],
  ['bad candidate fails', badCandidateResult.status === 'fail' && badCandidateResult.issues.some((item) => item.code === 'candidate-category-invalid') && badCandidateResult.issues.some((item) => item.code === 'candidate-json-invalid')],
  ['invalid candidate metadata fails', invalidMetadataResult.status === 'fail' && invalidMetadataResult.issues.some((item) => item.code === 'candidate-confidence-invalid') && invalidMetadataResult.issues.some((item) => item.code === 'candidate-evidence-count-invalid') && invalidMetadataResult.issues.some((item) => item.code === 'candidate-application-guidance-oversized') && invalidMetadataResult.issues.some((item) => item.code === 'candidate-status-invalid') && invalidMetadataResult.issues.some((item) => item.code === 'candidate-superseded-by-oversized')],
  ['superseded candidates without replacement warn', invalidMetadataResult.issues.some((item) => item.code === 'candidate-superseded-by-missing')],
  ['missing proof boundary fails', missingBoundaryResult.status === 'fail' && missingBoundaryResult.issues.some((item) => item.code === 'proof-boundary-missing')],
  ['stale freshness warns', staleResult.status === 'warn' && staleResult.issues.some((item) => item.code === 'freshness-stale' && item.age_days > 30)],
  ['missing freshness warns', missingFreshnessResult.status === 'warn' && missingFreshnessResult.issues.some((item) => item.code === 'freshness-missing')],
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
