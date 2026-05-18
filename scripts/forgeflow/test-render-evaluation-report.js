#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  buildEvaluation,
  readOutcomes,
  renderMarkdown,
} = require('./render-evaluation-report');

const repoRoot = path.resolve(__dirname, '..', '..');
const fixture = path.join(repoRoot, 'fixtures/evaluation/sample-outcomes.jsonl');
const comparisonFixture = path.join(repoRoot, 'fixtures/evaluation/comparison-outcomes.jsonl');
const { records, rejected } = readOutcomes(fixture);
const report = buildEvaluation(records, rejected);
const markdown = renderMarkdown(report);
const comparisonInput = readOutcomes(comparisonFixture);
const comparison = buildEvaluation(comparisonInput.records, comparisonInput.rejected);

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-eval-report-'));
const outFile = path.join(tmpDir, 'evaluation.md');
const script = path.join(repoRoot, 'scripts/forgeflow/render-evaluation-report.js');
const result = spawnSync(process.execPath, [script, '--outcomes', fixture, '--out', outFile], {
  encoding: 'utf8',
});

const checks = [
  ['records', report.records === 1],
  ['confirmed count', report.totals.findings_confirmed === 2],
  ['rejected count', report.totals.findings_rejected === 1],
  ['confirmation rate', report.rates.confirmation_rate_pct === 66.7],
  ['false positive rate', report.rates.false_positive_rate_pct === 33.3],
  ['average minutes', report.rates.average_review_minutes === 18.5],
  ['default workflow', report.workflows.forgeflow.records === 1],
  ['comparison no-agent', comparison.workflows['no-agent'].average_review_minutes === 31],
  ['comparison single-agent', comparison.workflows['single-agent'].false_positive_rate_pct === 50],
  ['comparison forgeflow', comparison.workflows.forgeflow.confirmation_rate_pct === 66.7],
  ['markdown title', markdown.includes('# Forgeflow Evaluation Report')],
  ['markdown workflow table', markdown.includes('## Workflow Comparison')],
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
