#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseArgs, shouldRefreshProjectCodeMap, showProjectLearnings } = require('./show-project-learnings');

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
const defaultProjectDir = path.join(repoRoot, '.forgeflow', path.basename(repoRoot));
const refreshedExternal = showProjectLearnings({ projectDir, refreshCodeMap: true });
const checkedExternal = showProjectLearnings({ projectDir, check: true });
const externalTopologyPath = path.join(projectDir, 'context', 'code-topology.json');
const cliMarkdownResult = showProjectLearnings(parseArgs([
  '--project-dir',
  projectDir,
], { exitOnError: false }));
const cliMarkdown = { status: 0, stdout: cliMarkdownResult.markdown };
const parsedJson = showProjectLearnings(parseArgs([
  '--project-dir',
  projectDir,
  '--json',
], { exitOnError: false }));
const parsedCheckJson = showProjectLearnings(parseArgs([
  '--project-dir',
  projectDir,
  '--check',
  '--json',
], { exitOnError: false }));
let missingValue = { status: 0, stderr: '' };
try {
  parseArgs(['--project-dir'], { exitOnError: false });
} catch (err) {
  missingValue = { status: err.exitCode || 1, stderr: err.message };
}

const checks = [
  ['writes artifact', fs.existsSync(path.join(projectDir, 'project-learnings.md'))],
  ['renders project heading', result.markdown.includes('# Forgeflow Project Learnings - Demo')],
  ['renders recommended first', result.markdown.indexOf('## Recommended Approach For Next Work') < result.markdown.indexOf('## Recurring Pitfalls')],
  ['renders structured recommendation', result.markdown.includes('Record structured candidates before refreshing project learnings')],
  ['renders guidance warning', result.markdown.includes('Use these as guidance only')],
  ['explicit refresh writes external code map', refreshedExternal.sources.code_map === true && fs.existsSync(externalTopologyPath)],
  ['check runs quality gate', checkedExternal.check.status === 'pass' && checkedExternal.context_smoke.status === 'skipped' && checkedExternal.latest_insights_ready === false],
  ['refreshes code map for default project dir', shouldRefreshProjectCodeMap(repoRoot, defaultProjectDir) === true],
  ['does not refresh code map for explicit external project dir', shouldRefreshProjectCodeMap(repoRoot, projectDir) === false],
  ['allows explicit refresh override', shouldRefreshProjectCodeMap(repoRoot, projectDir, { refreshCodeMap: true }) === true],
  ['cli markdown works', cliMarkdown.status === 0 && cliMarkdown.stdout.includes('## Validation Patterns')],
  ['cli json works', parsedJson.sources.learning_candidates === 2],
  ['cli check json works', parsedCheckJson.check.status === 'pass' && parsedCheckJson.context_smoke.status === 'skipped'],
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
