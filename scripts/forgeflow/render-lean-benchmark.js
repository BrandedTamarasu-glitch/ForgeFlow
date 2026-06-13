#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { isPathInside, safeReadTextFile, writeFileSafe, writeJsonSafe } = require('./file-safety');

const BOUNDARIES = [
  'local-only',
  'aggregate-first',
  'no raw code snippets',
  'no hosted telemetry',
  'no automatic workflow changes',
  'no performance claims without visible sample size',
];

function usage() {
  console.error('Usage: render-lean-benchmark.js [--root <repo>] [--project-dir <dir>] [--baseline <json>] [--current <json>] [--write] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', baseline: '', current: '', write: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--baseline') {
      opts.baseline = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--current') {
      opts.current = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--write') {
      opts.write = true;
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

function isoNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function safeProjectDir(projectDir) {
  const resolved = path.resolve(projectDir);
  if (!fs.existsSync(resolved)) return resolved;
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) throw new Error(`Refusing symlinked project directory: ${projectDir}`);
  if (!stat.isDirectory()) throw new Error(`Project directory is not a directory: ${projectDir}`);
  return resolved;
}

function readJson(file, projectDir, label, invalid) {
  if (!file || !fs.existsSync(file)) return { label, status: 'missing', path: file, value: null };
  try {
    const value = JSON.parse(safeReadTextFile(file, projectDir).content);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('expected JSON object');
    return { label, status: 'present', path: file, value };
  } catch (err) {
    invalid.push({ label, path: file, reason: err.message });
    return { label, status: 'invalid', path: file, value: null };
  }
}

function num(value) {
  return Number(value || 0) || 0;
}

function metricsFromLeanReport(value = {}) {
  const signals = value.signals || {};
  const diff = signals.diff || {};
  const leanReview = signals.lean_review || {};
  const output = signals.output_contract || {};
  const notes = signals.implementation_notes || {};
  const tokens = signals.context_tokens || {};
  const decision = signals.lean_decision || {};
  return {
    work_items: 1,
    files_changed: num(diff.files_changed),
    lines_added: num(diff.lines_added),
    lines_removed: num(diff.lines_removed),
    total_line_delta: num(diff.lines_added) + num(diff.lines_removed),
    validation_signals: num(decision.validation_minimum_items) + num(notes.validation_mentions),
    review_findings: num(leanReview.findings_count),
    prose_warnings: num(output.lean_warning_count),
    ceiling_captures: num(notes.ceiling_notes),
    context_saved_tokens: num(tokens.estimated_saved_tokens),
    follow_up_signals: num(notes.follow_up_mentions),
  };
}

function metricsFromBenchmark(value = {}) {
  const metrics = value.metrics || value;
  return {
    work_items: num(metrics.work_items || metrics.sample_size || 1),
    files_changed: num(metrics.files_changed),
    lines_added: num(metrics.lines_added),
    lines_removed: num(metrics.lines_removed),
    total_line_delta: num(metrics.total_line_delta || num(metrics.lines_added) + num(metrics.lines_removed)),
    validation_signals: num(metrics.validation_signals || metrics.validation_mentions),
    review_findings: num(metrics.review_findings || metrics.findings_count),
    prose_warnings: num(metrics.prose_warnings || metrics.lean_warning_count),
    ceiling_captures: num(metrics.ceiling_captures || metrics.ceiling_notes),
    context_saved_tokens: num(metrics.context_saved_tokens || metrics.estimated_saved_tokens),
    follow_up_signals: num(metrics.follow_up_signals || metrics.follow_up_mentions),
  };
}

function normalizeMetrics(source) {
  const value = source.value || {};
  if (value.signals) return metricsFromLeanReport(value);
  return metricsFromBenchmark(value);
}

function delta(current, baseline) {
  const keys = Object.keys(current);
  return Object.fromEntries(keys.map((key) => [key, {
    baseline: num(baseline[key]),
    current: num(current[key]),
    delta: num(current[key]) - num(baseline[key]),
  }]));
}

function decideStatus({ baseline, current, invalid }) {
  if (invalid.length) return { status: 'attention', decision: 'fix-inputs', reason: 'One or more benchmark inputs are invalid or unsafe to read.' };
  if (!baseline || !current) return { status: 'thin', decision: 'collect-baseline-and-current', reason: 'Benchmark needs both baseline and current aggregate artifacts.' };
  if (num(baseline.work_items) < 1 || num(current.work_items) < 1) return { status: 'thin', decision: 'collect-sample-size', reason: 'Sample size must be visible before comparing lean impact.' };
  return { status: 'ready', decision: 'compare-local-signals', reason: 'Baseline and current aggregate metrics are available for local comparison.' };
}

function outputPath(projectDir, basename) {
  const file = path.join(projectDir, 'context', basename);
  const resolved = path.resolve(file);
  if (!isPathInside(path.resolve(projectDir), resolved)) throw new Error('Lean benchmark output must stay inside --project-dir');
  return resolved;
}

function buildLeanBenchmark(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = safeProjectDir(opts.projectDir || defaultProjectDir(root));
  const contextDir = path.join(projectDir, 'context');
  const invalid = [];
  const baselinePath = opts.baseline || path.join(contextDir, 'lean-benchmark-baseline.json');
  const currentPath = opts.current || path.join(contextDir, 'lean-report.json');
  const baselineSource = readJson(baselinePath, projectDir, 'baseline', invalid);
  const currentSource = readJson(currentPath, projectDir, 'current', invalid);
  const baseline = baselineSource.status === 'present' ? normalizeMetrics(baselineSource) : null;
  const current = currentSource.status === 'present' ? normalizeMetrics(currentSource) : null;
  const verdict = decideStatus({ baseline, current, invalid });
  const result = {
    schema_version: '1',
    generated_at: isoNow(),
    root,
    project_dir: projectDir,
    status: verdict.status,
    decision: verdict.decision,
    reason: verdict.reason,
    sources: {
      baseline: { status: baselineSource.status, path: baselineSource.path },
      current: { status: currentSource.status, path: currentSource.path },
    },
    metrics: { baseline, current },
    comparison: baseline && current ? delta(current, baseline) : {},
    invalid_artifacts: invalid,
    automation_boundaries: BOUNDARIES,
    boundary: `Read-only lean benchmark; ${BOUNDARIES.join(', ')}.`,
    next: verdict.status === 'ready' ? '/forgeflow-lean-report --write' : '/forgeflow-lean-benchmark --baseline <json> --current <json>',
    next_reason: verdict.reason,
    artifacts: {},
  };
  if (opts.write) {
    const markdownPath = outputPath(projectDir, 'lean-benchmark.md');
    const jsonPath = outputPath(projectDir, 'lean-benchmark.json');
    writeFileSafe(markdownPath, renderMarkdown(result));
    writeJsonSafe(jsonPath, result);
    result.artifacts = { markdown: markdownPath, json: jsonPath };
  }
  return result;
}

function renderMetricLine(name, item) {
  return `- ${name}: baseline ${item.baseline}, current ${item.current}, delta ${item.delta}`;
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Lean Benchmark',
    '',
    `Generated at: ${result.generated_at}`,
    `Status: ${result.status}`,
    `Decision: ${result.decision}`,
    '',
    result.boundary,
    '',
    '## Sources',
    '',
    `- Baseline: ${result.sources.baseline.status} (${result.sources.baseline.path})`,
    `- Current: ${result.sources.current.status} (${result.sources.current.path})`,
    '',
    '## Comparison',
    '',
  ];
  const entries = Object.entries(result.comparison || {});
  if (!entries.length) lines.push('- Not enough aggregate evidence yet.');
  else for (const [key, item] of entries) lines.push(renderMetricLine(key, item));
  lines.push('', '## Boundaries', '');
  for (const item of result.automation_boundaries) lines.push(`- ${item}`);
  lines.push('', '## Invalid Artifacts', '');
  if (result.invalid_artifacts.length === 0) lines.push('- None.');
  else for (const item of result.invalid_artifacts) lines.push(`- ${item.label}: ${item.reason}`);
  lines.push('', `Next: ${result.next}`, `Why: ${result.next_reason}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildLeanBenchmark(opts);
  process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
  if (result.status === 'attention') process.exit(1);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`lean benchmark failed: ${err.message}`);
    usage();
    process.exit(1);
  }
}

module.exports = {
  buildLeanBenchmark,
  metricsFromBenchmark,
  metricsFromLeanReport,
  parseArgs,
  renderMarkdown,
};
