#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

function usage() {
  console.error('Usage: render-lean-adapter-smoke.js [--root <repo>] [--json]');
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

function check(name, ok, detail = '') {
  return { name, status: ok ? 'pass' : 'fail', detail };
}

function readJson(root, file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
}

async function opencodeSmoke(root) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-opencode-'));
  const previous = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = tmp;
  try {
    const pluginPath = path.join(root, '.opencode', 'plugins', 'forgeflow-lean.mjs');
    const moduleUrl = `${pathToFileURL(pluginPath).href}?t=${Date.now()}`;
    const loadPlugin = (await import(moduleUrl)).default;
    const hooks = await loadPlugin({});
    const output = { system: [] };
    await hooks['experimental.chat.system.transform']({ model: {} }, output);
    const before = output.system.length === 1 && output.system[0].includes('FORGEFLOW LEAN SESSION ACTIVE');
    await hooks['command.execute.before']({ command: 'forgeflow-lean', arguments: 'off', sessionID: 'smoke' });
    const offOutput = { system: [] };
    await hooks['experimental.chat.system.transform']({ model: {} }, offOutput);
    return { ok: before && offOutput.system.length === 0, detail: before ? 'OpenCode plugin transform and off mode worked.' : 'OpenCode plugin did not inject lean guidance.' };
  } catch (err) {
    return { ok: false, detail: err.message };
  } finally {
    if (previous === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = previous;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function buildLeanAdapterSmoke(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const checks = [];
  const claude = readJson(root, '.claude-plugin/plugin.json');
  const codex = readJson(root, '.codex-plugin/plugin.json');
  const copilot = readJson(root, '.github/plugin/plugin.json');
  const gemini = readJson(root, 'gemini-extension.json');

  checks.push(check('Claude plugin manifest parses', claude.name === 'Forgeflow' && claude.install?.['post-install']));
  checks.push(check('Codex plugin manifest parses', codex.name === 'Forgeflow' && codex.hooks?.SessionStart?.[0]?.includes('forgeflow-lean-activate.js')));
  checks.push(check('Copilot plugin manifest parses', copilot.name === 'Forgeflow' && copilot.commands === 'commands/'));
  checks.push(check('Gemini extension manifest parses', gemini.name === 'Forgeflow' && gemini.contextFileName === 'AGENTS.md'));
  checks.push(check('OpenClaw skill exists', fs.existsSync(path.join(root, '.openclaw', 'skills', 'forgeflow-lean', 'SKILL.md'))));
  const opencode = await opencodeSmoke(root);
  checks.push(check('OpenCode plugin smoke loads', opencode.ok, opencode.detail));

  const failures = checks.filter((item) => item.status === 'fail').length;
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    status: failures ? 'fail' : 'pass',
    checks,
    summary: { checks: checks.length, failures },
    next: failures ? 'Fix host adapter smoke failures before relying on committed adapters.' : '/forgeflow-lean-adapter-drift',
    boundary: 'Lean adapter smoke is local and structural. It parses committed manifests and imports the OpenCode plugin with a temporary config directory. It does not launch hosts, install adapters, edit settings, commit, push, or call the network.',
  };
}

function renderMarkdown(result) {
  const lines = ['# Forgeflow Lean Adapter Smoke', '', `Status: ${result.status}`, '', result.boundary, '', '## Checks', ''];
  for (const item of result.checks) lines.push(`- ${item.status}: ${item.name}${item.detail ? ` (${item.detail})` : ''}`);
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

async function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = await buildLeanAdapterSmoke(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
    if (result.status === 'fail') process.exit(1);
  } catch (err) {
    console.error(`lean adapter smoke failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  buildLeanAdapterSmoke,
  parseArgs,
  renderMarkdown,
};
