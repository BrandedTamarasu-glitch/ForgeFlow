#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function usage() {
  console.error('Usage: render-lean-hook-contract.js [--root <repo>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function runHook(root, payload, env = {}) {
  const script = path.join(root, 'hooks', 'forgeflow-lean-activate.js');
  return spawnSync(process.execPath, [script], {
    cwd: root,
    env: { ...process.env, ...env },
    input: JSON.stringify(payload),
    encoding: 'utf8',
  });
}

function classifySpawn(result) {
  if (result.error && result.error.code === 'EPERM') return 'environment-blocked';
  if (result.error) return 'fail';
  return result.status === 0 ? 'pass' : 'fail';
}

function parseOutput(stdout) {
  try {
    return stdout ? JSON.parse(stdout) : null;
  } catch (_err) {
    return null;
  }
}

function buildLeanHookContract(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-lean-hook-contract-'));
  const stateDir = path.join(temp, 'state');
  const env = {
    FORGEFLOW_LEAN_STATE_DIR: stateDir,
    FORGEFLOW_LEAN_DEFAULT_MODE: 'lite',
    HOME: path.join(temp, 'home'),
    USERPROFILE: path.join(temp, 'home'),
  };
  const checks = [];
  const session = runHook(root, { hook_event_name: 'SessionStart', cwd: root }, env);
  const sessionStatus = classifySpawn(session);
  const sessionOutput = parseOutput(session.stdout);
  checks.push({
    name: 'SessionStart subprocess emits lean context',
    status: sessionStatus === 'environment-blocked' ? 'warn' : (sessionStatus === 'pass' && sessionOutput && sessionOutput.systemMessage === 'LEAN:lite' ? 'pass' : 'fail'),
    detail: sessionStatus === 'environment-blocked' ? 'process spawn blocked by local sandbox' : (session.stderr || session.stdout || 'no output'),
  });
  const prompt = runHook(root, { hook_event_name: 'UserPromptSubmit', prompt: '/forgeflow-lean-mode --profile ultra' }, env);
  const promptStatus = classifySpawn(prompt);
  const promptOutput = parseOutput(prompt.stdout);
  checks.push({
    name: 'UserPromptSubmit subprocess tracks mode',
    status: promptStatus === 'environment-blocked' ? 'warn' : (promptStatus === 'pass' && promptOutput && promptOutput.systemMessage === 'LEAN:ultra' ? 'pass' : 'fail'),
    detail: promptStatus === 'environment-blocked' ? 'process spawn blocked by local sandbox' : (prompt.stderr || prompt.stdout || 'no output'),
  });
  try { fs.rmSync(temp, { recursive: true, force: true }); } catch (_err) {}
  const failures = checks.filter((item) => item.status === 'fail').length;
  const warnings = checks.filter((item) => item.status === 'warn').length;
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    status: failures ? 'fail' : (warnings ? 'warn' : 'pass'),
    checks,
    summary: { checks: checks.length, failures, warnings },
    next: failures ? 'Fix lean activation hook subprocess failures.' : 'Hook subprocess contract is usable when local process spawning is permitted.',
    boundary: 'Lean hook contract runs only the local lean activation hook in a temporary state directory. It does not edit settings, install hooks, commit, push, or call the network.',
  };
}

function renderMarkdown(result) {
  const lines = ['# Forgeflow Lean Hook Contract', '', `Status: ${result.status}`, '', result.boundary, '', '## Checks', ''];
  for (const item of result.checks) lines.push(`- ${item.status}: ${item.name} (${item.detail})`);
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = buildLeanHookContract(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
    if (result.status === 'fail') process.exit(1);
  } catch (err) {
    console.error(`lean hook contract failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  buildLeanHookContract,
  classifySpawn,
  parseArgs,
  renderMarkdown,
};
