#!/usr/bin/env node
const { buildReleaseVerify, parseArgs, renderMarkdown } = require('./render-release-verify');

const passRunner = () => ({ status: 0, stdout: '', stderr: '' });
const result = buildReleaseVerify({ root: process.cwd(), runner: passRunner });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', '.', '--save', '--compare-last', '--json']);

const checks = [
  ['builds release verify result', result.schema_version === '1' && result.summary && Array.isArray(result.evidence)],
  ['renders shareable summary', markdown.includes('# Forgeflow Release Verify') && markdown.includes('## Shareable Summary') && markdown.includes('local and advisory')],
  ['parses flags', opts.save === true && opts.compareLast === true && opts.json === true],
  ['does not claim mutation', /does not (tag|create tags)/.test(result.boundary) && result.boundary.includes('call GitHub')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('release verify: ok');
