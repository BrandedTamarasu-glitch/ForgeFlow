#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { estimateTokens } = require('./context-telemetry');
const { safeReadTextFile } = require('./file-safety');

const DEFAULT_MAX_HISTORY = 50;
const DEFAULT_STALE_DAYS = 30;

function usage() {
  console.error('Usage: render-context-retention.js [--root <repo>] [--project-dir <dir>] [--max-history <n>] [--stale-days <n>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseArgs(argv) {
  const opts = {
    root: process.cwd(),
    projectDir: '',
    maxHistory: DEFAULT_MAX_HISTORY,
    staleDays: DEFAULT_STALE_DAYS,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--max-history') {
      opts.maxHistory = positiveInt(requireValue(argv, arg, i), DEFAULT_MAX_HISTORY);
      i += 1;
    } else if (arg === '--stale-days') {
      opts.staleDays = positiveInt(requireValue(argv, arg, i), DEFAULT_STALE_DAYS);
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

function defaultProjectDir(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function walkFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function readJsonlCount(file, root) {
  if (!fs.existsSync(file)) return 0;
  return safeReadTextFile(file, root).content.split(/\r?\n/).filter(Boolean).length;
}

function latestMtime(files) {
  let latest = 0;
  for (const file of files) {
    try {
      latest = Math.max(latest, fs.statSync(file).mtimeMs);
    } catch (_err) {
      // Ignore files that disappear during the read-only scan.
    }
  }
  return latest;
}

function daysOld(ms, now = Date.now()) {
  if (!ms) return null;
  return Number(((now - ms) / 86400000).toFixed(1));
}

function artifactBucket(name, dir, root, now, staleDays) {
  const files = walkFiles(dir);
  const bytes = files.reduce((sum, file) => {
    try {
      return sum + fs.statSync(file).size;
    } catch (_err) {
      return sum;
    }
  }, 0);
  const latest = latestMtime(files);
  const age = daysOld(latest, now);
  const status = files.length === 0
    ? 'missing'
    : (age !== null && age > staleDays ? 'stale' : 'current');
  return {
    name,
    path: dir,
    exists: fs.existsSync(dir),
    files: files.length,
    bytes,
    estimated_tokens: estimateTokens(bytes),
    latest_mtime: latest ? new Date(latest).toISOString().replace(/\.\d{3}Z$/, 'Z') : '',
    age_days: age,
    status,
    examples: files.slice(0, 5).map((file) => path.relative(root, file)),
  };
}

function historyFile(name, file, root, maxHistory) {
  const records = readJsonlCount(file, root);
  return {
    name,
    path: file,
    exists: fs.existsSync(file),
    records,
    max_records: maxHistory,
    over_by: Math.max(0, records - maxHistory),
    status: records > maxHistory ? 'attention' : (records > 0 ? 'pass' : 'missing'),
  };
}

function buildContextRetention(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const maxHistory = positiveInt(opts.maxHistory, DEFAULT_MAX_HISTORY);
  const staleDays = positiveInt(opts.staleDays, DEFAULT_STALE_DAYS);
  const now = opts.now ? new Date(opts.now).getTime() : Date.now();
  const contextDir = path.join(projectDir, 'context');
  const buckets = [
    artifactBucket('latest', path.join(contextDir, 'latest'), projectDir, now, staleDays),
    artifactBucket('agent-packets', path.join(contextDir, 'agent-packets'), projectDir, now, staleDays),
    artifactBucket('context-root', contextDir, projectDir, now, staleDays),
  ];
  const histories = [
    historyFile('code-map-history', path.join(contextDir, 'code-map-history.jsonl'), projectDir, maxHistory),
    historyFile('context-advisor-history', path.join(projectDir, '..', 'context-advisor-history.jsonl'), path.dirname(projectDir), maxHistory),
  ];
  const recommendations = [];
  for (const bucket of buckets) {
    if (bucket.status === 'stale') {
      recommendations.push({
        severity: 'attention',
        action: 'refresh-or-archive-stale-context',
        target: bucket.name,
        reason: `${bucket.name} has not changed for ${bucket.age_days} day(s). Refresh before injecting it into agents, or archive it manually if it belongs to old work.`,
      });
    }
    if (bucket.estimated_tokens > 16000) {
      recommendations.push({
        severity: 'attention',
        action: 'compact-context-artifacts',
        target: bucket.name,
        reason: `${bucket.name} is about ${bucket.estimated_tokens} estimated tokens. Prefer scoped packets before loading broad artifacts.`,
      });
    }
  }
  for (const history of histories) {
    if (history.over_by > 0) {
      recommendations.push({
        severity: 'attention',
        action: 'trim-history-retention',
        target: history.name,
        reason: `${history.name} has ${history.records} record(s), ${history.over_by} over the configured ${history.max_records} record retention target.`,
      });
    }
  }
  if (recommendations.length === 0) {
    recommendations.push({
      severity: 'info',
      action: 'keep-current-retention',
      target: 'context',
      reason: 'Context artifacts are within the read-only retention and freshness targets.',
    });
  }
  const status = recommendations.some((item) => item.severity === 'attention') ? 'attention' : 'pass';
  return {
    schema_version: '1',
    generated_at: new Date(now).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    project_dir: projectDir,
    context_dir: contextDir,
    status,
    policy: {
      max_history_records: maxHistory,
      stale_after_days: staleDays,
      read_only: true,
    },
    buckets,
    histories,
    recommendations,
    boundary: 'Context retention review is read-only. It does not delete, archive, compact, refresh, or mutate local artifacts.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Context Retention',
    '',
    `Status: ${result.status}`,
    `Project: ${result.project_dir}`,
    `Policy: keep ${result.policy.max_history_records} history records, stale after ${result.policy.stale_after_days} day(s)`,
    '',
    result.boundary,
    '',
    '## Buckets',
    '',
  ];
  for (const bucket of result.buckets) {
    lines.push(`- ${bucket.name}: ${bucket.status}, ${bucket.files} file(s), ${bucket.estimated_tokens} estimated token(s)`);
    lines.push(`  - Path: ${bucket.path}`);
    if (bucket.latest_mtime) lines.push(`  - Latest: ${bucket.latest_mtime} (${bucket.age_days} day(s) old)`);
  }
  lines.push('', '## Histories', '');
  for (const history of result.histories) {
    lines.push(`- ${history.name}: ${history.status}, ${history.records}/${history.max_records} record(s)`);
    lines.push(`  - Path: ${history.path}`);
  }
  lines.push('', '## Recommendations', '');
  for (const recommendation of result.recommendations) {
    lines.push(`- ${recommendation.severity}: ${recommendation.action} (${recommendation.target})`);
    lines.push(`  - ${recommendation.reason}`);
  }
  lines.push('');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildContextRetention(opts);
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

module.exports = { buildContextRetention, parseArgs, renderMarkdown };
