#!/usr/bin/env node
const path = require('path');

const SHELL_META = /[;&|`$<>(){}[\]\n\r]/;

function usage() {
  console.error('Usage: command-args.js --allow <comma-flags> [--args "<arguments>"] [--json]');
}

function tokenize(input = '') {
  const tokens = [];
  let current = '';
  let quote = '';
  let escaped = false;
  for (const char of String(input)) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = '';
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (escaped) current += '\\';
  if (quote) throw new Error('Unclosed quote in arguments');
  if (current) tokens.push(current);
  return tokens;
}

function flagSpec(raw) {
  const spec = new Map();
  for (const item of String(raw || '').split(',').map((value) => value.trim()).filter(Boolean)) {
    const [name, kind = 'boolean'] = item.split(':');
    if (!/^--[A-Za-z0-9][A-Za-z0-9-]*$/.test(name || '')) throw new Error(`Invalid allowed flag: ${item}`);
    if (!['boolean', 'value', 'path'].includes(kind)) throw new Error(`Invalid flag kind for ${name}: ${kind}`);
    spec.set(name, kind);
  }
  return spec;
}

function assertSafeToken(token, label) {
  if (SHELL_META.test(String(token || ''))) throw new Error(`Unsafe shell metacharacter in ${label}`);
}

function parseCommandArguments(input, allowed) {
  const spec = allowed instanceof Map ? allowed : flagSpec(allowed);
  const tokens = Array.isArray(input) ? input : tokenize(input);
  const result = { args: [], values: {}, tokens };
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token) continue;
    assertSafeToken(token, token.startsWith('--') ? token : 'argument');
    if (!token.startsWith('--')) throw new Error(`Unexpected positional argument: ${token}`);
    if (!spec.has(token)) throw new Error(`Unsupported argument: ${token}`);
    const kind = spec.get(token);
    if (kind === 'boolean') {
      result.args.push(token);
      result.values[token] = true;
      continue;
    }
    const value = tokens[i + 1] || '';
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
    assertSafeToken(value, token);
    result.args.push(token, kind === 'path' ? path.normalize(value) : value);
    result.values[token] = kind === 'path' ? path.normalize(value) : value;
    i += 1;
  }
  return result;
}

function parseArgs(argv) {
  const opts = { allow: '', args: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--allow') {
      opts.allow = argv[++i] || '';
    } else if (arg === '--args') {
      opts.args = argv[++i] || '';
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!opts.allow) throw new Error('Missing --allow');
  return opts;
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Command Argument Check',
    '',
    `Status: ${result.status}`,
    '',
    result.boundary,
    '',
    '## Parsed Arguments',
    '',
  ];
  if (result.parsed.args.length === 0) lines.push('- None.');
  else for (const arg of result.parsed.args) lines.push(`- ${arg}`);
  lines.push('', '## Values', '');
  const entries = Object.entries(result.parsed.values);
  if (entries.length === 0) lines.push('- None.');
  else for (const [key, value] of entries) lines.push(`- ${key}: ${value}`);
  lines.push('');
  return lines.join('\n');
}

function buildCommandArgumentCheck(opts = {}) {
  const parsed = parseCommandArguments(opts.args || '', opts.allow || '');
  return {
    schema_version: '1',
    status: 'pass',
    parsed,
    boundary: 'Command argument check validates a small argv subset only. It does not execute commands, expand shell syntax, read files, edit files, commit, or push.',
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildCommandArgumentCheck(opts);
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

module.exports = { buildCommandArgumentCheck, flagSpec, parseArgs, parseCommandArguments, renderMarkdown, tokenize };
