#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { assertSafeDirectory, assertSafeDestination, safeReadTextFile, writeFileSafe } = require('./file-safety');

function hookCommand(home) {
  const file = path.join(home, 'hooks', 'forgeflow-lean-activate.js').replace(/\\/g, '/');
  if (/[\r\n\0%]/.test(file)) throw new Error('Unsupported hook path; register the hook manually');
  return `node "${file.replace(/["$`]/g, '\\$&')}"`;
}
function readSettings(home) {
  assertSafeDirectory(home);
  const file = path.join(home, 'settings.json');
  try {
    if (fs.lstatSync(file).size > 1024 * 1024) throw new Error('Settings file exceeds setup limit');
    const original = safeReadTextFile(file, home).content;
    const settings = JSON.parse(original);
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('Invalid settings');
    return { file, original, settings };
  } catch (error) { if (error.code === 'ENOENT') return { file, original: null, settings: {} }; throw error; }
}
function configureHook(home, dryRun) {
  const { file, original, settings } = readSettings(home);
  if (settings.disableAllHooks === true || settings.env?.FORGEFLOW_DASHBOARD_AUTO_OPEN === 'off') return 'disabled';
  const command = hookCommand(home);
  if (settings.hooks !== undefined && (!settings.hooks || typeof settings.hooks !== 'object' || Array.isArray(settings.hooks))) throw new Error('Invalid hooks setting');
  const hooks = settings.hooks || {};
  const entries = hooks.UserPromptSubmit || [];
  if (!Array.isArray(entries)) throw new Error('Invalid UserPromptSubmit setting');
  if (entries.some(entry => entry.hooks?.some(hook => hook.type === 'command' && hook.command === command))) return 'ready';
  if (dryRun) return 'would-register';
  const hook = path.join(home, 'hooks', 'forgeflow-lean-activate.js');
  assertSafeDirectory(path.dirname(hook)); safeReadTextFile(hook, home);
  const updated = { ...settings, hooks: { ...hooks, UserPromptSubmit: [...entries, { hooks: [{ type: 'command', command, timeout: 10 }] }] } };
  if (original !== null) {
    const backup = path.join(home, 'forgeflow', 'backups', `settings-before-ember-${crypto.createHash('sha256').update(original).digest('hex').slice(0, 16)}.json`);
    if (!fs.existsSync(backup)) writeFileSafe(backup, original, { mode: 0o600 });
  }
  const temp = path.join(home, `.ember-settings-${crypto.randomBytes(8).toString('hex')}.tmp`);
  writeFileSafe(temp, JSON.stringify(updated, null, 2) + '\n', { mode: 0o600 });
  try {
    const current = readSettings(home);
    if (current.original !== original) throw new Error('Settings changed during setup; retry');
    assertSafeDestination(file);
    fs.renameSync(temp, file);
  } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
  return 'registered';
}
function dependencyReady(dir) {
  try {
    assertSafeDirectory(dir);
    const lock = JSON.parse(safeReadTextFile(path.join(dir, 'package-lock.json'), dir).content);
    const expected = lock.packages?.['node_modules/ws']?.version;
    const installed = JSON.parse(safeReadTextFile(path.join(dir, 'node_modules', 'ws', 'package.json'), dir).content);
    if (!expected || expected !== installed.version) return false;
    const entry = path.join(dir, 'node_modules', 'ws', 'index.js');
    safeReadTextFile(entry, dir);
    const loaded = spawnSync(process.execPath, ['-e', 'require(process.argv[1])', entry], { encoding: 'utf8', timeout: 5000, maxBuffer: 65536 });
    return !loaded.error && loaded.status === 0;
  } catch (_) { return false; }
}
function setupEmber(options = {}) {
  const { home, target, dryRun = false } = options;
  if (!home || !['claude', 'codex'].includes(target)) throw new Error('Choose a runtime home and target');
  const env = options.env || process.env;
  const checks = [];
  let disabled = env.FORGEFLOW_DASHBOARD_AUTO_OPEN === 'off';
  if (target === 'claude') {
    try { const s = readSettings(home).settings; disabled ||= s.disableAllHooks === true || s.env?.FORGEFLOW_DASHBOARD_AUTO_OPEN === 'off'; }
    catch (_) { checks.push({ name: 'Claude settings', status: 'warning', action: 'Repair settings.json; it was left unchanged.' }); }
  }
  if (disabled) return { status: 'disabled', checks, action: 'Dashboard opt-out preserved; local Forgeflow workflows remain available.' };
  for (const service of ['dashboard', 'agent-chat']) {
    const dir = path.join(home, 'forgeflow', 'services', service);
    let ready = dependencyReady(dir);
    if (!ready && !dryRun) {
      try {
        assertSafeDirectory(dir);
        safeReadTextFile(path.join(dir, 'package.json'), dir);
        safeReadTextFile(path.join(dir, 'package-lock.json'), dir);
        assertSafeDirectory(path.join(dir, 'node_modules'));
        const run = options.run || spawnSync;
        const result = run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], {
          cwd: dir, encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024, shell: process.platform === 'win32', env,
        });
        ready = !result.error && result.status === 0 && dependencyReady(dir);
      } catch (_) { /* Optional dashboard setup cannot block the core installation. */ }
    }
    checks.push({ name: `${service} dependencies`, status: ready ? 'ready' : dryRun ? 'would-install' : 'warning',
      ...(!ready ? { action: `Run npm ci --ignore-scripts --no-audit --no-fund in ${dir}, then rerun Ember setup.` } : {}) });
  }
  if (target === 'claude') {
    try { checks.push({ name: 'Claude prompt hook', status: configureHook(home, dryRun) }); }
    catch (_) { checks.push({ name: 'Claude prompt hook', status: 'warning', action: 'Check settings.json and the installed lean activation hook; existing settings were preserved.' }); }
  } else {
    const skill = path.join(home, 'skills', 'quick', 'SKILL.md');
    let ready = false;
    try { ready = safeReadTextFile(skill, home).content.includes('open-session-dashboard.js'); } catch (_) { /* Incomplete runtime. */ }
    checks.push({ name: 'Codex workflow entry', status: ready ? 'ready' : dryRun ? 'would-check' : 'warning', action: 'Restart Codex after installation so it discovers updated workflow skills.' });
  }
  return { status: checks.some(c => c.status === 'warning') ? 'attention' : dryRun ? 'preview' : 'ready', checks,
    action: 'Run ember-setup.js --check for live ports and desktop readiness. Restart the host after hook or skill changes.' };
}
function portOwner(port, run = spawnSync, platform = process.platform) {
  try {
    const command = platform === 'linux' ? 'ss' : platform === 'win32' ? 'netstat' : 'lsof';
    const args = platform === 'linux' ? ['-ltnp', `sport = :${port}`] : platform === 'win32' ? ['-ano', '-p', 'tcp'] : ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fpc'];
    const result = run(command, args, { encoding: 'utf8', timeout: 2000, maxBuffer: 65536 });
    if (result.error || result.status !== 0) return null;
    const output = result.stdout || '';
    if (platform === 'linux') {
      const match = output.match(/"([^"\n]+)",pid=(\d+)/);
      return match ? { process: match[1], pid: Number(match[2]) } : null;
    }
    if (platform === 'win32') {
      const match = output.split('\n').find(line => new RegExp(`:${port}\\s`).test(line) && /LISTENING/.test(line));
      const pid = match?.trim().split(/\s+/).at(-1);
      return pid && /^\d+$/.test(pid) ? { pid: Number(pid) } : null;
    }
    const pid = output.match(/^p(\d+)$/m), name = output.match(/^c(.+)$/m);
    return pid ? { pid: Number(pid[1]), process: name?.[1] || 'unknown' } : null;
  } catch (_) { return null; }
}
async function inspectEmber(options) {
  const report = setupEmber({ ...options, dryRun: true });
  const { desktopAvailable, probe } = require('./open-session-dashboard');
  const desktop = desktopAvailable(options.env || process.env);
  report.checks.push({ name: 'Local desktop', status: desktop ? 'ready' : 'skipped', action: desktop ? 'If the browser cannot launch, open http://127.0.0.1:4003/ manually.' : 'Automatic opening is skipped in headless, CI, SSH, or opted-out sessions.' });
  let activityPid;
  for (const [port, endpoint, service] of [[4003, '/api/health', 'forgeflow-dashboard'], [4001, '/health', 'forgeflow-agent-chat'], [4000, '/', 'forgeflow-agent-chat']]) {
    const status = await (options.probe || probe)(port, endpoint, service, identity => { if (port === 4001) activityPid = identity.pid; });
    const owner = status === 'occupied' ? (options.portOwner || portOwner)(port) : null;
    // Port 4000 is WebSocket-only; match its actual owner to the HTTP identity.
    const knownAgent = port === 4000 && status === 'occupied' && owner?.pid === activityPid && Boolean(activityPid);
    report.checks.push({ name: `Port ${port}`, ...(owner ? { owner } : {}), status: knownAgent ? 'service-listening' : status,
      action: status === 'occupied' && !knownAgent ? 'Identify the listener with lsof -nP -iTCP:' + port + ' -sTCP:LISTEN (Windows: netstat -ano). Stop it only with user permission; Ember never terminates other applications.' : status === 'free' ? 'Available; the next workflow can start this service.' : 'Service is responding.' });
  }
  report.status = report.status === 'disabled' ? 'disabled' : report.checks.some(c => ['warning', 'would-install', 'would-register', 'would-check', 'occupied'].includes(c.status)) ? 'attention' : 'ready';
  return report;
}
async function main() {
  const options = { target: 'claude' }; let check = false;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--check') check = true;
    else if (args[i] === '--dry-run') options.dryRun = true;
    else if (['--home', '--target'].includes(args[i]) && args[i + 1]) options[args[i].slice(2)] = args[++i];
    else throw new Error('Usage: ember-setup.js [--target claude|codex] [--home <runtime-home>] [--check|--dry-run]');
  }
  options.home ||= path.join(os.homedir(), '.' + options.target);
  console.log(JSON.stringify(check ? await inspectEmber(options) : setupEmber(options), null, 2));
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { setupEmber, inspectEmber, dependencyReady, configureHook, hookCommand, portOwner };
