#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { safeReadTextFile, writeFileSafe } = require('./file-safety');

const RESULT_FIELDS = ['health', 'smoke', 'profile', 'decision', 'friction', 'runtime'];

function usage() {
  console.error('Usage: rollup-first-run-results.js [--project-dir <dir>] [--out <path>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { projectDir: '', out: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--out') {
      opts.out = path.resolve(requireValue(argv, arg, i));
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

function countInto(counts, value) {
  const key = String(value || 'unknown').trim() || 'unknown';
  counts[key] = (counts[key] || 0) + 1;
}

function sortedCounts(counts) {
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function defaultOut(projectDir) {
  return path.join(projectDir, 'first-run-results', 'rollup.md');
}

function readRecords(projectDir) {
  const dir = path.join(projectDir, 'first-run-results');
  if (!fs.existsSync(dir)) return [];
  const records = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (!/\.json$/i.test(name)) continue;
    const file = path.join(dir, name);
    try {
      const record = JSON.parse(safeReadTextFile(file, projectDir).content);
      if (record && record.schema_version === '1') records.push({ ...record, file });
    } catch (_err) {
      records.push({ schema_version: '1', file, invalid: true });
    }
  }
  return records;
}

function recommendation(rollup) {
  if (rollup.records === 0) return 'record-first-run-result';
  if ((rollup.decision['fix-first'] || 0) > 0 || (rollup.decision['stop-and-fix'] || 0) > 0) return 'fix-first-run-friction';
  if ((rollup.health.fail || 0) > 0 || (rollup.smoke.fail || 0) > 0 || (rollup.profile.fail || 0) > 0) return 'fix-failing-first-run-checks';
  if ((rollup.decision.continue || 0) >= Math.max(1, rollup.records - (rollup.invalid_records || 0))) return 'continue-bounded-trials';
  return 'review-first-run-friction';
}

function buildRollup(records) {
  const rollup = {
    schema_version: '1',
    records: records.length,
    invalid_records: records.filter((record) => record.invalid).length,
  };
  for (const field of RESULT_FIELDS) rollup[field] = {};
  for (const record of records) {
    if (record.invalid) continue;
    for (const field of RESULT_FIELDS) countInto(rollup[field], record[field]);
  }
  for (const field of RESULT_FIELDS) rollup[field] = sortedCounts(rollup[field]);
  rollup.recommendation = recommendation(rollup);
  rollup.boundary = 'First-run rollup is local advisory evidence. Share aggregate counts only; keep raw result files private unless explicitly approved.';
  return rollup;
}

function rollupFirstRunResults(opts = {}) {
  const projectDir = path.resolve(opts.projectDir || path.join(process.cwd(), '.forgeflow', path.basename(process.cwd())));
  const records = readRecords(projectDir);
  const rollup = buildRollup(records);
  const out = path.resolve(opts.out || defaultOut(projectDir));
  writeFileSafe(out, renderMarkdown(rollup));
  return { ...rollup, out };
}

function renderMarkdown(rollup) {
  const lines = [
    '# Forgeflow First-Run Results Rollup',
    '',
    `Records: ${rollup.records}`,
    `Invalid records: ${rollup.invalid_records}`,
    `Recommendation: ${rollup.recommendation}`,
    '',
    rollup.boundary,
    '',
  ];
  for (const field of RESULT_FIELDS) {
    lines.push(`## ${field[0].toUpperCase()}${field.slice(1)}`, '');
    const entries = Object.entries(rollup[field] || {});
    if (entries.length === 0) lines.push('- (none)');
    else for (const [name, count] of entries) lines.push(`- ${name}: ${count}`);
    lines.push('');
  }
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const rollup = rollupFirstRunResults(opts);
  process.stdout.write(opts.json ? `${JSON.stringify(rollup, null, 2)}\n` : renderMarkdown(rollup));
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = { buildRollup, parseArgs, readRecords, renderMarkdown, rollupFirstRunResults };
