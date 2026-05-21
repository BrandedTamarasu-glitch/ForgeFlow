#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { safeReadTextFile, writeJsonSafe } = require('./file-safety');

const DEFAULT_MAX_TEXT_CHARS = 320;

function usage() {
  console.error('Usage: index-memory.js [--project-dir <dir>] [--out <path>] [--max-text-chars <n>] [--json]');
}

function parseArgs(argv) {
  const opts = {
    projectDir: '',
    out: '',
    maxTextChars: DEFAULT_MAX_TEXT_CHARS,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project-dir') {
      opts.projectDir = path.resolve(argv[++i] || '');
    } else if (arg === '--out') {
      opts.out = path.resolve(argv[++i] || '');
    } else if (arg === '--max-text-chars') {
      opts.maxTextChars = Number.parseInt(argv[++i] || `${DEFAULT_MAX_TEXT_CHARS}`, 10);
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

function defaultOut(projectDir) {
  return path.join(projectDir, 'index', 'memory-index.json');
}

function memoryFileNames() {
  return [
    'current-discussion.md',
    'current-research.md',
    'current-plan.md',
    'current-brief.md',
    'implementation-notes.md',
    'project-learnings.md',
    'patterns.md',
    'codebase-map.md',
    'review-history.md',
    'learnings.jsonl',
  ];
}

function tokenize(value) {
  return [...new Set(String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part.length >= 4)
    .slice(0, 40))];
}

function compact(value, maxChars) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!Number.isFinite(maxChars) || maxChars <= 0 || text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function record(source, line, kind, text, maxTextChars) {
  return {
    id: `${source}:${line}`,
    source,
    line,
    kind,
    text: compact(text, maxTextChars),
    keywords: tokenize(text),
  };
}

function indexMarkdown(source, content, maxTextChars) {
  const records = [];
  const lines = content.split(/\r?\n/);
  let currentHeading = '';
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) continue;
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      currentHeading = heading[2].trim();
      records.push(record(source, i + 1, 'heading', currentHeading, maxTextChars));
      continue;
    }
    if (/^[-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
      records.push(record(source, i + 1, 'bullet', `${currentHeading ? `${currentHeading}: ` : ''}${line}`, maxTextChars));
    }
  }
  return records;
}

function indexJsonl(source, content, maxTextChars) {
  const records = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const parsed = JSON.parse(line);
      const text = parsed.summary || parsed.finding || parsed.pattern || parsed.message || JSON.stringify(parsed);
      records.push(record(source, i + 1, 'jsonl', text, maxTextChars));
    } catch (_err) {
      records.push(record(source, i + 1, 'jsonl-invalid', line, maxTextChars));
    }
  }
  return records;
}

function buildMemoryIndex(opts = {}) {
  const root = repoRoot();
  const projectDir = opts.projectDir || defaultProjectDir(root);
  const out = opts.out || defaultOut(projectDir);
  const records = [];
  const sources = [];

  for (const name of memoryFileNames()) {
    const file = path.join(projectDir, name);
    if (!fs.existsSync(file)) continue;
    const { stat, content } = safeReadTextFile(file, projectDir);
    const rel = path.relative(root, file);
    sources.push({
      path: rel,
      bytes: stat.size,
      mtime_ms: Math.round(stat.mtimeMs),
    });
    const indexed = name.endsWith('.jsonl')
      ? indexJsonl(rel, content, opts.maxTextChars || DEFAULT_MAX_TEXT_CHARS)
      : indexMarkdown(rel, content, opts.maxTextChars || DEFAULT_MAX_TEXT_CHARS);
    records.push(...indexed);
  }

  const index = {
    schema_version: '1',
    generated_at: new Date().toISOString(),
    project_dir: path.relative(root, projectDir),
    sources,
    records,
  };

  fs.mkdirSync(path.dirname(out), { recursive: true });
  writeJsonSafe(out, index);
  return { out, index };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildMemoryIndex(opts);
  if (opts.json) {
    console.log(JSON.stringify({
      out: result.out,
      sources: result.index.sources.length,
      records: result.index.records.length,
    }, null, 2));
  } else {
    console.log(`Memory index: ${result.out}`);
    console.log(`Sources: ${result.index.sources.length}`);
    console.log(`Records: ${result.index.records.length}`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.stack || err.message);
    process.exit(1);
  }
}

module.exports = {
  buildMemoryIndex,
  indexJsonl,
  indexMarkdown,
  tokenize,
};
