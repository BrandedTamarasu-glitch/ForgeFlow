#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildLeanBenchmark,
  metricsFromBenchmark,
  metricsFromLeanReport,
  parseArgs,
  renderMarkdown,
} = require('./render-lean-benchmark');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-lean-benchmark-'));
const projectDir = path.join(root, '.forgeflow', 'Demo');
const contextDir = path.join(projectDir, 'context');
fs.mkdirSync(contextDir, { recursive: true });
const baselinePath = path.join(contextDir, 'baseline.json');
const currentPath = path.join(contextDir, 'current.json');
fs.writeFileSync(baselinePath, JSON.stringify({
  metrics: {
    work_items: 2,
    files_changed: 8,
    lines_added: 200,
    lines_removed: 20,
    validation_signals: 3,
    review_findings: 5,
    prose_warnings: 2,
    ceiling_captures: 0,
    context_saved_tokens: 1000,
    follow_up_signals: 4,
  },
}, null, 2));
fs.writeFileSync(currentPath, JSON.stringify({
  signals: {
    diff: { files_changed: 3, lines_added: 80, lines_removed: 10 },
    lean_decision: { validation_minimum_items: 2 },
    implementation_notes: { validation_mentions: 2, ceiling_notes: 1, follow_up_mentions: 1 },
    lean_review: { findings_count: 1 },
    output_contract: { lean_warning_count: 0 },
    context_tokens: { estimated_saved_tokens: 4000 },
  },
}, null, 2));

const result = buildLeanBenchmark({ root, projectDir, baseline: baselinePath, current: currentPath, write: true });
const markdown = renderMarkdown(result);
const thin = buildLeanBenchmark({ root, projectDir: path.join(root, '.forgeflow', 'Thin') });
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--baseline', baselinePath, '--current', currentPath, '--write', '--json']);
const invalidPath = path.join(contextDir, 'invalid.json');
fs.writeFileSync(invalidPath, '{nope');
const invalid = buildLeanBenchmark({ root, projectDir, baseline: invalidPath, current: currentPath });

let symlinkRejected = false;
const symlinkRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-lean-benchmark-link-'));
const symlinkProject = path.join(symlinkRoot, '.forgeflow', 'Demo');
fs.mkdirSync(path.dirname(symlinkProject), { recursive: true });
fs.symlinkSync(projectDir, symlinkProject);
try {
  buildLeanBenchmark({ root: symlinkRoot, projectDir: symlinkProject });
} catch (_err) {
  symlinkRejected = true;
}

const reportMetrics = metricsFromLeanReport(JSON.parse(fs.readFileSync(currentPath, 'utf8')));
const benchmarkMetrics = metricsFromBenchmark(JSON.parse(fs.readFileSync(baselinePath, 'utf8')));
const checks = [
  ['compares baseline and current', result.status === 'ready' && result.comparison.files_changed.delta === -5 && result.comparison.context_saved_tokens.delta === 3000],
  ['normalizes lean report metrics', reportMetrics.total_line_delta === 90 && reportMetrics.validation_signals === 4],
  ['normalizes benchmark metrics', benchmarkMetrics.total_line_delta === 220 && benchmarkMetrics.review_findings === 5],
  ['writes artifacts', fs.existsSync(path.join(contextDir, 'lean-benchmark.md')) && fs.existsSync(path.join(contextDir, 'lean-benchmark.json'))],
  ['renders boundaries', markdown.includes('no raw code snippets') && markdown.includes('sample size')],
  ['missing inputs are thin', thin.status === 'thin' && thin.decision === 'collect-baseline-and-current'],
  ['invalid inputs draw attention', invalid.status === 'attention' && invalid.invalid_artifacts.length === 1],
  ['parses args', opts.root === root && opts.projectDir === projectDir && opts.write && opts.json],
  ['symlink project rejected', symlinkRejected],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  for (const [name] of failed) console.error(`FAIL: ${name}`);
  process.exit(1);
}

console.log('lean benchmark: ok');
