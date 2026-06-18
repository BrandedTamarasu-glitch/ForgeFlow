#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { commandNames } = require('./runtime-inventory');

function usage() {
  console.error('Usage: render-command-capability-matrix.js [--root <repo>] [--json]');
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
  const file = path.join(root, 'pi-extension', 'index.js');
  if (!fs.existsSync(file)) return new Set();
  const source = fs.readFileSync(file, 'utf8');
  return new Set([...source.matchAll(/'((?:forgeflow)[\w-]*)'/g)].map((match) => match[1]));
}

function skillNameForCommand(name) {
  const direct = `forgeflow-${name.replace(/^forgeflow-/, '')}`;
  const core = {
    plan: 'forgeflow-plan',
    implement: 'forgeflow-implement',
    review: 'forgeflow-review',
    audit: 'forgeflow-audit',
    ship: 'forgeflow-ship',
  };
  return core[name] || direct;
}

function buildCommandCapabilityMatrix(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const names = commandNames(root);
  const piCommands = registeredPiCommands(root);
  const rows = names.map((name) => {
    const commandFile = `commands/${name.replace(/\//g, '/')}.md`;
    const opencodeFile = `.opencode/command/${name}.md`;
    const skillFile = `skills/${skillNameForCommand(name)}/SKILL.md`;
    return {
      command: name,
      forgeflow_command: exists(root, commandFile),
      pi_alias: piCommands.has(name),
      opencode_command: exists(root, opencodeFile),
      skill: exists(root, skillFile),
    };
  });
  const counts = {
    commands: rows.length,
    pi_aliases: rows.filter((row) => row.pi_alias).length,
    opencode_commands: rows.filter((row) => row.opencode_command).length,
    skills: rows.filter((row) => row.skill).length,
  };
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    status: rows.every((row) => row.forgeflow_command) ? 'pass' : 'fail',
    rows,
    summary: counts,
    next: '/forgeflow-lean-host-command-parity',
    boundary: 'Command capability matrix generation is read-only. It scans committed command, host adapter, and skill files but does not install adapters, edit settings, commit, push, or call the network.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Command Capability Matrix',
    '',
    `Status: ${result.status}`,
    '',
    result.boundary,
    '',
    '| Command | Forgeflow | Pi | OpenCode | Skill |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const row of result.rows) {
    lines.push(`| ${row.command} | ${row.forgeflow_command ? 'yes' : 'no'} | ${row.pi_alias ? 'yes' : 'no'} | ${row.opencode_command ? 'yes' : 'no'} | ${row.skill ? 'yes' : 'no'} |`);
  }
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = buildCommandCapabilityMatrix(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
    if (result.status === 'fail') process.exit(1);
  } catch (err) {
    console.error(`command capability matrix failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  buildCommandCapabilityMatrix,
  parseArgs,
  renderMarkdown,
  skillNameForCommand,
};
