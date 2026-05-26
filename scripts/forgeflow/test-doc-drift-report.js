#!/usr/bin/env node
const {
  renderReport,
  validateDocs,
} = require('./test-doc-links');

const result = validateDocs();
const report = renderReport(result);
const syntheticReport = renderReport({
  schema_version: '1',
  status: 'fail',
  checked_files: 2,
  failures: [
    {
      code: 'release-command-missing',
      source: 'docs/wiki/Release-Gate.md',
      message: 'Release-check command missing from docs: node scripts/forgeflow/test-example.js',
      fix: 'Add node scripts/forgeflow/test-example.js to the release-check command block.',
    },
  ],
});

const checks = [
  ['current docs pass', result.status === 'pass' && result.failures.length === 0],
  ['report renders pass state', report.includes('# Forgeflow Docs Drift Report') && report.includes('Status: pass') && report.includes('No docs drift found.')],
  ['synthetic report renders actionable finding', syntheticReport.includes('Status: fail') && syntheticReport.includes('release-command-missing') && syntheticReport.includes('Release-Gate.md') && syntheticReport.includes('Fix: Add node scripts/forgeflow/test-example.js')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('doc drift report: ok');
