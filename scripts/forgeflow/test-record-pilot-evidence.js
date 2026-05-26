#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildRecord,
  normalizeChoice,
  parseArgs,
  recordPilotEvidence,
  renderYaml,
  validate,
} = require('./record-pilot-evidence');

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
    project_intelligence_readiness: 'needs_refresh',
    living_project_map_status: 'not useful',
    agent_feedback_signal: 'corrective',
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
const invalidState = validate({
  project_intelligence_readiness: 'stale',
  living_project_map_status: 'maybe',
  agent_feedback_signal: 'mixed',
});
const invalidFalsyState = validate({
  project_intelligence_readiness: 0,
  living_project_map_status: false,
  agent_feedback_signal: null,
});
const invalidWhitespaceState = validate({
  project_intelligence_readiness: '   ',
  living_project_map_status: '\t',
  agent_feedback_signal: '\n',
});
const sensitive = validate({ setup_friction: 'debug token=SHOULD_NOT_PRINT' });
const privateUrl = validate({ next_action: 'Review https://confluence.company.internal/pilot' });
const invalidPrivateRuntime = validate({ runtime: 'https://buildserver' });
let cliResult = { status: 0 };
let cliJson = {};
try {
  const opts = parseArgs([
  '--project-dir',
  projectDir,
  '--pilot-id',
  'cli-pilot',
  '--set',
  'sharing_level=local-maintainer',
  '--json',
  ], { exitOnError: false });
  cliJson = recordPilotEvidence(opts);
} catch (err) {
  cliResult = { status: err.exitCode || 1, stderr: err.message };
}
let missingValue = { status: 0, stderr: '' };
try {
  parseArgs(['--runtime'], { exitOnError: false });
} catch (err) {
  missingValue = { status: err.exitCode || 1, stderr: err.message };
}
let invalidCli = { status: 0, stderr: '' };
try {
  const opts = parseArgs([
    '--project-dir',
    projectDir,
    '--runtime',
    'cursor',
  ], { exitOnError: false });
  recordPilotEvidence(opts);
} catch (err) {
  invalidCli = { status: err.exitCode || 1, stderr: err.message };
}
let noRollupCli = { status: 0 };
let noRollupCliJson = {};
try {
  const opts = parseArgs([
  '--project-dir',
  path.join(tmp, '.forgeflow', 'NoRollupCli'),
  '--pilot-id',
  'cli-no-rollup',
  '--runtime',
  'codex',
  '--no-rollup',
  '--json',
  ], { exitOnError: false });
  noRollupCliJson = recordPilotEvidence(opts);
} catch (err) {
  noRollupCli = { status: err.exitCode || 1, stderr: err.message };
}
let sensitiveCli = { status: 0, stderr: '' };
try {
  const opts = parseArgs([
    '--project-dir',
    projectDir,
    '--set',
    'setup_friction=api_key=SHOULD_NOT_PRINT',
  ], { exitOnError: false });
  recordPilotEvidence(opts);
} catch (err) {
  sensitiveCli = { status: err.exitCode || 1, stderr: err.errors ? err.errors.join('\n') : err.message };
}

const checks = [
  ['writes evidence file', fs.existsSync(result.path)],
  ['refreshes rollup by default', result.rollup_path.endsWith('pilot-evidence-rollup.md') && rollupContent.includes('Pilot count: 1')],
  ['can skip rollup refresh', noRollupResult.rollup_path === ''],
  ['uses pilot evidence dir', result.path.endsWith(path.join('pilot-evidence', 'zach-codex-notes.yml'))],
  ['records chosen fields', content.includes('runtime: codex') && content.includes('project_type: docs-config')],
  ['normalizes state-aware fields', content.includes('project_intelligence_readiness: needs-refresh') && content.includes('living_project_map_status: not-useful') && content.includes('agent_feedback_signal: incorrect') && result.record.project_intelligence_readiness === 'needs-refresh'],
  ['keeps blank template fields', content.includes('maintainer:') && content.includes('review_minutes:')],
  ['normalizes common aliases', normalizeChoice('project_intelligence_readiness', 'PASS') === 'ready' && normalizeChoice('living_project_map_status', 'helpful') === 'useful' && normalizeChoice('agent_feedback_signal', 'bad') === 'negative'],
  ['defaults date and pilot id', defaultRecord.date.length === 10 && defaultRecord.pilot_id.includes('claude-code')],
  ['quotes unsafe yaml scalar', quotedYaml.includes('next_action: "Contains # marker"')],
  ['validates unknown and invalid choices', invalid.length === 2],
  ['validates invalid state-aware choices', invalidState.length === 3 && invalidState.every((item) => item.startsWith('Invalid '))],
  ['validates falsy non-string state-aware choices', invalidFalsyState.length === 2 && invalidFalsyState.includes('Invalid project_intelligence_readiness') && invalidFalsyState.includes('Invalid living_project_map_status')],
  ['validates whitespace-only state-aware choices', invalidWhitespaceState.length === 3 && invalidWhitespaceState.every((item) => item.startsWith('Invalid '))],
  ['validates sensitive content', sensitive.some((item) => item.includes('Potential sensitive content in setup_friction'))],
  ['validates private urls', privateUrl.some((item) => item.includes('Potential sensitive content in next_action'))],
  ['invalid enum values are redacted', invalidPrivateRuntime.some((item) => item === 'Invalid runtime') && invalidPrivateRuntime.some((item) => item.includes('Potential sensitive content in runtime')) && !invalidPrivateRuntime.join('\n').includes('buildserver')],
  ['cli writes json result', cliResult.status === 0 && cliJson.record?.sharing_level === 'local-maintainer'],
  ['cli reports refreshed rollup', cliJson.rollup_path?.endsWith('pilot-evidence-rollup.md')],
  ['cli can skip rollup', noRollupCli.status === 0 && noRollupCliJson.rollup_path === ''],
  ['missing option value exits usage', missingValue.status === 2 && missingValue.stderr.includes('Missing value for --runtime')],
  ['invalid choice exits failure', invalidCli.status === 1 && invalidCli.stderr.includes('Invalid runtime') && !invalidCli.stderr.includes('cursor')],
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
