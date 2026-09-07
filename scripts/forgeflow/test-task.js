#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { installTemplate } = require('./install-template');

async function main() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-task-installed-'));
  const root = path.join(base, 'project'); fs.mkdirSync(root);
  const env = { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.invalid' };
  function run(command, args, cwd = root) {
    const result = spawnSync(command, args, { cwd, env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.error?.message); return result.stdout;
  }
  try {
    run('git', ['init', '-q']);
    fs.writeFileSync(path.join(root, 'source.js'), 'module.exports = 42;\n');
    fs.writeFileSync(path.join(root, '.gitignore'), '.forgeflow/\n');
    run('git', ['add', 'source.js', '.gitignore']); run('git', ['commit', '-qm', 'fixture']);
    const claudeHome = path.join(base, 'claude'), codexHome = path.join(base, 'codex');
    installTemplate({ target: 'both', claudeHome, codexHome });
    for (const [host, home] of [['claude', claudeHome], ['codex', codexHome]]) {
      const runtime = path.join(home, 'forgeflow');
      for (const file of ['task-store.js', 'task.js', 'task-evaluation.js', 'task-memory.js', 'task-maintenance.js', 'fleet-environment.js']) assert.ok(fs.existsSync(path.join(runtime, 'scripts/forgeflow', file)), file);
      assert.ok(fs.existsSync(path.join(runtime, 'services/dashboard/tasks.js')));
      assert.ok(fs.existsSync(host === 'claude' ? path.join(home, 'commands/task.md') : path.join(home, 'skills/task/SKILL.md')));
      const cli = path.join(runtime, 'scripts/forgeflow/task.js');
      const inputFile = path.join(base, `${host}-input.json`);
      const call = (action, input) => {
        fs.writeFileSync(inputFile, JSON.stringify(input));
        return JSON.parse(run(process.execPath, [cli, action, '--root', root, '--task', host, '--input', inputFile]));
      };
      assert.equal(call('start', { id: host, objective: 'Installed task behavior', criteria: [{ id: 'answer', description: 'Source returns 42' }] }).counts.missing, 1);
      const check = call('check', { event_id: 'answer-check', criterion_ids: ['answer'], command: [process.execPath, '-e', "require('assert/strict').equal(require('./source'),42)"] });
      assert.equal(check.counts.verified, 1);
      assert.equal(call('checkpoint', { event_id: 'finish', phase: 'review', state: 'complete', note: 'Installed behavior verified', session: { host, id: 'fixture-session' } }).status, 'complete');
      const hookFile = host === 'claude' ? path.join(home, 'hooks/forgeflow-telemetry.js') : path.join(runtime, 'hooks/forgeflow-telemetry.js');
      const hook = require(hookFile);
      const proof = check.evidence[0].artifact.path;
      const event = { cwd: root, reviewer: 'arbiter', verdict: 'APPROVE', evidence: proof, event_id: `${host}-review`, session_id: 'fixture-session', command: '/review' };
      const metricsEnv = { ...env, FORGEFLOW_METRICS_ROOT: path.join(base, 'metrics', host) };
      await hook.recordVerdict(event, metricsEnv);
      const line = JSON.parse(fs.readFileSync(hook.metricsFileForCwd(root, 'codex', metricsEnv), 'utf8').trim());
      assert.equal(line.provenance.status, 'captured'); assert.ok(line.provenance.source.head); assert.match(line.provenance.artifact.sha256, /^[a-f0-9]{64}$/);
      fs.appendFileSync(path.join(root, proof), 'changed');
      await assert.rejects(hook.recordVerdict(event, metricsEnv), /different evidence/);
    }
    const bad = spawnSync(process.execPath, [path.join(__dirname, 'task.js'), 'start', '--bogus'], { cwd: root, encoding: 'utf8' });
    assert.equal(bad.status, 1);
    console.log('Both installed hosts: task lifecycle, checks, provenance, evidence replacement and CLI validation passed.');
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
