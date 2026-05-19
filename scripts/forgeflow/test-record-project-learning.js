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
  '--json',
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
  ['cli appends entry', cliResult.status === 0 && afterCli.includes('rollup-project-learnings.js')],
  ['invalid category fails', invalidCategory.status === 1 && invalidCategory.stderr.includes('Invalid project learning category')],
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
