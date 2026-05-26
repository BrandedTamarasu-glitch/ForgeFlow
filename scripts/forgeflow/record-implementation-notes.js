#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { containsSensitiveContent } = require('./privacy-boundary');

const VALID_CATEGORIES = new Set(['decision', 'spec-gap', 'tradeoff', 'deviation', 'follow-up', 'validation']);

function usage() {
  console.error([
    'Usage: record-implementation-notes.js [--project-dir <dir>] --input <json-file> [--json]',
    '       record-implementation-notes.js [--project-dir <dir>] --agent <name> --category <category> --note <text> [--why <text>] [--json]',
  ].join('\n'));
}

function parseArgs(argv) {
  const opts = {
    projectDir: '',
    input: '',
    agent: '',
    category: '',
    note: '',
    why: '',
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project-dir') {
      opts.projectDir = path.resolve(argv[++i] || '');
    } else if (arg === '--input') {
      opts.input = path.resolve(argv[++i] || '');
    } else if (arg === '--agent') {
      opts.agent = argv[++i] || '';
    } else if (arg === '--category') {
      opts.category = argv[++i] || '';
    } else if (arg === '--note') {
      opts.note = argv[++i] || '';
    } else if (arg === '--why') {
      opts.why = argv[++i] || '';
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

function notesTemplate(projectName) {
  return `# Implementation Notes

Running notes for decisions, spec gaps, tradeoffs, deviations, follow-ups, and validation details discovered during implementation.

## At a Glance

- Artifact: .forgeflow/${projectName}/implementation-notes.md
- Format: append-only Markdown
- Owner: Atlas serializes note candidates from implement agents; Arbiter verifies and may add final integration notes

## Decisions

## Spec Gaps

## Tradeoffs

## Deviations

## Follow-ups

## Validation Notes
`;
}

function headingFor(category) {
  return {
    decision: 'Decisions',
    'spec-gap': 'Spec Gaps',
    tradeoff: 'Tradeoffs',
    deviation: 'Deviations',
    'follow-up': 'Follow-ups',
    validation: 'Validation Notes',
  }[category];
}

function normalizeEntry(entry) {
  const normalized = {
    agent: String(entry.agent || '').trim(),
    category: String(entry.category || '').trim(),
    note: String(entry.note || '').trim(),
    why: String(entry.why || '').trim(),
    ts: String(entry.ts || '').trim(),
  };
  if (!normalized.agent) normalized.agent = 'Atlas';
  if (!VALID_CATEGORIES.has(normalized.category)) {
    throw new Error('Invalid implementation note category');
  }
  if (!normalized.note) {
    throw new Error('Implementation note is required');
  }
  const combined = `${normalized.agent}\n${normalized.note}\n${normalized.why}`;
  if (containsSensitiveContent(combined)) {
    throw new Error('Implementation note appears to contain sensitive content');
  }
  return normalized;
}

function loadEntries(opts) {
  if (opts.input) {
    const parsed = JSON.parse(fs.readFileSync(opts.input, 'utf8'));
    return (Array.isArray(parsed) ? parsed : [parsed]).map(normalizeEntry);
  }
  return [normalizeEntry({
    agent: opts.agent,
    category: opts.category,
    note: opts.note,
    why: opts.why,
  })];
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').replace(/[|]/g, '/').trim();
}

function renderEntry(entry, now = new Date()) {
  const stamp = entry.ts || now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const why = entry.why ? ` Why: ${cleanText(entry.why)}` : '';
  return `- ${stamp} | ${cleanText(entry.agent)} | ${entry.category} | ${cleanText(entry.note)}${why}`;
}

function ensureNotesFile(projectDir) {
  fs.mkdirSync(projectDir, { recursive: true });
  const file = path.join(projectDir, 'implementation-notes.md');
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, notesTemplate(path.basename(projectDir)));
  }
  return file;
}

function appendUnderHeading(content, heading, lines) {
  const marker = `## ${heading}`;
  const index = content.indexOf(marker);
  if (index === -1) {
    return `${content.trimEnd()}\n\n${marker}\n\n${lines.join('\n')}\n`;
  }
  const afterHeading = content.indexOf('\n', index);
  const nextHeading = content.slice(afterHeading + 1).search(/\n## /);
  const insertAt = nextHeading === -1 ? content.length : afterHeading + 1 + nextHeading + 1;
  const before = content.slice(0, insertAt).trimEnd();
  const after = content.slice(insertAt);
  return `${before}\n\n${lines.join('\n')}\n${after.startsWith('\n') ? after : `\n${after}`}`;
}

function recordImplementationNotes(opts = {}) {
  const root = repoRoot();
  const projectDir = opts.projectDir || defaultProjectDir(root);
  const file = ensureNotesFile(projectDir);
  const entries = loadEntries(opts);
  let content = fs.readFileSync(file, 'utf8');
  const now = new Date();
  for (const category of VALID_CATEGORIES) {
    const lines = entries
      .filter((entry) => entry.category === category)
      .map((entry) => renderEntry(entry, now));
    if (lines.length > 0) {
      content = appendUnderHeading(content, headingFor(category), lines);
    }
  }
  fs.writeFileSync(file, content.endsWith('\n') ? content : `${content}\n`);
  return { file, entries: entries.length };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.input && (!opts.category || !opts.note)) {
    usage();
    process.exit(2);
  }
  const result = recordImplementationNotes(opts);
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Implementation notes updated: ${result.file}`);
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
  recordImplementationNotes,
};
