#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildMemoryIndex, tokenize } = require('./index-memory');
const {
  contextTelemetry,
  sum,
  textChars,
  writeTelemetry,
} = require('./context-telemetry');
const { writeFileSafe } = require('./file-safety');
const { compactUserProfile } = require('./user-profile');

const DEFAULT_MAX_HITS = 40;
const DEFAULT_MAX_CHARS = 8000;
const MIN_MEMORY_CHARS_WITH_PROFILE = 1200;

function usage() {
  console.error([
    'Usage: build-memory-context.js [--query <text>] [--files <path>] [--project-dir <dir>]',
    '       [--out <path>] [--index-out <path>] [--telemetry-out <path>]',
    '       [--max-hits <n>] [--max-chars <n>] [--json]',
  ].join('\n'));
}

function parseArgs(argv) {
  const opts = {
    query: '',
    filesPath: '',
    projectDir: '',
    out: '',
    indexOut: '',
    telemetryOut: '',
    maxHits: DEFAULT_MAX_HITS,
    maxChars: DEFAULT_MAX_CHARS,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--query') {
      opts.query = argv[++i] || '';
    } else if (arg === '--files') {
      opts.filesPath = path.resolve(argv[++i] || '');
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(argv[++i] || '');
    } else if (arg === '--out') {
      opts.out = path.resolve(argv[++i] || '');
    } else if (arg === '--index-out') {
      opts.indexOut = path.resolve(argv[++i] || '');
    } else if (arg === '--telemetry-out') {
      opts.telemetryOut = path.resolve(argv[++i] || '');
    } else if (arg === '--max-hits') {
      opts.maxHits = Number.parseInt(argv[++i] || `${DEFAULT_MAX_HITS}`, 10);
    } else if (arg === '--max-chars') {
      opts.maxChars = Number.parseInt(argv[++i] || `${DEFAULT_MAX_CHARS}`, 10);
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

function defaultOut(root) {
  return path.join(defaultProjectDir(root), 'context', 'memory-context.md');
}

function defaultTelemetryOut(root) {
  return path.join(defaultProjectDir(root), 'context', 'memory-context-telemetry.json');
}

function readFileList(filesPath) {
  if (!filesPath || !fs.existsSync(filesPath)) return [];
  return fs.readFileSync(filesPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function keywordList(query, files) {
  const words = new Set(tokenize(query));
  for (const file of files) {
    for (const word of tokenize(file)) {
      words.add(word);
    }
  }
  return [...words].slice(0, 80);
}

function truncate(text, maxChars) {
  if (!Number.isFinite(maxChars)) return text;
  if (maxChars <= 0) return '';
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 80)).trimEnd()}\n\n[truncated to ${maxChars} chars]`;
}

function splitMemoryBudget(maxChars, userProfileBlock) {
  if (!Number.isFinite(maxChars)) {
    return { memoryChars: maxChars, profileChars: undefined };
  }
  if (maxChars <= 0) return { memoryChars: 0, profileChars: 0 };
  if (maxChars <= MIN_MEMORY_CHARS_WITH_PROFILE) {
    const profileChars = Math.min(userProfileBlock.length, Math.max(160, Math.floor(maxChars * 0.45)));
    return {
      memoryChars: Math.max(0, maxChars - profileChars - 2),
      profileChars,
    };
  }
  const reservedProfileChars = Math.min(
    Math.max(0, maxChars - MIN_MEMORY_CHARS_WITH_PROFILE),
    Math.min(userProfileBlock.length, 2200),
  );
  if (reservedProfileChars <= 0) return { memoryChars: maxChars, profileChars: Math.max(0, maxChars) };
  return {
    memoryChars: Math.max(0, maxChars - reservedProfileChars),
    profileChars: reservedProfileChars,
  };
}

function renderMemoryContext(root, indexPath, records, keys, maxHits, maxChars) {
  const hits = [];
  for (const record of records) {
    const text = String(record.text || '');
    const haystack = `${text} ${record.source || ''} ${(record.keywords || []).join(' ')}`.toLowerCase();
    const score = keys.reduce((sum, key) => sum + (haystack.includes(key) ? 1 : 0), 0);
    if (score > 0 || record.kind === 'heading') {
      hits.push({
        source: record.source || '(unknown)',
        line: record.line || 1,
        kind: record.kind || 'memory',
        text,
        score,
      });
    }
  }

  const selected = hits
    .sort((a, b) => b.score - a.score || a.source.localeCompare(b.source) || a.line - b.line)
    .slice(0, maxHits);
  const lines = [
    '# Forgeflow Memory Context',
    '',
    `Index: ${path.relative(root, indexPath)}`,
    `Keywords: ${keys.join(', ') || '(none)'}`,
    '',
  ];
  for (const hit of selected) {
    lines.push(`- ${hit.source}:${hit.line} [${hit.kind}] ${hit.text}`);
  }
  if (selected.length === 0) {
    lines.push('(no local memory hits)');
  }
  return {
    markdown: truncate(lines.join('\n'), maxChars),
    selected_count: selected.length,
  };
}

function buildMemoryContext(opts = {}) {
  const root = repoRoot();
  const projectDir = opts.projectDir || defaultProjectDir(root);
  const out = opts.out || defaultOut(root);
  const files = readFileList(opts.filesPath);
  const keys = keywordList(opts.query || '', files);
  const indexResult = buildMemoryIndex({
    projectDir,
    out: opts.indexOut || path.join(projectDir, 'index', 'memory-index.json'),
  });
  const records = Array.isArray(indexResult.index.records) ? indexResult.index.records : [];
  const userProfile = compactUserProfile({ root, projectDir }, 2200);
  const userProfileBlock = [
    '## User Profile Guidance',
    '',
    userProfile.markdown.replace(/^# Forgeflow User Profile[^\n]*\s*/u, '').trim() || '(none)',
  ].join('\n');
  const maxChars = Number.isFinite(opts.maxChars) ? opts.maxChars : DEFAULT_MAX_CHARS;
  const budget = splitMemoryBudget(maxChars, userProfileBlock);
  const rendered = renderMemoryContext(
    root,
    indexResult.out,
    records,
    keys,
    Number.isFinite(opts.maxHits) ? opts.maxHits : DEFAULT_MAX_HITS,
    budget.memoryChars,
  );
  const profileMarkdown = truncate(userProfileBlock, budget.profileChars);
  const markdown = [rendered.markdown, profileMarkdown].filter((section) => section.trim()).join('\n\n');

  fs.mkdirSync(path.dirname(out), { recursive: true });
  writeFileSafe(out, `${markdown}\n`);
  const rawMemoryChars = sum(indexResult.index.sources.map((source) => source.bytes || 0));
  const telemetry = contextTelemetry('memory-context', {
    baseline_chars: rawMemoryChars,
    compact_chars: textChars(markdown),
    detail: {
      sources: indexResult.index.sources.length,
      records: records.length,
      selected_count: rendered.selected_count,
      max_hits: opts.maxHits,
      max_chars: opts.maxChars,
    },
  });
  const telemetryOut = opts.telemetryOut || defaultTelemetryOut(root);
  writeTelemetry(telemetryOut, telemetry);
  return {
    out,
    index_path: indexResult.out,
    telemetry_path: telemetryOut,
    sources: indexResult.index.sources.length,
    records: records.length,
    selected_count: rendered.selected_count,
    markdown,
    telemetry,
    user_profile: {
      status: userProfile.result.check.status,
      injected: userProfile.injected,
      issue_count: userProfile.result.check.issues.length,
    },
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildMemoryContext(opts);
  if (opts.json) {
    console.log(JSON.stringify({
      out: result.out,
      index_path: result.index_path,
      telemetry_path: result.telemetry_path,
      sources: result.sources,
      records: result.records,
      selected_count: result.selected_count,
      estimated_saved_tokens: result.telemetry.estimated_saved_tokens,
    }, null, 2));
  } else {
    console.log(result.markdown);
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
  buildMemoryContext,
  keywordList,
  renderMemoryContext,
};
