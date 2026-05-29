#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildReviewEvidenceSchemaCheck, checkReviewEvidenceSchema, parseArgs, renderMarkdown } = require('./check-review-evidence-schema');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-review-evidence-schema-'));
const findings = path.join(root, 'findings.json');
fs.writeFileSync(findings, JSON.stringify({
  findings: [
    { id: 'ok-1', source: 'smith', tier: 'NIT', title: 'Unused import', file: 'src/demo.ts' },
    { id: 'bad-1', reviewer: 'warden', severity: 'MUST', message: 'Secret leak', path: '/tmp/private.ts', token: 'abc' },
  ],
}, null, 2));
const result = buildReviewEvidenceSchemaCheck({ findings });
const direct = checkReviewEvidenceSchema([{ title: 'Missing fields' }]);
const markdown = renderMarkdown(result);
const opts = parseArgs(['--findings', findings, '--json']);

const checks = [
  ['reports attention for unsafe shape', result.status === 'attention' && result.issue_count >= 2],
  ['accepts object findings array', result.findings === 2],
  ['direct check works', direct.status === 'attention' && direct.items[0].issues.includes('missing-file')],
  ['renders markdown', markdown.includes('# Forgeflow Review Evidence Schema') && markdown.includes('absolute-file-path')],
  ['parses args', opts.findings === findings && opts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('review evidence schema: ok');
