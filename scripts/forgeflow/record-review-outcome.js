#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');

function usage() {
  console.error('Usage: record-review-outcome.js --input <outcome.json> [--out <jsonl>] [--summary <jsonl>] [--json]');
}

function parseArgs(argv) {
  const opts = {
    input: '',
    out: '',
    summary: '',
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input') {
      opts.input = argv[++i] || '';
    } else if (arg === '--out') {
      opts.out = argv[++i] || '';
    } else if (arg === '--summary') {
      opts.summary = argv[++i] || '';
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

function normalize(value) {
  return String(value || 'unknown').trim().toLowerCase().replace(/\s+/g, '-');
}

function defaultOutcomePath(cwd = process.cwd()) {
  return path.join(cwd, '.forgeflow', path.basename(cwd), 'review-outcomes.jsonl');
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function validateOutcome(record) {
  const errors = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return ['record must be an object'];
  }
  if (record.schema_version !== '1') errors.push('schema_version must be "1"');
  if (!record.change_id) errors.push('change_id is required');
  if (!record.review || typeof record.review !== 'object') errors.push('review object is required');
  if (!record.outcome || typeof record.outcome !== 'object') errors.push('outcome object is required');

  const review = record.review || {};
  if (!['skip-mode', 'thin-mode', 'full-mode', 'deep-mode'].includes(review.mode)) {
    errors.push('review.mode must be skip-mode, thin-mode, full-mode, or deep-mode');
  }
  if (!Array.isArray(review.agents_used)) errors.push('review.agents_used must be an array');
  if (!Array.isArray(review.verifier_decisions)) errors.push('review.verifier_decisions must be an array');

  const outcome = record.outcome || {};
  for (const field of ['findings_total', 'findings_confirmed', 'findings_rejected']) {
    if (!Number.isInteger(outcome[field]) || outcome[field] < 0) {
      errors.push(`outcome.${field} must be a non-negative integer`);
    }
  }
  if (outcome.findings_confirmed + outcome.findings_rejected > outcome.findings_total) {
    errors.push('confirmed plus rejected findings cannot exceed total findings');
  }
  if (typeof outcome.review_minutes !== 'number' || outcome.review_minutes < 0) {
    errors.push('outcome.review_minutes must be a non-negative number');
  }
  if (typeof outcome.auto_fix_success !== 'boolean') errors.push('outcome.auto_fix_success must be a boolean');
  if (typeof outcome.post_merge_regression !== 'boolean') errors.push('outcome.post_merge_regression must be a boolean');

  return errors;
}

function readOutcome(inputPath) {
  const record = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const errors = validateOutcome(record);
  if (errors.length > 0) {
    const err = new Error(errors.join('; '));
    err.validationErrors = errors;
    throw err;
  }
  return record;
}

function appendOutcome(record, outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.appendFileSync(outPath, `${JSON.stringify(record)}${os.EOL}`);
}

function emptySummary() {
  return {
    schema_version: '1',
    records: 0,
    modes: {},
    agents: {},
    totals: {
      findings_total: 0,
      findings_confirmed: 0,
      findings_rejected: 0,
      verifier_confirmed: 0,
      verifier_rejected: 0,
      verifier_blocked: 0,
      review_minutes: 0,
      auto_fix_success: 0,
      auto_fix_failed: 0,
      post_merge_regression: 0,
    },
    classes: {},
  };
}

function bucketFor(map, key) {
  if (!map[key]) {
    map[key] = {
      findings_total: 0,
      findings_confirmed: 0,
      findings_rejected: 0,
    };
  }
  return map[key];
}

function applyOutcome(summary, record) {
  const review = record.review;
  const outcome = record.outcome;
  summary.records += 1;
  summary.modes[review.mode] = (summary.modes[review.mode] || 0) + 1;

  for (const agent of asArray(review.agents_used)) {
    const key = normalize(agent);
    summary.agents[key] = (summary.agents[key] || 0) + 1;
  }

  summary.totals.findings_total += outcome.findings_total;
  summary.totals.findings_confirmed += outcome.findings_confirmed;
  summary.totals.findings_rejected += outcome.findings_rejected;
  summary.totals.review_minutes += outcome.review_minutes;
  summary.totals.auto_fix_success += outcome.auto_fix_success ? 1 : 0;
  summary.totals.auto_fix_failed += outcome.auto_fix_success ? 0 : 1;
  summary.totals.post_merge_regression += outcome.post_merge_regression ? 1 : 0;

  for (const decision of asArray(review.verifier_decisions)) {
    const normalizedDecision = normalize(decision.decision);
    if (normalizedDecision === 'confirmed') summary.totals.verifier_confirmed += 1;
    if (normalizedDecision === 'rejected') summary.totals.verifier_rejected += 1;
    if (normalizedDecision === 'blocked') summary.totals.verifier_blocked += 1;
  }

  for (const findingClass of asArray(outcome.finding_classes)) {
    const bucket = bucketFor(summary.classes, normalize(findingClass.class));
    bucket.findings_total += findingClass.total || 0;
    bucket.findings_confirmed += findingClass.confirmed || 0;
    bucket.findings_rejected += findingClass.rejected || 0;
  }
}

function readJsonl(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function summarize(records) {
  const summary = emptySummary();
  for (const record of records) {
    const errors = validateOutcome(record);
    if (errors.length > 0) continue;
    applyOutcome(summary, record);
  }
  summary.totals.review_minutes = Number(summary.totals.review_minutes.toFixed(2));
  summary.modes = sortObject(summary.modes);
  summary.agents = sortObject(summary.agents);
  summary.classes = sortObject(summary.classes);
  return summary;
}

function sortObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.summary) {
    const summary = summarize(readJsonl(opts.summary));
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return;
  }
  if (!opts.input) {
    usage();
    process.exit(2);
  }

  const record = readOutcome(opts.input);
  const outPath = opts.out || defaultOutcomePath();
  appendOutcome(record, outPath);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify({ written: outPath, change_id: record.change_id }, null, 2)}\n`);
  } else {
    console.log(`Review outcome written to ${outPath}`);
  }
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
  applyOutcome,
  defaultOutcomePath,
  summarize,
  validateOutcome,
};
