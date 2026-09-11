#!/usr/bin/env node
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  metricsFileForCwd,
  metricsRootForRuntime,
  normalizeRuntime,
  recordEvents,
} = require('../../hooks/forgeflow-telemetry');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-telemetry-hook-'));
const env = {
  HOME: tmp,
  CLAUDE_HOME: path.join(tmp, 'claude-home'),
  CODEX_HOME: path.join(tmp, 'codex-home'),
};
const cwd = '/home/user/Projects/demo';

assert.equal(normalizeRuntime('codex'), 'codex');
assert.equal(normalizeRuntime('claude'), 'claude-code');
assert.equal(metricsRootForRuntime('claude-code', env), path.join(env.CLAUDE_HOME, 'projects'));
assert.equal(metricsRootForRuntime('codex', env), path.join(env.CODEX_HOME, 'projects'));
assert.equal(
  metricsFileForCwd(cwd, 'codex', env),
  path.join(env.CODEX_HOME, 'projects', '-home-user-Projects-demo', 'memory', 'forgeflow-metrics.jsonl')
);

const claudeResult = recordEvents({
  cwd,
  session_id: 'claude-session',
  tool_name: 'Agent',
  tool_input: { subagent_type: 'arbiter-reviewer' },
  tool_output: 'Arbiter Verdict: APPROVE',
}, env);
assert.equal(claudeResult.runtime, 'claude-code');
assert.equal(claudeResult.recorded, 1);
assert.ok(fs.existsSync(claudeResult.metrics_file));
const claudeRecord = JSON.parse(fs.readFileSync(claudeResult.metrics_file, 'utf8').trim());
assert.equal(claudeRecord.runtime, 'claude-code');
assert.equal(claudeRecord.detail.verdict, 'APPROVE');

const codexResult = recordEvents({
  runtime: 'codex',
  cwd,
  session_id: 'codex-session',
  tool_name: 'Agent',
  tool_input: { subagent_type: 'arbiter-reviewer' },
  tool_output: 'Final Verdict: REVISE',
}, env);
assert.equal(codexResult.runtime, 'codex');
assert.equal(codexResult.recorded, 1);
assert.ok(codexResult.metrics_file.includes(path.join('codex-home', 'projects')));
const codexRecord = JSON.parse(fs.readFileSync(codexResult.metrics_file, 'utf8').trim());
assert.equal(codexRecord.runtime, 'codex');
assert.equal(codexRecord.detail.verdict, 'REVISE');

const overrideRoot = path.join(tmp, 'custom-metrics');
const overrideResult = recordEvents({
  cwd,
  session_id: 'override-session',
  tool_name: 'Bash',
  tool_input: { command: 'git commit -m "chore(auto-fix): round 2"' },
  tool_output: '',
}, { ...env, FORGEFLOW_RUNTIME: 'codex', FORGEFLOW_METRICS_ROOT: overrideRoot });
assert.equal(overrideResult.runtime, 'codex');
assert.equal(overrideResult.recorded, 1);
assert.ok(overrideResult.metrics_file.startsWith(overrideRoot + path.sep));


const { detectEvents } = require('../../hooks/forgeflow-telemetry');
for (const name of ['Architect', 'Arbiter']) {
  assert.equal(detectEvents('Agent', {}, name + ' Verdict: APPROVE')[0].detail.reviewer, 'architect');
}
for (const name of ['Product Lead', 'Compass']) {
  assert.equal(detectEvents('Agent', {}, name + ' Final Verdict: CONFIRM')[0].detail.reviewer, 'product_lead');
}
for (const name of ['smith-implement', 'builder-implement', 'smith_implementer', 'builder_implementer']) {
  const event = detectEvents('Agent', { subagent_type: name }, 'SUCCESS: Fixed')[0];
  assert.match(event.detail.agent, /^builder[-_]implement/);
}
assert.equal(detectEvents('Agent', {}, '- REVIEWER: fc | CLASS: data | FINDING: Safe')[0].detail.overturned_reviewer, 'builder');

// A new-only install must trigger the gate, and old verdict headings still work.
const { spawnSync } = require('child_process');
const gateProject = path.join(tmp, 'gate-project');
fs.mkdirSync(path.join(gateProject, '.claude', 'agents'), { recursive: true });
fs.writeFileSync(path.join(gateProject, '.claude', 'agents', 'architect-review.md'), 'fixture');
for (const name of ['Architect', 'Arbiter']) {
  const session = `rename-gate-${process.pid}-${name}`;
  const stateFile = path.join(os.tmpdir(), `forgeflow-${session}.json`);
  try {
    const gate = spawnSync(process.execPath, [path.resolve(__dirname, '../../hooks/forgeflow-gate.js')], {
      encoding: 'utf8',
      env: { ...process.env, HOME: tmp },
      input: JSON.stringify({ cwd: gateProject, session_id: session, tool_name: 'Agent', tool_output: { content: `${name} Verdict: APPROVE` } }),
    });
    assert.equal(gate.status, 0, gate.stderr);
    assert.equal(JSON.parse(fs.readFileSync(stateFile, 'utf8')).reviewRun, true);
  } finally {
    fs.rmSync(stateFile, { force: true });
  }
}

// A partial install still records hook events without guessing role aliases.
const isolatedHook = path.join(tmp, 'isolated', 'forgeflow-telemetry.js');
fs.mkdirSync(path.dirname(isolatedHook));
fs.copyFileSync(path.resolve(__dirname, '../../hooks/forgeflow-telemetry.js'), isolatedHook);
const isolatedMetrics = path.join(tmp, 'isolated-metrics');
const partial = spawnSync(process.execPath, [isolatedHook], {
  encoding: 'utf8', env: { ...process.env, FORGEFLOW_METRICS_ROOT: isolatedMetrics },
  input: JSON.stringify({ cwd: gateProject, session_id: 'partial-install', tool_name: 'Agent',
    tool_input: { subagent_type: 'smith-implement' }, tool_output: 'SUCCESS: Fixed' }),
});
assert.equal(partial.status, 0, partial.stderr);
const partialFile = metricsFileForCwd(gateProject, 'claude-code', { FORGEFLOW_METRICS_ROOT: isolatedMetrics });
assert.equal(JSON.parse(fs.readFileSync(partialFile, 'utf8').trim()).detail.agent, 'smith-implement');
const explicitPartial = spawnSync(process.execPath, [isolatedHook, 'record-verdict'], { encoding: 'utf8' });
assert.equal(explicitPartial.status, 1);
assert.match(explicitPartial.stderr, /catalog is missing.*Repair the Forgeflow installation/);

console.log('forgeflow telemetry hook: ok');
