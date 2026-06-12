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

console.log('forgeflow telemetry hook: ok');
