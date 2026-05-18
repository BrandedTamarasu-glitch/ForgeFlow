#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  buildRecord,
  recordPilotEvidence,
  renderYaml,
  validate,
} = require('./record-pilot-evidence');

const repoRoot = path.resolve(__dirname, '..', '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-pilot-evidence-'));
const projectDir = path.join(tmp, '.forgeflow', 'Demo');

const result = recordPilotEvidence({
  projectDir,
  values: {
    pilot_id: 'zach-codex-notes',
    runtime: 'codex',
    project_type: 'docs-config',
    health_result: 'warn',
    adoption_decision: 'repeat-pilot',
    next_action: 'Run one more bounded maintainer branch',
  },
});
const content = fs.readFileSync(result.path, 'utf8');
const defaultRecord = buildRecord({ runtime: 'claude-code' });
const quotedYaml = renderYaml({ pilot_id: 'quote-test', next_action: 'Contains # marker', date: '2026-05-18' });
const invalid = validate({ runtime: 'cursor', extra: 'bad' });
const cliResult = spawnSync(path.join(repoRoot, 'scripts/forgeflow/record-pilot-evidence.js'), [
  '--project-dir',
  projectDir,
  '--pilot-id',
  'cli-pilot',
  '--set',
  'sharing_level=local-maintainer',
  '--json',
], { encoding: 'utf8' });
const missingValue = spawnSync(path.join(repoRoot, 'scripts/forgeflow/record-pilot-evidence.js'), [
  '--runtime',
], { encoding: 'utf8' });
const invalidCli = spawnSync(path.join(repoRoot, 'scripts/forgeflow/record-pilot-evidence.js'), [
  '--project-dir',
  projectDir,
  '--runtime',
  'cursor',
], { encoding: 'utf8' });
const cliJson = cliResult.status === 0 ? JSON.parse(cliResult.stdout) : {};

const checks = [
  ['writes evidence file', fs.existsSync(result.path)],
  ['uses pilot evidence dir', result.path.endsWith(path.join('pilot-evidence', 'zach-codex-notes.yml'))],
  ['records chosen fields', content.includes('runtime: codex') && content.includes('project_type: docs-config')],
  ['keeps blank template fields', content.includes('maintainer:') && content.includes('review_minutes:')],
  ['defaults date and pilot id', defaultRecord.date.length === 10 && defaultRecord.pilot_id.includes('claude-code')],
  ['quotes unsafe yaml scalar', quotedYaml.includes('next_action: "Contains # marker"')],
  ['validates unknown and invalid choices', invalid.length === 2],
  ['cli writes json result', cliResult.status === 0 && cliJson.record?.sharing_level === 'local-maintainer'],
  ['missing option value exits usage', missingValue.status === 2 && missingValue.stderr.includes('Missing value for --runtime')],
  ['invalid choice exits failure', invalidCli.status === 1 && invalidCli.stderr.includes('Invalid runtime: cursor')],
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

console.log('pilot evidence: ok');
