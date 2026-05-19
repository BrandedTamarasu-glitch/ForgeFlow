#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const VALID_CATEGORIES = new Set([
  'recurring-pitfall',
  'stable-decision',
  'risk-area',
  'validation-pattern',
  'hot-file',
  'repeated-follow-up',
  'recommended-approach',
]);

function usage() {
  console.error([
    'Usage: record-project-learning.js [--project-dir <dir>] --input <json-file> [--json]',
    '       record-project-learning.js [--project-dir <dir>] --category <category> --learning <text> [--source <text>] [--evidence <text>] [--json]',
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

function containsSensitiveContent(value) {
  return [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
    /\b(api[_-]?key|password|passwd|secret|token)\s*[:=]/i,
    /\b[A-Z0-9]{20,}\b/,
    /https?:\/\/[^\s)]+/i,
  ].some((pattern) => pattern.test(String(value || '')));
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').replace(/[|]/g, '/').trim();
}

function normalizeEntry(entry) {
  const normalized = {
    schema_version: '1',
    ts: cleanText(entry.ts || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')),
    category: cleanText(entry.category),
    learning: cleanText(entry.learning),
    source: cleanText(entry.source || 'Atlas'),
    evidence: cleanText(entry.evidence || ''),
  };
  if (!VALID_CATEGORIES.has(normalized.category)) {
    throw new Error(`Invalid project learning category: ${normalized.category}`);
  }
  if (!normalized.learning) {
    throw new Error('Project learning is required');
  }
  const combined = `${normalized.category}\n${normalized.learning}\n${normalized.source}\n${normalized.evidence}`;
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
  })];
}

function recordProjectLearning(opts = {}) {
  const root = repoRoot();
  const projectDir = opts.projectDir || defaultProjectDir(root);
  const out = path.join(projectDir, 'project-learning-candidates.jsonl');
  const entries = loadEntries(opts);
  fs.mkdirSync(projectDir, { recursive: true });
  for (const entry of entries) {
    fs.appendFileSync(out, `${JSON.stringify(entry)}\n`);
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
  containsSensitiveContent,
  recordProjectLearning,
};
