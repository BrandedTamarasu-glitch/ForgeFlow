#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { safeReadTextFile } = require('./file-safety');
const { buildLearningStatus } = require('./show-learning-status');

function usage() {
  console.error('Usage: show-project-health-timeline.js [--root <dir>] [--project-dir <dir>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
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

function readJsonl(file, root) {
  if (!fs.existsSync(file)) return [];
  return safeReadTextFile(file, root).content.split(/\r?\n/).filter(Boolean).map((line) => {
    try {
      return JSON.parse(line);
    } catch (_err) {
      return null;
    }
  }).filter(Boolean);
}

function readJson(file, root) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(safeReadTextFile(file, root).content);
  } catch (_err) {
    return null;
  }
}

function item(date, kind, status, summary, source, details = {}) {
  return {
    date: date || '',
    kind,
    status: status || 'unknown',
    summary,
    source,
    details,
  };
}

function compareLastTwo(events) {
  const deltas = [];
  const byKind = new Map();
  for (const event of events) {
    if (!byKind.has(event.kind)) byKind.set(event.kind, []);
    byKind.get(event.kind).push(event);
  }
  for (const [kind, items] of byKind.entries()) {
    if (items.length < 2) continue;
    const before = items[items.length - 2];
    const after = items[items.length - 1];
    if (before.status !== after.status) {
      deltas.push({
        kind,
        status: after.status === 'pass' || after.status === 'injected' ? 'improved' : 'changed',
        summary: `${kind} moved from ${before.status} to ${after.status}`,
      });
    } else if (before.summary !== after.summary) {
      deltas.push({
        kind,
        status: 'changed',
        summary: `${kind} changed from "${before.summary}" to "${after.summary}"`,
      });
    }
  }
  return deltas;
}

function buildProjectHealthTimeline(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const events = [];
  const codeMapHistory = readJsonl(path.join(projectDir, 'context', 'code-map-history.jsonl'), projectDir);
  for (const record of codeMapHistory.slice(-8)) {
    const summary = record.summary || {};
    const provenance = summary.provenance || record.provenance || {};
    events.push(item(
      summary.generated_at || record.generated_at,
      'code-map',
      'recorded',
      `${summary.summary ? summary.summary.source_files : 0} source files, ${summary.summary ? summary.summary.local_edges : 0} local edges, ${summary.summary ? summary.summary.changed_sections || 0 : 0} changed sections`,
      'context/code-map-history.jsonl',
      { commit: provenance.commit_short || '', dirty: Boolean(provenance.dirty) },
    ));
  }
  const advisorHistory = readJsonl(path.join(projectDir, '..', 'context-advisor-history.jsonl'), path.dirname(projectDir));
  for (const record of advisorHistory.slice(-5)) {
    events.push(item(
      record.generated_at,
      'context-advisor',
      record.status,
      `${record.recommendations ? record.recommendations.length : 0} recommendation(s), ${record.savings_pct || 0}% savings`,
      '../context-advisor-history.jsonl',
      { over_budget: Boolean(record.over_budget) },
    ));
  }
  const latestInsights = readJson(path.join(projectDir, 'context', 'latest', 'latest-insights-report.json'), projectDir);
  if (latestInsights) {
    events.push(item(
      latestInsights.generated_at,
      'latest-insights',
      latestInsights.status,
      `${latestInsights.reason || 'latest insights'} (${latestInsights.issue_count || 0} issue(s))`,
      'context/latest/latest-insights-report.json',
      { git: latestInsights.git || null },
    ));
  }
  const learningStatus = buildLearningStatus({ root, projectDir });
  events.push(item(
    learningStatus.generated_at,
    'learning-status',
    learningStatus.status,
    `${learningStatus.sections.length} signal(s), quality ${learningStatus.signal_quality.average_score}`,
    'show-learning-status',
    { recommendations: learningStatus.recommendations.length, quality_status: learningStatus.signal_quality.status },
  ));
  const sorted = events.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  const deltas = compareLastTwo(sorted);
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    project_dir: projectDir,
    status: sorted.some((event) => ['fail', 'blocked', 'attention', 'stale', 'missing'].includes(event.status)) ? 'attention' : 'pass',
    event_count: sorted.length,
    events: sorted.slice(-20),
    deltas,
    next: sorted.length === 0 ? '/forgeflow-trends --refresh' : '/forgeflow-trends --refresh before relying on stale timeline signals',
    boundary: 'Project health timeline is local and advisory. It does not refresh artifacts, approve work, or change project files.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Project Health Timeline',
    '',
    `Status: ${result.status}`,
    `Events: ${result.event_count}`,
    `Project: ${result.project_dir}`,
    '',
    result.boundary,
    '',
    '## Timeline',
    '',
  ];
  if (result.events.length === 0) lines.push('- No timeline events found.');
  else for (const event of result.events) {
    lines.push(`- ${event.date || '(unknown date)'} ${event.kind}: ${event.status} - ${event.summary}`);
    lines.push(`  - Source: ${event.source}`);
  }
  lines.push('', '## Deltas', '');
  if (!result.deltas || result.deltas.length === 0) lines.push('- No comparable deltas found.');
  else for (const delta of result.deltas) lines.push(`- ${delta.kind}: ${delta.status} - ${delta.summary}`);
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildProjectHealthTimeline(opts);
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

module.exports = { buildProjectHealthTimeline, parseArgs, renderMarkdown };
