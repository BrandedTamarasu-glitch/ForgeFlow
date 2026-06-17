#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const HOST_COMMANDS = [
  'forgeflow-lean-mode',
  'forgeflow-lean-review',
  'forgeflow-lean-audit',
  'forgeflow-lean-debt',
  'forgeflow-lean-status',
];

function usage() {
  console.error('Usage: render-lean-host-command-parity.js [--root <repo>] [--json]');
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

function exists(root, file) {
  return fs.existsSync(path.join(root, file));
}

function registeredPiCommands(root) {
  const source = fs.readFileSync(path.join(root, 'pi-extension', 'index.js'), 'utf8');
  return [...source.matchAll(/'((?:forgeflow-lean)[\w-]*)'/g)]
    .map((match) => match[1])
    .filter((value, index, list) => list.indexOf(value) === index && HOST_COMMANDS.includes(value))
    .sort();
}

function buildLeanHostCommandParity(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const piCommands = registeredPiCommands(root);
  const checks = [];
  for (const name of HOST_COMMANDS) {
    checks.push({ name: `${name}: pi registered`, status: piCommands.includes(name) ? 'pass' : 'fail', file: 'pi-extension/index.js' });
    checks.push({ name: `${name}: Forgeflow command wrapper`, status: exists(root, `commands/${name}.md`) ? 'pass' : 'fail', file: `commands/${name}.md` });
    checks.push({ name: `${name}: OpenCode command file`, status: exists(root, `.opencode/command/${name}.md`) ? 'pass' : 'fail', file: `.opencode/command/${name}.md` });
  }
  const failures = checks.filter((item) => item.status === 'fail').length;
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    status: failures ? 'fail' : 'pass',
    commands: HOST_COMMANDS,
    checks,
    summary: { commands: HOST_COMMANDS.length, checks: checks.length, failures },
    next: failures ? 'Add missing host command files or pi registrations.' : '/forgeflow-lean-adapter-smoke',
    boundary: 'Lean host command parity is read-only. It checks committed pi and OpenCode command surfaces but does not install adapters, edit settings, commit, push, or call the network.',
  };
}

function renderMarkdown(result) {
  const lines = ['# Forgeflow Lean Host Command Parity', '', `Status: ${result.status}`, '', result.boundary, '', '## Commands', ''];
  for (const name of result.commands) lines.push(`- ${name}`);
  lines.push('', '## Checks', '');
  for (const item of result.checks) lines.push(`- ${item.status}: ${item.name}`);
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = buildLeanHostCommandParity(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
    if (result.status === 'fail') process.exit(1);
  } catch (err) {
    console.error(`lean host command parity failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  HOST_COMMANDS,
  buildLeanHostCommandParity,
  parseArgs,
  renderMarkdown,
};
