#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseArgs, recordProjectLearning } = require('./record-project-learning');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-project-learning-'));
const projectDir = path.join(tmp, '.forgeflow', 'Demo');
const input = path.join(tmp, 'learnings.json');
fs.writeFileSync(input, JSON.stringify([
  {
    category: 'validation-pattern',
    learning: 'Run focused helper tests before full release checks',
    source: 'Compass',
    evidence: 'Caught docs drift in the previous slice',
    confidence: 'high',
    evidence_count: 3,
    application_guidance: 'Run the focused test before trusting release readiness.',
    status: 'superseded',
    superseded_by: 'Use the release-check equivalent before ship.',
  },
  {
    category: 'recommended-approach',
    learning: 'Record structured candidates before refreshing project learnings',
    source: 'Atlas',
  },
], null, 2));

const result = recordProjectLearning({ projectDir, input });
const file = path.join(projectDir, 'project-learning-candidates.jsonl');
const records = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line));
function runRecord(argv) {
  try {
    const opts = parseArgs(argv);
    recordProjectLearning(opts);
    return { status: 0, stderr: '' };
  } catch (err) {
    return { status: 1, stderr: err.message };
  }
}
const cliResult = runRecord([
  '--project-dir',
  projectDir,
  '--category',
  'hot-file',
  '--learning',
  'scripts/forgeflow/rollup-project-learnings.js',
  '--source',
  'Atlas',
  '--confidence',
  'low',
  '--evidence-count',
  '2',
  '--application-guidance',
  'Inspect this helper when project-learning output changes.',
  '--status',
  'stale',
  '--superseded-by',
  'Use project intelligence rollup guidance instead.',
  '--json',
]);
const invalidStatus = runRecord([
  '--project-dir',
  projectDir,
  '--category',
  'risk-area',
  '--learning',
  'Should fail',
  '--status',
  'retired',
]);
const oversizedSupersededBy = runRecord([
  '--project-dir',
  projectDir,
  '--category',
  'risk-area',
  '--learning',
  'Should fail',
  '--superseded-by',
  'x'.repeat(241),
]);
const invalidConfidence = runRecord([
  '--project-dir',
  projectDir,
  '--category',
  'risk-area',
  '--learning',
  'Should fail',
  '--confidence',
  'certain',
]);
const invalidEvidenceCount = runRecord([
  '--project-dir',
  projectDir,
  '--category',
  'risk-area',
  '--learning',
  'Should fail',
  '--evidence-count',
  '0',
]);
const oversizedGuidance = runRecord([
  '--project-dir',
  projectDir,
  '--category',
  'risk-area',
  '--learning',
  'Should fail',
  '--application-guidance',
  'x'.repeat(241),
]);
const invalidCategory = runRecord([
  '--project-dir',
  projectDir,
  '--category',
  'bad-category',
  '--learning',
  'Should fail',
]);
const sensitive = runRecord([
  '--project-dir',
  projectDir,
  '--category',
  'risk-area',
  '--learning',
  'token: SHOULD_NOT_WRITE',
]);
const privateUrl = runRecord([
  '--project-dir',
  projectDir,
  '--category',
  'risk-area',
  '--learning',
  'Internal repo ssh://git.internal/team/private.git should fail',
]);
const symlinkProjectDir = path.join(tmp, '.forgeflow', 'SymlinkDemo');
fs.mkdirSync(symlinkProjectDir, { recursive: true });
const outsideCandidates = path.join(tmp, 'outside-candidates.jsonl');
const symlinkCandidates = path.join(symlinkProjectDir, 'project-learning-candidates.jsonl');
fs.writeFileSync(outsideCandidates, 'do not append\n');
let symlinkAppendBlocked = true;
try {
  fs.symlinkSync(outsideCandidates, symlinkCandidates);
  recordProjectLearning({
    projectDir: symlinkProjectDir,
    category: 'risk-area',
    learning: 'Should not append through symlink',
  });
  symlinkAppendBlocked = false;
} catch (err) {
  symlinkAppendBlocked = err.message.includes('symlinked file');
}
const afterCli = fs.readFileSync(file, 'utf8');

const checks = [
  ['records input entries', result.entries === 2],
  ['writes jsonl file', fs.existsSync(file) && records.length === 2],
  ['normalizes schema', records.every((record) => record.schema_version === '1' && record.ts)],
  ['preserves category', records[0].category === 'validation-pattern'],
  ['preserves confidence metadata', records[0].confidence === 'high' && records[0].evidence_count === 3],
  ['preserves application guidance', records[0].application_guidance === 'Run the focused test before trusting release readiness.'],
  ['preserves lifecycle metadata', records[0].status === 'superseded' && records[0].superseded_by === 'Use the release-check equivalent before ship.'],
  ['cli appends entry', cliResult.status === 0 && afterCli.includes('rollup-project-learnings.js')],
  ['cli appends confidence metadata', cliResult.status === 0 && afterCli.includes('"confidence":"low"') && afterCli.includes('"evidence_count":2')],
  ['cli appends application guidance', cliResult.status === 0 && afterCli.includes('Inspect this helper when project-learning output changes.')],
  ['cli appends lifecycle metadata', cliResult.status === 0 && afterCli.includes('"status":"stale"') && afterCli.includes('Use project intelligence rollup guidance instead.')],
  ['invalid category fails', invalidCategory.status === 1 && invalidCategory.stderr.includes('Invalid project learning category')],
  ['invalid confidence fails', invalidConfidence.status === 1 && invalidConfidence.stderr.includes('Invalid project learning confidence')],
  ['invalid status fails', invalidStatus.status === 1 && invalidStatus.stderr.includes('Invalid project learning status')],
  ['invalid evidence count fails', invalidEvidenceCount.status === 1 && invalidEvidenceCount.stderr.includes('evidence_count')],
  ['oversized guidance fails', oversizedGuidance.status === 1 && oversizedGuidance.stderr.includes('application_guidance')],
  ['oversized superseded-by fails', oversizedSupersededBy.status === 1 && oversizedSupersededBy.stderr.includes('superseded_by')],
  ['sensitive entry fails', sensitive.status === 1 && sensitive.stderr.includes('sensitive content')],
  ['private url entry fails', privateUrl.status === 1 && privateUrl.stderr.includes('sensitive content')],
  ['sensitive value not written', !fs.readFileSync(file, 'utf8').includes('SHOULD_NOT_WRITE')],
  ['symlink candidate destination blocked', symlinkAppendBlocked && fs.readFileSync(outsideCandidates, 'utf8') === 'do not append\n'],
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

console.log('project learning recorder: ok');
