#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildReviewAutoEvidence, parseArgs, renderMarkdown } = require('./render-review-auto-evidence');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-review-auto-evidence-'));
const projectDir = path.join(root, '.forgeflow', path.basename(root));
fs.mkdirSync(projectDir, { recursive: true });
const findings = path.join(root, 'findings.json');
fs.writeFileSync(findings, JSON.stringify([
  { id: 'safe-1', source: 'smith', tier: 'NIT', title: 'Unused import.', file: 'src/demo.ts' },
  { id: 'risk-1', source: 'warden', tier: 'MUST-FIX-SAFE', title: 'Auth adjacent.', file: 'src/auth.ts' },
], null, 2));
const out = path.join(projectDir, 'evidence.md');
const result = buildReviewAutoEvidence({ projectDir, findings, out });
const defaultResult = buildReviewAutoEvidence({ projectDir, findings });
let outsideBlocked = false;
try {
  buildReviewAutoEvidence({ projectDir, findings, out: path.join(root, 'outside.md') });
} catch (_err) {
  outsideBlocked = true;
}
const markdown = renderMarkdown(result);
const opts = parseArgs(['--project-dir', projectDir, '--findings', findings, '--out', out, '--json']);

const checks = [
  ['counts buckets', result.counts.safe === 1 && result.counts.risky === 1],
  ['writes evidence', fs.existsSync(out) && fs.readFileSync(out, 'utf8').includes('# Forgeflow Review-Auto Evidence')],
  ['default evidence stays in project dir', defaultResult.out === path.join(projectDir, 'review-auto-evidence.md') && fs.existsSync(defaultResult.out)],
  ['blocks out outside project dir', outsideBlocked],
  ['renders next reason', markdown.includes('Next:') && markdown.includes('Why:')],
  ['parses args', opts.projectDir === projectDir && opts.findings === findings && opts.out === out && opts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('review-auto evidence: ok');
