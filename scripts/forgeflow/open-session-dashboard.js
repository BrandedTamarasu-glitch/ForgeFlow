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
  'forgeflow-implement', 'review', 'forge-review', 'forgeflow-review', 'audit', 'quick', 'ship', 'debate', 'verifier-verify', 'aegis-verify', 'task']);

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

function probe(port, endpoint, service, onIdentity) {
  return new Promise(resolve => {
    const req = http.get({ hostname: '127.0.0.1', port, path: endpoint, agent: false }, res => {
      let body = '';
      res.on('data', chunk => { if (body.length < 65536) body += chunk; });
      res.on('end', () => {
        let matches = false;
        try {
          const identity = JSON.parse(body);
          matches = identity.service === service;
          if (matches && onIdentity) onIdentity(identity);
        } catch (_) { /* Not our service. */ }
        resolve(res.statusCode === 200 && matches ? 'ready' : 'occupied');
      });
      res.on('error', () => resolve('occupied'));
    });
    const deadline = setTimeout(() => req.destroy(), 400);
    req.on('close', () => clearTimeout(deadline));
    req.on('error', error => resolve(error.code === 'ECONNREFUSED' ? 'free' : 'occupied'));
  });
}

function workflowState(workflow) {
  if (['discuss', 'consult', 'forgeflow-consult', 'plan', 'quick'].includes(workflow)) return 'planning';
  if (workflow === 'research') return 'researching';
  if (['implement', 'forgeflow-implement'].includes(workflow)) return 'implementing';
  if (['review', 'forge-review', 'forgeflow-review', 'audit', 'debate', 'verifier-verify', 'aegis-verify'].includes(workflow)) return 'reviewing';
  return '';
}

async function ensureService(root, config, runtimeRoot = path.resolve(__dirname, '../..')) {
  const status = await probe(config.port, config.endpoint, config.service);
  if (status === 'ready') return;
  if (status !== 'free') throw new Error(`Port ${config.port} is occupied by an unrecognized service`);
  if (config.extraPort && await probe(config.extraPort, '/', config.service) !== 'free') {
    throw new Error(`Port ${config.extraPort} is occupied; activity service cannot start`);
  }
  const script = path.join(runtimeRoot, config.script);
  if (!fs.existsSync(script)) throw new Error(`${config.service} runtime is missing; update the Forgeflow installation`);
  require.resolve('ws', { paths: [path.dirname(script)] });
  const child = spawn(process.execPath, [script], { cwd: root, detached: true, stdio: 'ignore' });
  let startupError;
  child.on('error', error => { startupError = error; });
  child.unref();
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline && !startupError) {
    let listenerPid;
    if (await probe(config.port, config.endpoint, config.service, identity => { listenerPid = identity.pid; }) === 'ready') {
      // Keep the existing /agent-chat:off helper able to stop a service we started.
      if (config.pidFile && child.exitCode === null && child.pid && listenerPid === child.pid) {
        const temporary = `${config.pidFile}.${child.pid}.${crypto.randomBytes(8).toString('hex')}`;
        try {
          fs.writeFileSync(temporary, String(child.pid), { flag: 'wx', mode: 0o600 });
          fs.renameSync(temporary, config.pidFile);
        } finally { try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
      }
      return;
    }
    if (child.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (child.pid && child.exitCode === null) child.kill();
  throw startupError || new Error(`${config.service} did not become ready; check its dependencies and ports`);
}

function ensureDashboard(root, runtimeRoot) {
  return ensureService(root, { port: 4003, endpoint: '/api/health', service: 'forgeflow-dashboard',
    script: 'services/dashboard/server.js' }, runtimeRoot);
}

function ensureAgentChat(root, runtimeRoot) {
  return ensureService(root, { port: 4001, extraPort: 4000, endpoint: '/health', service: 'forgeflow-agent-chat',
    script: 'services/agent-chat/server.js', pidFile: path.join(process.platform === 'win32' ? os.tmpdir() : '/tmp', 'agent-chat.pid') }, runtimeRoot);
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
  if (!desktopAvailable(env, options.platform) || !session) return { status: 'skipped', url: URL,
    reason: !session ? 'No host session ID was supplied' : env.FORGEFLOW_DASHBOARD_AUTO_OPEN === 'off'
      ? 'Dashboard auto-open is disabled' : 'No local desktop session is available (headless, CI, or SSH)' };
  const root = path.resolve(options.root || process.cwd());
  const stateDir = options.stateDir || path.join(os.tmpdir(), `forgeflow-dashboard-${process.getuid?.() ?? os.userInfo().username}`);
  fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(stateDir);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (process.getuid && (stat.uid !== process.getuid() || (stat.mode & 0o077)))) {
    throw new Error('Unsafe dashboard session directory');
  }
  // A stable session hash is global across workflow aliases and working directories.
  let marker = path.join(stateDir, crypto.createHash('sha256').update(session).digest('hex') + '.json');
  // Older runtimes kept failed attempts permanently. Use a separate exclusive
  // retry marker, preserving the old record without racing to delete it.
  try {
    if (fs.lstatSync(marker).size > 65536) throw new Error('Oversized session marker');
    const previous = JSON.parse(require('./file-safety').safeReadTextFile(marker, stateDir).content);
    if (['unavailable', 'browser-unavailable'].includes(previous.status)) marker += '.retry';
  } catch (_) { /* Missing or still-in-progress marker. */ }
  let fd;
  try { fd = fs.openSync(marker, 'wx', 0o600); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const warnings = [];
  let result;
  try {
    try {
      await (options.ensureActivity || ensureAgentChat)(root);
      const state = workflowState(options.workflow);
      if (state) {
        const report = options.report || require('../../services/agent-chat/client').sendActivity;
        if (!await report(state, `ForgeFlow ${options.workflow}: ${path.basename(root)}`.slice(0, 160))) {
          warnings.push('The activity service did not accept the workflow report');
        }
      }
    } catch (error) { warnings.push(`Live activity unavailable: ${error.message}`); }
    await (options.ensure || ensureDashboard)(root);
    const opened = fd === undefined ? false : await (options.open || openBrowser)(URL);
    result = { status: fd === undefined ? 'already-attempted' : opened ? 'opened' : 'browser-unavailable', url: URL };
  } catch (error) {
    result = { status: 'unavailable', url: URL, reason: error.message };
  }
  if (warnings.length) result.warnings = warnings;
  if (fd !== undefined) {
    try { if (result.status === 'opened') fs.writeFileSync(fd, JSON.stringify({ ...result, attempted_at: new Date().toISOString() })); }
    finally {
      fs.closeSync(fd);
      // A failed attempt must not consume this session's one successful opening.
      // Only this exclusive marker owner removes its marker.
      if (result.status !== 'opened') fs.unlinkSync(marker);
    }
  }
  return result;
}

function launchForPrompt(payload) {
  if (!workflowFromPrompt(payload.prompt || payload.message || payload.text) || !desktopAvailable()) return;
  const session = payload.session_id || payload.sessionId || sessionId();
  if (!session) return;
  const root = payload.cwd || payload.workspace?.current_dir || payload.workspace?.project_dir || process.cwd();
  const workflow = workflowFromPrompt(payload.prompt || payload.message || payload.text);
  const child = spawn(process.execPath, [__filename, '--session', session, '--root', root, '--workflow', workflow], { detached: true, stdio: 'ignore' });
  child.on('error', () => {});
  child.unref();
}

async function main() {
  const options = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--session' && args[i + 1]) options.session = args[++i];
    else if (args[i] === '--root' && args[i + 1]) options.root = args[++i];
    else if (args[i] === '--workflow' && args[i + 1]) options.workflow = args[++i];
    else throw new Error('Usage: open-session-dashboard.js [--session <host-session-id>] [--root <project-root>] [--workflow <name>]');
  }
  const result = await openSessionDashboard(options);
  if (result.warnings) process.stderr.write(`${result.warnings.join('; ')}\n`);
  if (!['skipped', 'already-attempted'].includes(result.status)) {
    process.stdout.write(`Forgeflow dashboard: ${result.status}. ${result.url}${result.reason ? ` (${result.reason})` : ''}\n`);
  }
}
if (require.main === module) main().catch(error => { process.stderr.write(`Dashboard auto-open skipped: ${error.message}\n`); });
module.exports = { openSessionDashboard, desktopAvailable, workflowFromPrompt, sessionId, launchForPrompt, ensureDashboard, ensureAgentChat, workflowState, probe };
