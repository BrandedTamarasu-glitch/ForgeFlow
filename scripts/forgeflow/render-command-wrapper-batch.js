#!/usr/bin/env node
const path = require('path');
const { buildCommandWrapperContract } = require('./command-wrapper-contract');

function usage() {
  console.error('Usage: render-command-wrapper-batch.js [--root <repo>] [--limit <n>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), limit: 5, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--limit') {
      const rawLimit = requireValue(argv, arg, i);
      if (!/^\d+$/.test(rawLimit)) throw new Error(`Invalid --limit: ${rawLimit}`);
      opts.limit = Math.max(1, Number.parseInt(rawLimit, 10));
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

function issuePriority(issue) {
  return {
    'missing-safe-args': 0,
    'missing-node-env-scrub': 1,
    'missing-repair-guidance': 2,
    'missing-installed-fallback': 3,
    'missing-helper-dir': 4,
  }[issue] ?? 9;
}

function buildCommandWrapperBatch(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const limit = Math.max(1, Number(opts.limit || 5));
  const contract = buildCommandWrapperContract({ root });
  const candidates = contract.wrappers
    .filter((wrapper) => wrapper.issues.length > 0)
    .map((wrapper) => ({
      source: wrapper.source,
      helpers: wrapper.helpers,
      issues: wrapper.issues.slice().sort((a, b) => issuePriority(a) - issuePriority(b) || a.localeCompare(b)),
      priority: Math.min(...wrapper.issues.map(issuePriority)),
    }))
    .sort((a, b) => a.priority - b.priority || b.issues.length - a.issues.length || a.source.localeCompare(b.source))
    .slice(0, limit);
  return {
    schema_version: '1',
    status: candidates.length > 0 ? 'batch-planned' : 'no-wrapper-issues',
    root,
    total_issue_count: contract.issue_count,
    batch_count: candidates.length,
    candidates,
    next: candidates.length > 0 ? `Fix wrapper contract issues in ${candidates[0].source}` : 'No wrapper consolidation batch is needed.',
    boundary: 'Command wrapper batch is read-only. It ranks wrapper cleanup candidates but does not edit command files, commit, or push.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Command Wrapper Batch',
    '',
    `Status: ${result.status}`,
    `Total wrapper issues: ${result.total_issue_count}`,
    `Batch size: ${result.batch_count}`,
    '',
    result.boundary,
    '',
    '## Candidates',
    '',
  ];
  if (result.candidates.length === 0) lines.push('- None.');
  for (const item of result.candidates) {
    lines.push(`- ${item.source}`);
    lines.push(`  - Issues: ${item.issues.join(', ')}`);
    if (item.helpers.length > 0) lines.push(`  - Helpers: ${item.helpers.join(', ')}`);
  }
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildCommandWrapperBatch(opts);
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

module.exports = { buildCommandWrapperBatch, parseArgs, renderMarkdown };
