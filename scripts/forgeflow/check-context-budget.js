#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { walk } = require('./summarize-context-telemetry');

const DEFAULT_MAX_COMPACT_TOKENS = 16000;

function usage() {
  console.error([
    'Usage: check-context-budget.js [--root <dir>] [--file <json>]',
    '       [--max-compact-tokens <n>] [--max-kind <kind=n>] [--warn-only] [--json]',
  ].join('\n'));
}

function parseArgs(argv) {
  const opts = {
    root: '',
    files: [],
    maxCompactTokens: DEFAULT_MAX_COMPACT_TOKENS,
    kindLimits: {},
    warnOnly: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(argv[++i] || '');
    } else if (arg === '--file') {
      opts.files.push(path.resolve(argv[++i] || ''));
    } else if (arg === '--max-compact-tokens') {
      opts.maxCompactTokens = Number.parseInt(argv[++i] || `${DEFAULT_MAX_COMPACT_TOKENS}`, 10);
    } else if (arg === '--max-kind') {
      const [kind, rawLimit] = String(argv[++i] || '').split('=');
      const limit = Number.parseInt(rawLimit || '', 10);
      if (!kind || !Number.isFinite(limit)) {
        console.error('Invalid --max-kind. Expected kind=n');
        process.exit(2);
      }
      opts.kindLimits[kind] = limit;
    } else if (arg === '--warn-only') {
      opts.warnOnly = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      usage();
      process.exit(2);
    }
  }

  return opts;
}

function defaultRoot(cwd = process.cwd()) {
  return path.join(cwd, '.forgeflow');
}

function readTelemetry(file) {
  const telemetry = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!telemetry || telemetry.schema_version !== '1') return null;
  return telemetry;
}

function limitFor(opts, kind) {
  return opts.kindLimits[kind] || opts.maxCompactTokens;
}

function checkBudget(files, opts) {
  const result = {
    schema_version: '1',
    status: 'pass',
    files: 0,
    skipped: 0,
    max_compact_tokens: opts.maxCompactTokens,
    kind_limits: opts.kindLimits,
    violations: [],
  };

  for (const file of files) {
    let telemetry = null;
    try {
      telemetry = readTelemetry(file);
    } catch (_err) {
      result.skipped += 1;
      continue;
    }
    if (!telemetry) {
      result.skipped += 1;
      continue;
    }
    result.files += 1;
    const kind = telemetry.kind || 'unknown';
    const compactTokens = Number(telemetry.estimated_compact_tokens || 0);
    const limit = limitFor(opts, kind);
    if (compactTokens > limit) {
      result.violations.push({
        file,
        kind,
        estimated_compact_tokens: compactTokens,
        limit,
        over_by: compactTokens - limit,
      });
    }
  }

  if (result.violations.length > 0) {
    result.status = opts.warnOnly ? 'warn' : 'fail';
  }
  return result;
}

function renderMarkdown(result) {
  const lines = [
    `# Forgeflow Context Budget: ${result.status.toUpperCase()}`,
    '',
    `Files checked: ${result.files}`,
    `Skipped: ${result.skipped}`,
    `Default compact token budget: ${result.max_compact_tokens}`,
    '',
  ];
  if (result.violations.length === 0) {
    lines.push('No budget violations.');
  } else {
    lines.push('| Kind | Compact Tokens | Limit | Over By | File |');
    lines.push('|---|---:|---:|---:|---|');
    for (const violation of result.violations) {
      lines.push(`| ${violation.kind} | ${violation.estimated_compact_tokens} | ${violation.limit} | ${violation.over_by} | ${violation.file} |`);
    }
  }
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const files = opts.files.length > 0 ? opts.files : walk(opts.root || defaultRoot());
  const result = checkBudget(files, opts);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    console.log(renderMarkdown(result));
  }
  if (result.status === 'fail') process.exit(1);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = {
  checkBudget,
  limitFor,
  renderMarkdown,
};
