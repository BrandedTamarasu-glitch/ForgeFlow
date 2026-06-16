#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const HOST_ADAPTERS = [
  {
    host: 'Claude Code',
    tier: 'plugin',
    files: ['.claude-plugin/plugin.json', '.claude-plugin/marketplace.json'],
    checks: [
      { name: 'claude plugin wires lean hook', file: '.claude-plugin/plugin.json', includes: ['forgeflow-lean-activate.js', 'SessionStart', 'UserPromptSubmit'] },
    ],
  },
  {
    host: 'Codex',
    tier: 'plugin',
    files: ['.codex-plugin/plugin.json'],
    checks: [
      { name: 'codex plugin wires lean hook', file: '.codex-plugin/plugin.json', includes: ['forgeflow-lean-activate.js', 'SessionStart', 'UserPromptSubmit'] },
    ],
  },
  {
    host: 'GitHub Copilot CLI',
    tier: 'plugin',
    files: ['.github/plugin/plugin.json', '.github/plugin/marketplace.json', '.github/copilot-instructions.md'],
    checks: [
      { name: 'copilot plugin points at commands', file: '.github/plugin/plugin.json', includes: ['commands/'] },
      { name: 'copilot instructions carry lean rule', file: '.github/copilot-instructions.md', includes: ['FORGEFLOW LEAN SESSION ACTIVE', 'trust-boundary validation'] },
    ],
  },
  {
    host: 'OpenCode',
    tier: 'plugin',
    files: ['.opencode/plugins/forgeflow-lean.mjs', '.opencode/command/forgeflow-lean.md'],
    checks: [
      { name: 'opencode plugin uses shared lean session', file: '.opencode/plugins/forgeflow-lean.mjs', includes: ['render-lean-session.js', 'experimental.chat.system.transform', 'command.execute.before'] },
    ],
  },
  {
    host: 'Gemini/Antigravity',
    tier: 'extension',
    files: ['gemini-extension.json', 'AGENTS.md'],
    checks: [
      { name: 'gemini extension uses project context file', file: 'gemini-extension.json', includes: ['contextFileName', 'AGENTS.md'] },
    ],
  },
  {
    host: 'Cursor',
    tier: 'instruction',
    files: ['.cursor/rules/forgeflow-lean.mdc'],
    checks: [
      { name: 'cursor rule carries lean rule', file: '.cursor/rules/forgeflow-lean.mdc', includes: ['FORGEFLOW LEAN SESSION ACTIVE', 'data-loss prevention'] },
    ],
  },
  {
    host: 'Windsurf',
    tier: 'instruction',
    files: ['.windsurf/rules/forgeflow-lean.md'],
    checks: [
      { name: 'windsurf rule carries lean rule', file: '.windsurf/rules/forgeflow-lean.md', includes: ['FORGEFLOW LEAN SESSION ACTIVE', 'accessibility'] },
    ],
  },
  {
    host: 'Cline',
    tier: 'instruction',
    files: ['.clinerules/forgeflow-lean.md'],
    checks: [
      { name: 'cline rule carries lean rule', file: '.clinerules/forgeflow-lean.md', includes: ['FORGEFLOW LEAN SESSION ACTIVE', 'explicit requirements'] },
    ],
  },
  {
    host: 'Kiro',
    tier: 'instruction',
    files: ['.kiro/steering/forgeflow-lean.md'],
    checks: [
      { name: 'kiro rule carries lean rule', file: '.kiro/steering/forgeflow-lean.md', includes: ['FORGEFLOW LEAN SESSION ACTIVE', 'one focused check'] },
    ],
  },
  {
    host: 'OpenClaw',
    tier: 'skill',
    files: ['.openclaw/skills/forgeflow-lean/SKILL.md'],
    checks: [
      { name: 'openclaw skill carries lean rule', file: '.openclaw/skills/forgeflow-lean/SKILL.md', includes: ['name: forgeflow-lean', 'FORGEFLOW LEAN SESSION ACTIVE'] },
    ],
  },
];

function usage() {
  console.error('Usage: render-lean-host-adapters.js [--root <repo>] [--json]');
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

function read(root, file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function runAdapter(root, adapter) {
  const missing = adapter.files.filter((file) => !fs.existsSync(path.join(root, file)));
  const checks = [];
  for (const file of adapter.files) {
    checks.push({ name: `${adapter.host}: ${file} exists`, status: missing.includes(file) ? 'fail' : 'pass', file });
  }
  for (const check of adapter.checks) {
    let status = 'fail';
    if (!missing.includes(check.file)) {
      const text = read(root, check.file);
      status = check.includes.every((needle) => text.includes(needle)) ? 'pass' : 'fail';
    }
    checks.push({ name: check.name, status, file: check.file, includes: check.includes });
  }
  return {
    host: adapter.host,
    tier: adapter.tier,
    files: adapter.files,
    status: checks.every((item) => item.status === 'pass') ? 'pass' : 'fail',
    checks,
  };
}

function buildLeanHostAdapters(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const adapters = HOST_ADAPTERS.map((adapter) => runAdapter(root, adapter));
  const checks = adapters.flatMap((adapter) => adapter.checks);
  const failures = checks.filter((item) => item.status === 'fail').length;
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    status: failures ? 'fail' : 'pass',
    adapters,
    summary: { adapters: adapters.length, checks: checks.length, failures },
    next: failures ? 'Fix committed lean host adapter files before publishing or relying on host package support.' : '/forgeflow-lean-adapter-smoke',
    boundary: 'Lean host adapter validation is read-only. It checks committed local adapter files but does not install adapters, edit host settings, commit, push, or call the network.',
  };
}

function renderMarkdown(result) {
  const lines = ['# Forgeflow Lean Host Adapters', '', `Status: ${result.status}`, '', result.boundary, '', '## Adapters', ''];
  for (const adapter of result.adapters) lines.push(`- ${adapter.status}: ${adapter.host} (${adapter.tier})`);
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = buildLeanHostAdapters(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
    if (result.status === 'fail') process.exit(1);
  } catch (err) {
    console.error(`lean host adapters failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  HOST_ADAPTERS,
  buildLeanHostAdapters,
  parseArgs,
  renderMarkdown,
};
