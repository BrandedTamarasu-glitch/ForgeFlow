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
const rollupContent = fs.readFileSync(result.rollup_path, 'utf8');
const defaultRecord = buildRecord({ runtime: 'claude-code' });
const noRollupResult = recordPilotEvidence({
  projectDir: path.join(tmp, '.forgeflow', 'NoRollup'),
  rollup: false,
  values: {
    pilot_id: 'no-rollup',
    runtime: 'codex',
  },
});
const quotedYaml = renderYaml({ pilot_id: 'quote-test', next_action: 'Contains # marker', date: '2026-05-18' });
const invalid = validate({ runtime: 'cursor', extra: 'bad' });
const sensitive = validate({ setup_friction: 'debug token=SHOULD_NOT_PRINT' });
const privateUrl = validate({ next_action: 'Review https://confluence.company.internal/pilot' });
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
const noRollupCli = spawnSync(path.join(repoRoot, 'scripts/forgeflow/record-pilot-evidence.js'), [
  '--project-dir',
  path.join(tmp, '.forgeflow', 'NoRollupCli'),
  '--pilot-id',
  'cli-no-rollup',
  '--runtime',
  'codex',
  '--no-rollup',
  '--json',
], { encoding: 'utf8' });
const sensitiveCli = spawnSync(path.join(repoRoot, 'scripts/forgeflow/record-pilot-evidence.js'), [
  '--project-dir',
  projectDir,
  '--set',
  'setup_friction=api_key=SHOULD_NOT_PRINT',
], { encoding: 'utf8' });
const cliJson = cliResult.status === 0 ? JSON.parse(cliResult.stdout) : {};
const noRollupCliJson = noRollupCli.status === 0 ? JSON.parse(noRollupCli.stdout) : {};

const checks = [
  ['writes evidence file', fs.existsSync(result.path)],
  ['refreshes rollup by default', result.rollup_path.endsWith('pilot-evidence-rollup.md') && rollupContent.includes('Pilot count: 1')],
  ['can skip rollup refresh', noRollupResult.rollup_path === ''],
  ['uses pilot evidence dir', result.path.endsWith(path.join('pilot-evidence', 'zach-codex-notes.yml'))],
  ['records chosen fields', content.includes('runtime: codex') && content.includes('project_type: docs-config')],
  ['keeps blank template fields', content.includes('maintainer:') && content.includes('review_minutes:')],
  ['defaults date and pilot id', defaultRecord.date.length === 10 && defaultRecord.pilot_id.includes('claude-code')],
  ['quotes unsafe yaml scalar', quotedYaml.includes('next_action: "Contains # marker"')],
  ['validates unknown and invalid choices', invalid.length === 2],
  ['validates sensitive content', sensitive.some((item) => item.includes('Potential sensitive content in setup_friction'))],
  ['validates private urls', privateUrl.some((item) => item.includes('Potential sensitive content in next_action'))],
  ['cli writes json result', cliResult.status === 0 && cliJson.record?.sharing_level === 'local-maintainer'],
  ['cli reports refreshed rollup', cliJson.rollup_path?.endsWith('pilot-evidence-rollup.md')],
  ['cli can skip rollup', noRollupCli.status === 0 && noRollupCliJson.rollup_path === ''],
  ['missing option value exits usage', missingValue.status === 2 && missingValue.stderr.includes('Missing value for --runtime')],
  ['invalid choice exits failure', invalidCli.status === 1 && invalidCli.stderr.includes('Invalid runtime: cursor')],
  ['sensitive cli fails redacted', sensitiveCli.status === 1 && sensitiveCli.stderr.includes('Potential sensitive content in setup_friction') && !sensitiveCli.stderr.includes('SHOULD_NOT_PRINT')],
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
