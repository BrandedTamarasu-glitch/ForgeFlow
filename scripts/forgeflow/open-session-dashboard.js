#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn } = require('node:child_process');

const URL = 'http://127.0.0.1:4003/';
const WORKFLOWS = new Set(['discuss', 'research', 'plan', 'consult', 'forgeflow-consult', 'implement',
  'forgeflow-implement', 'review', 'forge-review', 'forgeflow-review', 'audit', 'quick', 'ship', 'debate', 'aegis-verify']);

function workflowFromPrompt(prompt) {
  const match = String(prompt || '').trim().match(/^[/$@](?:forgeflow:)?([a-z][a-z-]*)(?=\s|$)/i);
  return match && WORKFLOWS.has(match[1].toLowerCase()) ? match[1].toLowerCase() : '';
}

function sessionId(env = process.env) {
  return env.FORGEFLOW_SESSION_ID || env.CODEX_THREAD_ID || env.CLAUDE_SESSION_ID || '';
}

function desktopAvailable(env = process.env, platform = process.platform) {
  if (env.FORGEFLOW_DASHBOARD_AUTO_OPEN === 'off' || (env.CI && env.CI !== 'false' && env.CI !== '0')
    || env.SSH_CONNECTION || env.SSH_TTY) return false;
  return platform === 'darwin' || platform === 'win32' || Boolean(env.DISPLAY || env.WAYLAND_DISPLAY);
}

function probe(port, endpoint, service) {
  return new Promise(resolve => {
    const req = http.get({ hostname: '127.0.0.1', port, path: endpoint, agent: false }, res => {
      let body = '';
      res.on('data', chunk => { if (body.length < 65536) body += chunk; });
      res.on('end', () => {
        let matches = false;
        try { matches = JSON.parse(body).service === service; } catch (_) { /* Not our service. */ }
        resolve(res.statusCode === 200 && matches ? 'ready' : 'occupied');
      });
      res.on('error', () => resolve('occupied'));
    });
    const deadline = setTimeout(() => req.destroy(), 400);
    req.on('close', () => clearTimeout(deadline));
    req.on('error', error => resolve(error.code === 'ECONNREFUSED' ? 'free' : 'occupied'));
  });
}

async function ensureDashboard(root, runtimeRoot = path.resolve(__dirname, '../..')) {
  const status = await probe(4003, '/api/health', 'forgeflow-dashboard');
  if (status === 'ready') return;
  if (status !== 'free') throw new Error('Port 4003 is occupied by an unrecognized service');
  const script = path.join(runtimeRoot, 'services/dashboard/server.js');
  if (!fs.existsSync(script)) throw new Error('Dashboard runtime is missing; update the Forgeflow installation');
  // Resolve before spawning so missing dependencies do not leave a silent background crash.
  require.resolve('ws', { paths: [path.dirname(script)] });
  const child = spawn(process.execPath, [script], { cwd: root, detached: true, stdio: 'ignore' });
  let startupError;
  child.on('error', error => { startupError = error; });
  child.unref();
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline && !startupError) {
    if (await probe(4003, '/api/health', 'forgeflow-dashboard') === 'ready') return;
    if (child.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (child.pid && child.exitCode === null) child.kill();
  throw startupError || new Error('Dashboard did not become ready; check its dependencies and port 4003');
}

function openBrowser(url, platform = process.platform) {
  return new Promise(resolve => {
    const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'rundll32.exe' : 'xdg-open';
    const args = platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
    const child = spawn(command, args, { stdio: 'ignore', timeout: 5000, windowsHide: true });
    child.on('error', () => resolve(false));
    child.on('exit', code => resolve(code === 0));
  });
}

async function openSessionDashboard(options = {}) {
  const env = options.env || process.env;
  const session = options.session || sessionId(env);
  if (!desktopAvailable(env, options.platform) || !session) return { status: 'skipped', url: URL };
  const root = path.resolve(options.root || process.cwd());
  const stateDir = options.stateDir || path.join(os.tmpdir(), `forgeflow-dashboard-${process.getuid?.() ?? os.userInfo().username}`);
  fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(stateDir);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (process.getuid && (stat.uid !== process.getuid() || (stat.mode & 0o077)))) {
    throw new Error('Unsafe dashboard session directory');
  }
  // A stable session hash is global across workflow aliases and working directories.
  const marker = path.join(stateDir, crypto.createHash('sha256').update(session).digest('hex') + '.json');
  let fd;
  try { fd = fs.openSync(marker, 'wx', 0o600); }
  catch (error) { if (error.code === 'EEXIST') return { status: 'already-attempted', url: URL }; throw error; }
  let result;
  try {
    await (options.ensure || ensureDashboard)(root);
    const opened = await (options.open || openBrowser)(URL);
    result = { status: opened ? 'opened' : 'browser-unavailable', url: URL };
  } catch (error) {
    result = { status: 'unavailable', url: URL, reason: error.message };
  }
  try { fs.writeFileSync(fd, JSON.stringify({ ...result, attempted_at: new Date().toISOString() })); }
  finally { fs.closeSync(fd); }
  return result;
}

function launchForPrompt(payload) {
  if (!workflowFromPrompt(payload.prompt || payload.message || payload.text) || !desktopAvailable()) return;
  const session = payload.session_id || payload.sessionId || sessionId();
  if (!session) return;
  const root = payload.cwd || payload.workspace?.current_dir || payload.workspace?.project_dir || process.cwd();
  const child = spawn(process.execPath, [__filename, '--session', session, '--root', root], { detached: true, stdio: 'ignore' });
  child.on('error', () => {});
  child.unref();
}

async function main() {
  const options = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--session' && args[i + 1]) options.session = args[++i];
    else if (args[i] === '--root' && args[i + 1]) options.root = args[++i];
    else throw new Error('Usage: open-session-dashboard.js [--session <host-session-id>] [--root <project-root>]');
  }
  const result = await openSessionDashboard(options);
  if (!['skipped', 'already-attempted'].includes(result.status)) {
    process.stdout.write(`Forgeflow dashboard: ${result.status}. ${result.url}${result.reason ? ` (${result.reason})` : ''}\n`);
  }
}
if (require.main === module) main().catch(error => { process.stderr.write(`Dashboard auto-open skipped: ${error.message}\n`); });
module.exports = { openSessionDashboard, desktopAvailable, workflowFromPrompt, sessionId, launchForPrompt, ensureDashboard, probe };
