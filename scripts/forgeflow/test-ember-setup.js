#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { setupEmber, inspectEmber, hookCommand, portOwner } = require('./ember-setup');
const { installTemplate } = require('./install-template');
const { updateForgeflow } = require('./update-forgeflow');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-ember-setup-'));
const repo = path.resolve(__dirname, '../..');
let runs = 0;
function npmFixture(command, args, options) {
  runs++;
  assert.ok(['npm', 'npm.cmd'].includes(command));
  assert.deepEqual(args, ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
  assert.equal(options.timeout, 120000);
  const dest = path.join(options.cwd, 'node_modules', 'ws');
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(path.join(repo, 'node_modules', 'ws'), dest, { recursive: true });
  return { status: 0 };
}
function fixture(name) {
  const home = path.join(temp, name);
  fs.mkdirSync(path.join(home, 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(home, 'hooks', 'forgeflow-lean-activate.js'), '// fixture\n');
  for (const service of ['dashboard', 'agent-chat']) {
    const dir = path.join(home, 'forgeflow', 'services', service); fs.mkdirSync(dir, { recursive: true });
    for (const file of ['package.json', 'package-lock.json']) fs.copyFileSync(path.join(repo, 'services', service, file), path.join(dir, file));
  }
  fs.mkdirSync(path.join(home, 'skills', 'quick'), { recursive: true });
  fs.writeFileSync(path.join(home, 'skills', 'quick', 'SKILL.md'), 'Run open-session-dashboard.js on entry.');
  return home;
}
const setup = opts => setupEmber({ env: {}, run: npmFixture, ...opts });
async function main() {
  const home = fixture('claude');
  const settings = { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'my-session-hook' }] }], UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'my-prompt-hook' }] }] }, permissions: { allow: ['Read'] } };
  const settingsFile = path.join(home, 'settings.json'); fs.writeFileSync(settingsFile, JSON.stringify(settings));
  assert.equal(setup({ home, target: 'claude', dryRun: true }).status, 'preview');
  assert.equal(runs, 0); assert.deepEqual(JSON.parse(fs.readFileSync(settingsFile)), settings);
  assert.equal(setup({ home, target: 'claude' }).status, 'ready');
  assert.equal(runs, 2);
  const updated = JSON.parse(fs.readFileSync(settingsFile));
  assert.deepEqual(updated.permissions, settings.permissions);
  assert.deepEqual(updated.hooks.SessionStart, settings.hooks.SessionStart);
  assert.deepEqual(updated.hooks.UserPromptSubmit[0], settings.hooks.UserPromptSubmit[0]);
  assert.equal(updated.hooks.UserPromptSubmit[1].hooks[0].command, hookCommand(home));
  assert.ok(fs.readdirSync(path.join(home, 'forgeflow', 'backups')).some(x => x.startsWith('settings-before-ember-')));
  setup({ home, target: 'claude' }); assert.equal(runs, 2);
  assert.equal(JSON.parse(fs.readFileSync(settingsFile)).hooks.UserPromptSubmit.length, 2);
  fs.writeFileSync(path.join(home, 'forgeflow/services/dashboard/node_modules/ws/package.json'), '{"version":"0.0.0"}');
  setup({ home, target: 'claude' }); assert.equal(runs, 3);
  const off = fixture('off'); fs.writeFileSync(path.join(off, 'settings.json'), '{"env":{"FORGEFLOW_DASHBOARD_AUTO_OPEN":"off"}}');
  assert.equal(setup({ home: off, target: 'claude' }).status, 'disabled'); assert.equal(runs, 3);
  assert.equal(setup({ home: off, target: 'codex', env: { FORGEFLOW_DASHBOARD_AUTO_OPEN: 'off' } }).status, 'disabled');
  const invalid = fixture('invalid'); fs.writeFileSync(path.join(invalid, 'settings.json'), 'broken');
  assert.equal(setup({ home: invalid, target: 'claude', run: () => ({ status: 1 }) }).status, 'attention');
  assert.equal(fs.readFileSync(path.join(invalid, 'settings.json'), 'utf8'), 'broken');
  assert.equal(setup({ home: fixture('no-npm'), target: 'codex', run: () => ({ error: { code: 'ENOENT' } }) }).status, 'attention');
  const sym = fixture('symlink'); fs.symlinkSync(settingsFile, path.join(sym, 'settings.json'));
  const before = fs.readFileSync(settingsFile, 'utf8'); setup({ home: sym, target: 'claude' });
  assert.equal(fs.readFileSync(settingsFile, 'utf8'), before);
  const preview = path.join(temp, 'not-created'); setup({ home: preview, target: 'claude', dryRun: true }); assert.equal(fs.existsSync(preview), false);
  const checked = await inspectEmber({ home, target: 'claude', env: {}, probe: async port => port === 4003 ? 'occupied' : 'free' });
  assert.equal(checked.status, 'attention'); assert.equal(checked.checks.find(c => c.name === 'Local desktop').status, 'skipped');
  assert.match(checked.checks.find(c => c.name === 'Port 4003').action, /user permission/);
  assert.deepEqual(portOwner(4000, () => ({ status: 0, stdout: 'users:(("node",pid=42,fd=3))' }), 'linux'), { process: 'node', pid: 42 });
  assert.deepEqual(portOwner(4000, () => ({ status: 0, stdout: 'p42\ncnode\n' }), 'darwin'), { process: 'node', pid: 42 });
  assert.deepEqual(portOwner(4000, () => ({ status: 0, stdout: 'TCP 127.0.0.1:4000 0.0.0.0:0 LISTENING 42' }), 'win32'), { pid: 42 });
  assert.equal(portOwner(4000, () => ({ error: { code: 'EPERM' } }), 'linux'), null);
  const liveProbe = async (port, endpoint, service, identity) => {
    if (port === 4001) { identity({ pid: 42 }); return 'ready'; }
    return port === 4000 ? 'occupied' : 'ready';
  };
  const recognized = await inspectEmber({ home, target: 'claude', env: { DISPLAY: ':fixture' }, probe: liveProbe, portOwner: () => ({ pid: 42 }) });
  assert.equal(recognized.checks.find(c => c.name === 'Port 4000').status, 'service-listening');
  const unrelated = await inspectEmber({ home, target: 'claude', env: { DISPLAY: ':fixture' }, probe: liveProbe, portOwner: () => ({ pid: 99 }) });
  assert.equal(unrelated.checks.find(c => c.name === 'Port 4000').status, 'occupied');
  const installed = installTemplate({ target: 'both', claudeHome: path.join(temp, 'fresh-claude'), codexHome: path.join(temp, 'fresh-codex'), emberSetup: setup });
  assert.ok(installed.results.every(r => r.ember.status === 'ready'));
  for (const result of installed.results) for (const service of ['dashboard', 'agent-chat']) {
    assert.ok(fs.existsSync(require.resolve('ws', { paths: [path.join(result.home, 'forgeflow/services', service)] })));
  }
  const sha = '1'.repeat(40); let configured = 0;
  const current = await updateForgeflow({ home, target: 'claude', current: sha, latest: sha, missingRequired: [], emberSetup: opts => { configured++; assert.equal(opts.home, home); return { status: 'ready', checks: [] }; } });
  assert.equal(current.status, 'up-to-date'); assert.equal(configured, 1);
  const upgrade = await updateForgeflow({ home: path.join(temp, 'upgrade'), target: 'claude', current: '', latest: sha, missingRequired: [], plan: { files: ['scripts/forgeflow/health-check.js'], deleted: [], firstRun: true }, fetcher: async () => '// fixture', emberSetup: opts => { configured++; return { status: 'attention', checks: [] }; } });
  assert.equal(upgrade.status, 'updated'); assert.equal(upgrade.version_written, true); assert.equal(configured, 2);
  console.log('Ember setup: fresh installs, upgrade repair, dependencies, custom hooks, opt-out, previews, failure isolation, and readiness passed.');
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => fs.rmSync(temp, { recursive: true, force: true }));
