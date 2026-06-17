#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { buildLeanHostCommandParity } = require('./render-lean-host-command-parity');

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

async function piSmoke(root) {
  try {
    const moduleUrl = `${pathToFileURL(path.join(root, 'pi-extension', 'index.js')).href}?t=${Date.now()}`;
    const mod = await import(moduleUrl);
    const commands = new Map();
    const handlers = new Map();
    const entries = [];
    const pi = {
      registerCommand(name, config) { commands.set(name, config); },
      on(name, handler) { handlers.set(name, handler); },
      appendEntry(type, data) { entries.push({ type: 'custom', customType: type, data }); },
      sendUserMessage() {},
    };
    mod.default(pi);
    await commands.get('forgeflow-lean-mode').handler('strict', { ui: { notify() {} } });
    const prompt = await handlers.get('before_agent_start')({ systemPrompt: 'base' });
    const commandNames = mod.commandNames();
    return {
      ok: commandNames.every((name) => commands.has(name)) && entries.at(-1)?.data?.mode === 'strict' && /profile: strict/.test(prompt.systemPrompt),
      detail: 'pi extension registered commands and injected strict lean guidance.',
    };
  } catch (err) {
    return { ok: false, detail: err.message };
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
  checks.push(check('Gemini extension exposes commands and skills', gemini.commands === 'commands' && gemini.skills === '.openclaw/skills'));
  const openClawSkill = fs.readFileSync(path.join(root, '.openclaw', 'skills', 'forgeflow-lean', 'SKILL.md'), 'utf8');
  checks.push(check('OpenClaw skill parses', /^---\n[\s\S]*?name: forgeflow-lean[\s\S]*?---/.test(openClawSkill) && openClawSkill.includes('FORGEFLOW LEAN SESSION ACTIVE')));
  const parity = buildLeanHostCommandParity({ root });
  checks.push(check('Host command parity passes', parity.status === 'pass', `${parity.summary.checks} command surface checks`));
  const opencode = await opencodeSmoke(root);
  checks.push(check('OpenCode plugin smoke loads', opencode.ok, opencode.detail));
  const pi = await piSmoke(root);
  checks.push(check('pi extension smoke loads', pi.ok, pi.detail));

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
