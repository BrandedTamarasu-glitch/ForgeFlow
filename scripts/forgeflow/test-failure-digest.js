#!/usr/bin/env node
const { buildFailureDigest, extractFailureRefs } = require('./build-failure-digest');

const input = [
  'PASS src/ok.test.ts',
  'FAIL src/bad.test.ts',
  'src/bad.test.ts:12:4 - error TS2322: bad',
  'Expected: true',
  'Received: false',
].join('\n');

const digest = buildFailureDigest(input, { mode: 'test', command: 'vitest' });
const unsafe = buildFailureDigest('diff --git a/a b/a\n+change\n', { mode: 'test', command: 'git diff' });
const fenced = buildFailureDigest('diff --git a/a b/a\n```\n+boom\n', { mode: 'test', command: 'git diff' });

const checks = [
  ['extracts refs', extractFailureRefs(input).some((item) => item.file === 'src/bad.test.ts' && item.line === 12)],
  ['renders markdown', digest.markdown.includes('# Forgeflow Failure Digest') && digest.markdown.includes('src/bad.test.ts:12:4')],
  ['compacts failures', digest.compact.status === 'compacted' && !digest.compact.output.includes('PASS src/ok.test.ts')],
  ['preserves unsafe raw output', unsafe.raw_required === true && unsafe.markdown.includes('Raw required: yes')],
  ['uses longer markdown fence', fenced.markdown.includes('````text') && fenced.markdown.includes('\n```\n')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('failure digest: ok');
