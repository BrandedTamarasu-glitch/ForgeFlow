#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { recordVerdict, metricsFileForCwd } = require('../../hooks/forgeflow-telemetry');
const { scanMetrics } = require('../../services/dashboard/metrics');
const { defaultMetricsRoots } = require('../../services/dashboard/server');
const { metricsRootForRuntime } = require('../../hooks/forgeflow-telemetry');
const { managedSources, codexSourceAllowed } = require('./install-manifest');

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-verdict-'));
  try {
    const cwd = path.join(dir, 'project');
    fs.mkdirSync(cwd);
    fs.writeFileSync(path.join(cwd, 'review.md'), 'Arbiter: CONDITIONAL APPROVE\nCompass: CONFIRM\n');
    const env = { ...process.env, FORGEFLOW_METRICS_ROOT: path.join(dir, 'metrics') };
    assert.deepEqual(defaultMetricsRoots(dir, {}), [path.join(dir, '.claude/projects'), path.join(dir, '.codex/projects')]);
    for (const settings of [{ HOME: dir }, { HOME: dir, CODEX_HOME: path.join(dir, 'custom-codex'), CLAUDE_HOME: path.join(dir, 'custom-claude') }, { HOME: dir, FORGEFLOW_METRICS_ROOT: path.join(dir, 'shared-metrics') }]) {
      const roots = defaultMetricsRoots(dir, settings);
      for (const runtime of ['codex', 'claude-code']) assert.ok(roots.includes(metricsRootForRuntime(runtime, settings)));
    }
    const outcome = { cwd, reviewer: 'arbiter', verdict: 'CONDITIONAL APPROVE', evidence: 'review.md', event_id: 'review-1-arbiter', session_id: 'real-fixture-session', command: '/review' };
    const attempts = await Promise.all(Array.from({ length: 5 }, () => recordVerdict(outcome, env)));
    assert.equal(attempts.reduce((total, result) => total + result.recorded, 0), 1);
    assert.equal(attempts.filter(result => result.duplicate).length, 4);
    await assert.rejects(recordVerdict({ ...outcome, verdict: 'BLOCK' }, env), /different outcome/);
    for (const patch of [{ reviewer: 'smith' }, { verdict: 'CONFIRM' }, { verdict: 'APPROVED' }, { event_id: '' }, { session_id: '' }, { command: 'review' }, { evidence: '' }, { evidence: 'missing.md' }]) {
      await assert.rejects(recordVerdict({ ...outcome, ...patch }, env));
    }
    fs.writeFileSync(path.join(dir, 'outside.md'), 'outside');
    await assert.rejects(recordVerdict({ ...outcome, evidence: '../outside.md' }, env), /inside the project/);
    const cli = spawnSync(process.execPath, [path.resolve(__dirname, '../../hooks/forgeflow-telemetry.js'), 'record-verdict', '--cwd', cwd, '--reviewer', 'compass', '--verdict', 'CONFIRM', '--evidence', 'review.md', '--event-id', 'review-1-compass', '--session', 'real-fixture-session', '--command', '/review'], { env, encoding: 'utf8' });
    assert.equal(cli.status, 0, cli.stderr);
    assert.equal(JSON.parse(cli.stdout).recorded, 1);
    const file = metricsFileForCwd(cwd, 'codex', env);
    const lines = fs.readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(lines.length, 2);
    assert.equal(lines[0].runtime, 'codex');
    assert.equal(lines[0].detail.evidence, 'review.md');
    const metrics = await scanMetrics(env.FORGEFLOW_METRICS_ROOT);
    assert.equal(metrics.projects.length, 1);
    assert.equal(metrics.projects[0].verdicts.arbiter['CONDITIONAL APPROVE'], 1);
    assert.equal(metrics.projects[0].verdicts.compass.CONFIRM, 1);
    assert.equal(metrics.verdicts.length, 1);
    assert.match(metrics.verdicts[0].week, /^\d{4}-W\d{2}$/);
    assert.equal(metrics.verdicts[0].arbiter['CONDITIONAL APPROVE'], 1);
    assert.equal(metrics.verdicts[0].compass.CONFIRM, 1);
    const root = path.resolve(__dirname, '../..');
    assert.ok(managedSources(root, 'codex').includes('hooks/forgeflow-telemetry.js'));
    assert.ok(codexSourceAllowed('hooks/forgeflow-telemetry.js'));
    assert.equal(codexSourceAllowed('hooks/other-hook.js'), false);
    console.log('Explicit verdicts: concurrent deduplication, invalid/conflicting outcomes, saved evidence, CLI, Codex inventory and dashboard weekly aggregation passed.');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
