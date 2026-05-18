#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  attachContextEvaluation,
  buildEvaluation,
  buildContextEvaluation,
  readOutcomes,
  renderMarkdown,
} = require('./render-evaluation-report');

const repoRoot = path.resolve(__dirname, '..', '..');
const fixture = path.join(repoRoot, 'fixtures/evaluation/sample-outcomes.jsonl');
const comparisonFixture = path.join(repoRoot, 'fixtures/evaluation/comparison-outcomes.jsonl');
const { records, rejected } = readOutcomes(fixture);
const report = buildEvaluation(records, rejected);
const comparisonInput = readOutcomes(comparisonFixture);
const comparison = buildEvaluation(comparisonInput.records, comparisonInput.rejected);

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-eval-report-'));
const contextDir = path.join(tmpDir, 'context');
fs.mkdirSync(contextDir, { recursive: true });
const contextFile = path.join(contextDir, 'context-telemetry.json');
fs.writeFileSync(contextFile, `${JSON.stringify({
  schema_version: '1',
  kind: 'context-pack',
  baseline_chars: 400,
  compact_chars: 100,
  saved_chars: 300,
  estimated_baseline_tokens: 100,
  estimated_compact_tokens: 25,
  estimated_saved_tokens: 75,
})}\n`);
const context = buildContextEvaluation([contextFile]);
const reportWithContext = attachContextEvaluation(report, context);
const markdown = renderMarkdown(reportWithContext);
const outFile = path.join(tmpDir, 'evaluation.md');
const script = path.join(repoRoot, 'scripts/forgeflow/render-evaluation-report.js');
const result = spawnSync(process.execPath, [script, '--outcomes', fixture, '--context-file', contextFile, '--out', outFile], {
  encoding: 'utf8',
});

const checks = [
  ['records', report.records === 1],
  ['confirmed count', report.totals.findings_confirmed === 2],
  ['rejected count', report.totals.findings_rejected === 1],
  ['confirmation rate', report.rates.confirmation_rate_pct === 66.7],
  ['false positive rate', report.rates.false_positive_rate_pct === 33.3],
  ['average minutes', report.rates.average_review_minutes === 18.5],
  ['findings per review', report.rates.findings_per_review === 3],
  ['confirmed per hour', report.rates.confirmed_findings_per_hour === 6.49],
  ['auto fix failure rate', report.rates.auto_fix_failure_rate_pct === 0],
  ['context files', context.files === 1],
  ['context saved tokens', context.estimated_saved_tokens === 75],
  ['context budget status', context.budget_status === 'pass'],
  ['default workflow', report.workflows.forgeflow.records === 1],
  ['comparison no-agent', comparison.workflows['no-agent'].average_review_minutes === 31],
  ['comparison single-agent', comparison.workflows['single-agent'].false_positive_rate_pct === 50],
  ['comparison forgeflow', comparison.workflows.forgeflow.confirmation_rate_pct === 66.7],
  ['markdown title', markdown.includes('# Forgeflow Evaluation Report')],
  ['markdown workflow table', markdown.includes('## Workflow Comparison')],
  ['markdown efficiency table', markdown.includes('## Efficiency')],
  ['markdown context table', markdown.includes('## Context Efficiency')],
  ['markdown class table', markdown.includes('| accessibility | 1 | 1 | 0 |')],
  ['cli exit', result.status === 0],
  ['cli wrote report', fs.existsSync(outFile) && fs.readFileSync(outFile, 'utf8').includes('False positive rate')],
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length > 0) {
  console.error(`evaluation report test failed: ${failed.join(', ')}`);
  process.exit(1);
}

console.log('evaluation report: ok');
