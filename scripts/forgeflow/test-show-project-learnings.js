#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { showProjectLearnings } = require('./show-project-learnings');

const repoRoot = path.resolve(__dirname, '..', '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-show-project-learnings-'));
const projectDir = path.join(tmp, '.forgeflow', 'Demo');
fs.mkdirSync(projectDir, { recursive: true });
fs.writeFileSync(path.join(projectDir, 'project-learning-candidates.jsonl'), [
  JSON.stringify({
    schema_version: '1',
    category: 'recommended-approach',
    learning: 'Record structured candidates before refreshing project learnings',
    source: 'Atlas',
  }),
  JSON.stringify({
    schema_version: '1',
    category: 'validation-pattern',
    learning: 'Run focused helper tests before full release checks',
    source: 'Compass',
  }),
  '',
].join('\n'));

const result = showProjectLearnings({ projectDir });
const cliMarkdown = spawnSync(path.join(repoRoot, 'scripts/forgeflow/show-project-learnings.js'), [
  '--project-dir',
  projectDir,
], { encoding: 'utf8' });
const cliJson = spawnSync(path.join(repoRoot, 'scripts/forgeflow/show-project-learnings.js'), [
  '--project-dir',
  projectDir,
  '--json',
], { encoding: 'utf8' });
const missingValue = spawnSync(path.join(repoRoot, 'scripts/forgeflow/show-project-learnings.js'), [
  '--project-dir',
], { encoding: 'utf8' });
const parsedJson = cliJson.status === 0 ? JSON.parse(cliJson.stdout) : {};

const checks = [
  ['writes artifact', fs.existsSync(path.join(projectDir, 'project-learnings.md'))],
  ['renders project heading', result.markdown.includes('# Forgeflow Project Learnings - Demo')],
  ['renders recommended first', result.markdown.indexOf('## Recommended Approach For Next Work') < result.markdown.indexOf('## Recurring Pitfalls')],
  ['renders structured recommendation', result.markdown.includes('Record structured candidates before refreshing project learnings')],
  ['renders guidance warning', result.markdown.includes('Use these as guidance only')],
  ['cli markdown works', cliMarkdown.status === 0 && cliMarkdown.stdout.includes('## Validation Patterns')],
  ['cli json works', cliJson.status === 0 && parsedJson.sources.learning_candidates === 2 && !cliJson.stdout.includes('Forgeflow Project Learnings - Demo')],
  ['missing option value exits usage', missingValue.status === 2 && missingValue.stderr.includes('Missing value for --project-dir')],
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

console.log('show project learnings: ok');
