#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { recordProjectLearning } = require('./record-project-learning');

const repoRoot = path.resolve(__dirname, '..', '..');
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
const cliResult = spawnSync(path.join(repoRoot, 'scripts/forgeflow/record-project-learning.js'), [
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
  '--json',
], { encoding: 'utf8' });
const invalidConfidence = spawnSync(path.join(repoRoot, 'scripts/forgeflow/record-project-learning.js'), [
  '--project-dir',
  projectDir,
  '--category',
  'risk-area',
  '--learning',
  'Should fail',
  '--confidence',
  'certain',
], { encoding: 'utf8' });
const invalidEvidenceCount = spawnSync(path.join(repoRoot, 'scripts/forgeflow/record-project-learning.js'), [
  '--project-dir',
  projectDir,
  '--category',
  'risk-area',
  '--learning',
  'Should fail',
  '--evidence-count',
  '0',
], { encoding: 'utf8' });
const oversizedGuidance = spawnSync(path.join(repoRoot, 'scripts/forgeflow/record-project-learning.js'), [
  '--project-dir',
  projectDir,
  '--category',
  'risk-area',
  '--learning',
  'Should fail',
  '--application-guidance',
  'x'.repeat(241),
], { encoding: 'utf8' });
const invalidCategory = spawnSync(path.join(repoRoot, 'scripts/forgeflow/record-project-learning.js'), [
  '--project-dir',
  projectDir,
  '--category',
  'bad-category',
  '--learning',
  'Should fail',
], { encoding: 'utf8' });
const sensitive = spawnSync(path.join(repoRoot, 'scripts/forgeflow/record-project-learning.js'), [
  '--project-dir',
  projectDir,
  '--category',
  'risk-area',
  '--learning',
  'token: SHOULD_NOT_WRITE',
], { encoding: 'utf8' });
const afterCli = fs.readFileSync(file, 'utf8');

const checks = [
  ['records input entries', result.entries === 2],
  ['writes jsonl file', fs.existsSync(file) && records.length === 2],
  ['normalizes schema', records.every((record) => record.schema_version === '1' && record.ts)],
  ['preserves category', records[0].category === 'validation-pattern'],
  ['preserves confidence metadata', records[0].confidence === 'high' && records[0].evidence_count === 3],
  ['preserves application guidance', records[0].application_guidance === 'Run the focused test before trusting release readiness.'],
  ['cli appends entry', cliResult.status === 0 && afterCli.includes('rollup-project-learnings.js')],
  ['cli appends confidence metadata', cliResult.status === 0 && afterCli.includes('"confidence":"low"') && afterCli.includes('"evidence_count":2')],
  ['cli appends application guidance', cliResult.status === 0 && afterCli.includes('Inspect this helper when project-learning output changes.')],
  ['invalid category fails', invalidCategory.status === 1 && invalidCategory.stderr.includes('Invalid project learning category')],
  ['invalid confidence fails', invalidConfidence.status === 1 && invalidConfidence.stderr.includes('Invalid project learning confidence')],
  ['invalid evidence count fails', invalidEvidenceCount.status === 1 && invalidEvidenceCount.stderr.includes('evidence_count')],
  ['oversized guidance fails', oversizedGuidance.status === 1 && oversizedGuidance.stderr.includes('application_guidance')],
  ['sensitive entry fails', sensitive.status === 1 && sensitive.stderr.includes('sensitive content')],
  ['sensitive value not written', !fs.readFileSync(file, 'utf8').includes('SHOULD_NOT_WRITE')],
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
