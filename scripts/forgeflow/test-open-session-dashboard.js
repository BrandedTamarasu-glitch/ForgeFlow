#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { openSessionDashboard, desktopAvailable, workflowFromPrompt, sessionId, probe, workflowState } = require('./open-session-dashboard');
const { createServer } = require('../../services/dashboard/server');

async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-dashboard-test-'));
  const env = { DISPLAY: ':fixture' };
  let starts = 0, opens = 0, activityStarts = 0;
  const reports = [];
  const options = { stateDir: path.join(temp, 'state'), session: 'session-one', env, platform: 'linux',
    workflow: 'plan', ensureActivity: async () => { activityStarts++; },
    report: async (state, label) => { reports.push({ state, label }); return true; },
    ensure: async () => { starts++; }, open: async () => { opens++; return true; } };
  try {
    const concurrent = await Promise.all(Array.from({ length: 8 }, () => openSessionDashboard(options)));
    assert.equal(concurrent.filter(result => result.status === 'opened').length, 1);
    assert.equal(starts, 8); assert.equal(activityStarts, 8); assert.equal(opens, 1);
    assert.equal(reports.length, 8);
    assert.ok(reports.every(report => report.state === 'planning'));
    assert.equal((await openSessionDashboard({ ...options, root: path.join(temp, 'another-project') })).status, 'already-attempted');
    assert.equal((await openSessionDashboard({ ...options, session: 'session-two' })).status, 'opened');
    assert.equal(starts, 10); assert.equal(activityStarts, 10); assert.equal(opens, 2);
    await openSessionDashboard({ ...options, workflow: 'review' });
    assert.equal(reports.at(-1).state, 'reviewing');
    assert.equal(opens, 2);
    const failure = { ...options, session: 'failed-session', ensure: async () => { throw new Error('occupied port'); } };
    assert.equal((await openSessionDashboard(failure)).status, 'unavailable');
    assert.equal((await openSessionDashboard(failure)).status, 'unavailable');
    assert.equal((await openSessionDashboard({ ...options, session: 'no-browser', open: async () => false })).status, 'browser-unavailable');
    const unavailableActivity = await openSessionDashboard({ ...options, session: 'activity-failed',
      ensureActivity: async () => { throw new Error('foreign listener'); } });
    assert.equal(unavailableActivity.status, 'opened');
    assert.match(unavailableActivity.warnings.join(' '), /Live activity unavailable/);
    const reportsBeforeUnknown = reports.length;
    await openSessionDashboard({ ...options, workflow: 'unknown-command' });
    assert.equal(reports.length, reportsBeforeUnknown);
    const rejectedReport = await openSessionDashboard({ ...options, report: async () => false });
    assert.equal(rejectedReport.status, 'already-attempted');
    assert.match(rejectedReport.warnings.join(' '), /did not accept/);
    for (const blocked of [{}, { DISPLAY: ':0', CI: 'true' }, { DISPLAY: ':0', SSH_CONNECTION: 'remote' }, { DISPLAY: ':0', FORGEFLOW_DASHBOARD_AUTO_OPEN: 'off' }]) {
      assert.equal(desktopAvailable(blocked, 'linux'), false);
      assert.equal((await openSessionDashboard({ ...options, session: 'skip', env: blocked })).status, 'skipped');
    }
    assert.equal((await openSessionDashboard({ ...options, session: '', env })).status, 'skipped');
    assert.equal(desktopAvailable({}, 'darwin'), true);
    assert.equal(desktopAvailable({}, 'win32'), true);
    assert.equal(sessionId({ CODEX_THREAD_ID: 'thread' }), 'thread');
    assert.equal(sessionId({ CLAUDE_SESSION_ID: 'session' }), 'session');
    assert.equal(sessionId({ FORGEFLOW_SESSION_ID: 'override', CODEX_THREAD_ID: 'thread' }), 'override');
    for (const prompt of ['/plan feature', '$forgeflow-review', '/Forgeflow:discuss an idea', '@quick fix']) assert.ok(workflowFromPrompt(prompt));
    for (const prompt of ['please explain forgeflow', 'review this later', '/planet', '/agent-chat:off', 'echo /plan', '/plan; rm']) assert.equal(workflowFromPrompt(prompt), '');
    assert.ok(fs.readdirSync(options.stateDir).length >= 3);
    assert.equal(workflowState('plan'), 'planning');
    assert.equal(workflowState('implement'), 'implementing');
    assert.equal(workflowState('not-a-workflow'), '');
    if (process.platform !== 'win32') {
      assert.equal(fs.statSync(options.stateDir).mode & 0o777, 0o700);
      for (const file of fs.readdirSync(options.stateDir)) assert.equal(fs.statSync(path.join(options.stateDir, file)).mode & 0o777, 0o600);
      fs.symlinkSync(options.stateDir, path.join(temp, 'linked-state'));
      await assert.rejects(openSessionDashboard({ ...options, stateDir: path.join(temp, 'linked-state') }), /Unsafe/);
    }
    const server = createServer({ projectRoot: temp, metricsRoots: [] });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const port = server.address().port;
    try {
      assert.equal(await probe(port, '/api/health', 'forgeflow-dashboard'), 'ready');
      assert.equal(await probe(port, '/', 'forgeflow-dashboard'), 'occupied');
    } finally { await new Promise(resolve => server.close(resolve)); }
    assert.equal(await probe(port, '/api/health', 'forgeflow-dashboard'), 'free');
    const foreign = http.createServer((_req, res) => res.end('{"service":"another-app"}'));
    await new Promise(resolve => foreign.listen(0, '127.0.0.1', resolve));
    try { assert.equal(await probe(foreign.address().port, '/api/health', 'forgeflow-dashboard'), 'occupied'); }
    finally { await new Promise(resolve => foreign.close(resolve)); }
    console.log('Dashboard auto-open: concurrent deduplication, new sessions, failures, headless opt-out, workflow detection, private markers, and service identity passed.');
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
