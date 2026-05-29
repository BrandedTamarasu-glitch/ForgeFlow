#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { commandSources } = require('./runtime-inventory');

function usage() {
  console.error('Usage: render-command-index.js [--root <repo>] [--json]');
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

function parseFrontmatter(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  if (lines[0] !== '---') return {};
  const end = lines.indexOf('---', 1);
  if (end === -1) return {};
  const data = {};
  for (let i = 1; i < end; i += 1) {
    const match = lines[i].match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!match) continue;
    data[match[1]] = (match[2] || '').replace(/^"(.*)"$/, '$1');
  }
  return data;
}

function commandName(source) {
  return source.replace(/^commands\//, '').replace(/\.md$/, '').replace(/\//g, ':');
}

function commandGroup(name) {
  if (/^(review|ship|handoff|discuss|research|plan|consult|implement|quick|audit|agent-chat)/.test(name)) return 'workflow';
  if (/^forgeflow-review/.test(name)) return 'workflow';
  if (/health|version|update|install|release|runtime|smoke|support/.test(name)) return 'install-release';
  if (/context|code-map|trends|report|learning|profile|outcome|feedback|first-|pilot|efficiency|next-work|pattern/.test(name)) return 'intelligence';
  return 'utility';
}

function buildCommandIndex(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const commands = commandSources(root).map((source) => {
    const frontmatter = parseFrontmatter(fs.readFileSync(path.join(root, source), 'utf8'));
    const name = commandName(source);
    return {
      name,
      slash: `/${name}`,
      source,
      description: frontmatter.description || '',
      argument_hint: frontmatter['argument-hint'] || '',
      group: commandGroup(name),
    };
  }).sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
  const groups = {};
  for (const command of commands) {
    if (!groups[command.group]) groups[command.group] = [];
    groups[command.group].push(command);
  }
  return {
    schema_version: '1',
    root,
    command_count: commands.length,
    groups,
    commands,
    boundary: 'Command index is generated from command frontmatter and runtime inventory command discovery. It does not edit command docs or install files.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Command Index',
    '',
    `Commands: ${result.command_count}`,
    '',
    result.boundary,
    '',
  ];
  for (const [group, commands] of Object.entries(result.groups)) {
    lines.push(`## ${group}`, '');
    for (const command of commands) {
      const args = command.argument_hint ? ` ${command.argument_hint}` : '';
      lines.push(`- \`${command.slash}${args}\` - ${command.description || command.source}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildCommandIndex(opts);
  process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    usage();
    process.exit(1);
  }
}

module.exports = { buildCommandIndex, parseArgs, renderMarkdown };
