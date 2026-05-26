#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { appendFileSafe } = require('./file-safety');
const { containsSensitiveContent } = require('./privacy-boundary');

const VALID_CATEGORIES = new Set([
  'recurring-pitfall',
  'stable-decision',
  'risk-area',
  'validation-pattern',
  'hot-file',
  'repeated-follow-up',
  'recommended-approach',
]);
const VALID_CONFIDENCE = new Set(['low', 'medium', 'high']);
const VALID_STATUS = new Set(['active', 'stale', 'superseded']);

function usage() {
  console.error([
    'Usage: record-project-learning.js [--project-dir <dir>] --input <json-file> [--json]',
    '       record-project-learning.js [--project-dir <dir>] --category <category> --learning <text> [--source <text>] [--evidence <text>] [--confidence low|medium|high] [--evidence-count <n>] [--application-guidance <text>] [--status active|stale|superseded] [--superseded-by <text>] [--json]',
  ].join('\n'));
}

function parseArgs(argv) {
  const opts = {
    projectDir: '',
    input: '',
    category: '',
    learning: '',
    source: '',
    evidence: '',
    confidence: '',
    evidenceCount: null,
    applicationGuidance: '',
    status: '',
    supersededBy: '',
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project-dir') {
      opts.projectDir = path.resolve(argv[++i] || '');
    } else if (arg === '--input') {
      opts.input = path.resolve(argv[++i] || '');
    } else if (arg === '--category') {
      opts.category = argv[++i] || '';
    } else if (arg === '--learning') {
      opts.learning = argv[++i] || '';
    } else if (arg === '--source') {
      opts.source = argv[++i] || '';
    } else if (arg === '--evidence') {
      opts.evidence = argv[++i] || '';
    } else if (arg === '--confidence') {
      opts.confidence = argv[++i] || '';
    } else if (arg === '--evidence-count') {
      opts.evidenceCount = Number.parseInt(argv[++i] || '0', 10);
    } else if (arg === '--application-guidance') {
      opts.applicationGuidance = argv[++i] || '';
    } else if (arg === '--status') {
      opts.status = argv[++i] || '';
    } else if (arg === '--superseded-by') {
      opts.supersededBy = argv[++i] || '';
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

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) return '';
  return result.stdout.trimEnd();
}

function repoRoot(cwd = process.cwd()) {
  return git(['rev-parse', '--show-toplevel'], cwd) || cwd;
}

function defaultProjectDir(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').replace(/[|]/g, '/').trim();
}

function normalizeConfidence(value) {
  const confidence = cleanText(value || 'medium').toLowerCase();
  if (!VALID_CONFIDENCE.has(confidence)) {
    throw new Error('Invalid project learning confidence');
  }
  return confidence;
}

function normalizeEvidenceCount(value) {
  if (value === undefined || value === null || value === '') return 1;
  if (!/^\d+$/.test(String(value).trim())) {
    throw new Error('Project learning evidence_count must be a positive integer');
  }
  const count = Number.parseInt(String(value), 10);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('Project learning evidence_count must be a positive integer');
  }
  return count;
}

function normalizeApplicationGuidance(value) {
  const guidance = cleanText(value || '');
  if (guidance.length > 240) {
    throw new Error('Project learning application_guidance must be 240 characters or fewer');
  }
  return guidance;
}

function normalizeStatus(value) {
  const status = cleanText(value || 'active').toLowerCase();
  if (!VALID_STATUS.has(status)) {
    throw new Error('Invalid project learning status');
  }
  return status;
}

function normalizeSupersededBy(value) {
  const text = cleanText(value || '');
  if (text.length > 240) {
    throw new Error('Project learning superseded_by must be 240 characters or fewer');
  }
  return text;
}

function normalizeEntry(entry) {
  const normalized = {
    schema_version: '1',
    ts: cleanText(entry.ts || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')),
    category: cleanText(entry.category),
    learning: cleanText(entry.learning),
    source: cleanText(entry.source || 'Atlas'),
    evidence: cleanText(entry.evidence || ''),
    confidence: normalizeConfidence(entry.confidence),
    evidence_count: normalizeEvidenceCount(entry.evidence_count ?? entry.evidenceCount),
    application_guidance: normalizeApplicationGuidance(entry.application_guidance ?? entry.applicationGuidance),
    status: normalizeStatus(entry.status),
    superseded_by: normalizeSupersededBy(entry.superseded_by ?? entry.supersededBy),
  };
  if (!VALID_CATEGORIES.has(normalized.category)) {
    throw new Error('Invalid project learning category');
  }
  if (!normalized.learning) {
    throw new Error('Project learning is required');
  }
  const combined = `${normalized.category}\n${normalized.learning}\n${normalized.source}\n${normalized.evidence}\n${normalized.application_guidance}\n${normalized.superseded_by}`;
  if (containsSensitiveContent(combined)) {
    throw new Error('Project learning appears to contain sensitive content');
  }
  return normalized;
}

function loadEntries(opts) {
  if (opts.input) {
    const parsed = JSON.parse(fs.readFileSync(opts.input, 'utf8'));
    return (Array.isArray(parsed) ? parsed : [parsed]).map(normalizeEntry);
  }
  return [normalizeEntry({
    category: opts.category,
    learning: opts.learning,
    source: opts.source,
    evidence: opts.evidence,
    confidence: opts.confidence,
    evidenceCount: opts.evidenceCount,
    applicationGuidance: opts.applicationGuidance,
    status: opts.status,
    supersededBy: opts.supersededBy,
  })];
}

function recordProjectLearning(opts = {}) {
  const root = repoRoot();
  const projectDir = opts.projectDir || defaultProjectDir(root);
  const out = path.join(projectDir, 'project-learning-candidates.jsonl');
  const entries = loadEntries(opts);
  for (const entry of entries) {
    appendFileSafe(out, `${JSON.stringify(entry)}\n`);
  }
  return { file: out, entries: entries.length };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.input && (!opts.category || !opts.learning)) {
    usage();
    process.exit(2);
  }
  const result = recordProjectLearning(opts);
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Project learning candidates updated: ${result.file}`);
    console.log(`Entries appended: ${result.entries}`);
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
  VALID_CATEGORIES,
  VALID_CONFIDENCE,
  VALID_STATUS,
  containsSensitiveContent,
  parseArgs,
  recordProjectLearning,
};
