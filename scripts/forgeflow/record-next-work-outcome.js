#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { appendFileSafe, safeReadTextFile } = require('./file-safety');
const { containsSensitiveContent } = require('./privacy-boundary');

const OUTCOMES = new Set(['useful', 'ignored', 'incorrect', 'blocked']);
const CONFIDENCE = new Set(['low', 'medium', 'high']);
const PUBLIC_NAME_ALLOWLIST = new Set([
  'Agent',
  'Calibrate',
  'Claude',
  'Codex',
  'Context',
  'Forgeflow',
  'GitHub',
  'Health',
  'Helped',
  'JSON',
  'Markdown',
  'Profile',
  'Project',
  'README',
  'Release',
  'Review',
  'Smoke',
  'Triage',
  'User',
]);

function usage() {
  console.error('Usage: record-next-work-outcome.js --project-dir <dir> --title <text> --source <source> --outcome useful|ignored|incorrect|blocked [--summary <public-safe text>] [--confidence low|medium|high] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { confidence: 'medium', summary: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--title') {
      opts.title = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--source') {
      opts.source = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--outcome') {
      opts.outcome = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--summary') {
      opts.summary = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--confidence') {
      opts.confidence = requireValue(argv, arg, i);
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

function cleanText(value, name) {
  const text = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 220);
  if (!text) return '';
  if (containsSensitiveContent(text) || /[\\/]|```|`[^`]+`/.test(text)) throw new Error(`${name} contains private or source-specific content`);
  if (/(^|[\s"'(=:])(?:src|app|apps|packages|lib|server|client|components|routes|pages|scripts|commands)\/[A-Za-z0-9_./-]+(?:\.[A-Za-z0-9]+)?\b/.test(text)) {
    throw new Error(`${name} contains source-specific content`);
  }
  if (/\b(?:import|export|function|class|const|let|var|interface|type)\s+[A-Za-z_$][\w$]*(?:\s*[=({:]|\s+from\b)/.test(text)) {
    throw new Error(`${name} contains source-specific content`);
  }
  if (/\b(?:customer|client|tenant|account)\s+["']?[A-Z][A-Za-z0-9_-]{2,}\b/i.test(text)) {
    throw new Error(`${name} contains customer or private account name content`);
  }
  const properName = text.match(/\b[A-Z][a-z][A-Za-z0-9_-]{2,}\b/);
  if (properName && !PUBLIC_NAME_ALLOWLIST.has(properName[0])) {
    throw new Error(`${name} contains customer or private account name content`);
  }
  const upperName = text.match(/\b[A-Z][A-Z0-9_-]{2,}\b/);
  if (upperName && !PUBLIC_NAME_ALLOWLIST.has(upperName[0])) {
    throw new Error(`${name} contains customer or private account name content`);
  }
  return text;
}

function normalizeOutcome(opts = {}) {
  if (!opts.projectDir) throw new Error('Missing --project-dir');
  if (!opts.title) throw new Error('Missing --title');
  if (!opts.source) throw new Error('Missing --source');
  if (!OUTCOMES.has(opts.outcome)) throw new Error('Invalid --outcome');
  if (!CONFIDENCE.has(opts.confidence || 'medium')) throw new Error('Invalid --confidence');
  return {
    schema_version: '1',
    recorded_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    title: cleanText(opts.title, '--title'),
    source: cleanText(opts.source, '--source'),
    outcome: opts.outcome,
    confidence: opts.confidence || 'medium',
    summary: cleanText(opts.summary || '', '--summary'),
  };
}

function outcomeFile(projectDir) {
  return path.join(projectDir, 'next-work-outcomes.jsonl');
}

function recordNextWorkOutcome(opts = {}) {
  const record = normalizeOutcome(opts);
  const file = outcomeFile(opts.projectDir);
  appendFileSafe(file, `${JSON.stringify(record)}\n`);
  return { record, file };
}

function readNextWorkOutcomes(projectDir) {
  const file = outcomeFile(projectDir);
  if (!fs.existsSync(file)) return { status: 'missing', file, records: 0, invalid_lines: 0, by_outcome: {}, by_source: {}, confidence_calibration: {}, recommendation: 'record-next-work-outcomes' };
  const byOutcome = {};
  const bySource = {};
  const byConfidence = {};
  let records = 0;
  let invalid = 0;
  for (const line of safeReadTextFile(file, projectDir).content.split(/\r?\n/).filter(Boolean)) {
    try {
      const record = JSON.parse(line);
      if (!record || record.schema_version !== '1' || !OUTCOMES.has(record.outcome)) {
        invalid += 1;
        continue;
      }
      records += 1;
      byOutcome[record.outcome] = (byOutcome[record.outcome] || 0) + 1;
      bySource[record.source || 'unknown'] = (bySource[record.source || 'unknown'] || 0) + 1;
      const confidence = CONFIDENCE.has(record.confidence) ? record.confidence : 'medium';
      if (!byConfidence[confidence]) byConfidence[confidence] = { total: 0, useful: 0, corrective: 0 };
      byConfidence[confidence].total += 1;
      if (record.outcome === 'useful') byConfidence[confidence].useful += 1;
      else byConfidence[confidence].corrective += 1;
    } catch (_err) {
      invalid += 1;
    }
  }
  const corrective = (byOutcome.ignored || 0) + (byOutcome.incorrect || 0) + (byOutcome.blocked || 0);
  const confidenceCalibration = Object.fromEntries(Object.entries(byConfidence).map(([confidence, counts]) => [confidence, {
    ...counts,
    useful_rate: counts.total > 0 ? Number((counts.useful / counts.total).toFixed(2)) : 0,
  }]));
  return {
    status: records > 0 ? 'present' : 'empty',
    file,
    records,
    invalid_lines: invalid,
    by_outcome: byOutcome,
    by_source: bySource,
    confidence_calibration: confidenceCalibration,
    recommendation: corrective > 0 ? 'calibrate-next-work-selection' : 'continue-recording-next-work-outcomes',
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = recordNextWorkOutcome(opts);
  process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : `Next-work outcome recorded: ${result.file}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = { normalizeOutcome, parseArgs, readNextWorkOutcomes, recordNextWorkOutcome };
