#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function usage() {
  console.error('Usage: summarize-context-telemetry.js [--root <dir>] [--file <json>] [--json]');
}

function parseArgs(argv) {
  const opts = {
    root: '',
    files: [],
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(argv[++i] || '');
    } else if (arg === '--file') {
      opts.files.push(path.resolve(argv[++i] || ''));
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

function isTelemetryFile(file) {
  const name = path.basename(file);
  return name === 'context-telemetry.json' || name === 'memory-context-telemetry.json' || name === 'scope-telemetry.json';
}

function walk(dir, files = []) {
  if (!dir || !fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(file, files);
    } else if (entry.isFile() && isTelemetryFile(file)) {
      files.push(file);
    }
  }
  return files;
}

function emptySummary() {
  return {
    schema_version: '1',
    files: 0,
    skipped: 0,
    totals: {
      baseline_chars: 0,
      compact_chars: 0,
      saved_chars: 0,
      estimated_baseline_tokens: 0,
      estimated_compact_tokens: 0,
      estimated_saved_tokens: 0,
    },
    by_kind: {},
    source_files: [],
  };
}

function bucketFor(summary, kind) {
  if (!summary.by_kind[kind]) {
    summary.by_kind[kind] = {
      files: 0,
      baseline_chars: 0,
      compact_chars: 0,
      saved_chars: 0,
      estimated_baseline_tokens: 0,
      estimated_compact_tokens: 0,
      estimated_saved_tokens: 0,
    };
  }
  return summary.by_kind[kind];
}

function addTelemetry(summary, file, telemetry) {
  if (!telemetry || telemetry.schema_version !== '1') {
    summary.skipped += 1;
    return;
  }
  const kind = telemetry.kind || 'unknown';
  const bucket = bucketFor(summary, kind);
  summary.files += 1;
  summary.source_files.push(file);
  bucket.files += 1;

  for (const key of Object.keys(summary.totals)) {
    const value = Number(telemetry[key] || 0);
    summary.totals[key] += value;
    bucket[key] += value;
  }
}

function finalize(summary) {
  summary.percent_saved = summary.totals.baseline_chars > 0
    ? Number(((summary.totals.saved_chars / summary.totals.baseline_chars) * 100).toFixed(2))
    : 0;
  for (const bucket of Object.values(summary.by_kind)) {
    bucket.percent_saved = bucket.baseline_chars > 0
      ? Number(((bucket.saved_chars / bucket.baseline_chars) * 100).toFixed(2))
      : 0;
  }
  summary.by_kind = Object.fromEntries(Object.entries(summary.by_kind).sort(([a], [b]) => a.localeCompare(b)));
  summary.source_files.sort();
  return summary;
}

function summarize(files) {
  const summary = emptySummary();
  for (const file of files) {
    try {
      addTelemetry(summary, file, JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch (_err) {
      summary.skipped += 1;
    }
  }
  return finalize(summary);
}

function renderMarkdown(summary) {
  return [
    '# Forgeflow Context Savings',
    '',
    `Files: ${summary.files}`,
    `Estimated saved tokens: ${summary.totals.estimated_saved_tokens}`,
    `Percent saved: ${summary.percent_saved}%`,
    '',
    '| Kind | Files | Baseline Tokens | Compact Tokens | Saved Tokens | Saved |',
    '|---|---:|---:|---:|---:|---:|',
    ...Object.entries(summary.by_kind).map(([kind, bucket]) => (
      `| ${kind} | ${bucket.files} | ${bucket.estimated_baseline_tokens} | ${bucket.estimated_compact_tokens} | ${bucket.estimated_saved_tokens} | ${bucket.percent_saved}% |`
    )),
  ].join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const files = opts.files.length > 0 ? opts.files : walk(opts.root || defaultRoot());
  const summary = summarize(files);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } else {
    console.log(renderMarkdown(summary));
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
  addTelemetry,
  renderMarkdown,
  summarize,
  walk,
};
