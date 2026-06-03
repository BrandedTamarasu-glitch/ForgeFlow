#!/usr/bin/env node
const { buildFailureDigest, extractFailureRefs } = require('./build-failure-digest');
const { classifyFailureDigest } = require('./failure-digest-triage');

const input = [
  'PASS src/ok.test.ts',
  'FAIL src/bad.test.ts',
  'src/bad.test.ts:12:4 - error TS2322: bad',
  'Expected: true',
  'Received: false',
].join('\n');

const digest = buildFailureDigest(input, { mode: 'test', command: 'vitest' });
const autoPreset = buildFailureDigest(input, { preset: 'auto', command: 'npm test' });
const unsafe = buildFailureDigest('diff --git a/a b/a\n+change\n', { mode: 'test', command: 'git diff' });
const fenced = buildFailureDigest('diff --git a/a b/a\n```\n+boom\n', { mode: 'test', command: 'git diff' });
const stale = classifyFailureDigest(digest, { status: 'attention', issues: [{ code: 'failure-digest-commit-stale' }] });
const missing = classifyFailureDigest({ status: 'missing', present: false }, { status: 'not-applicable', issues: [] });
const firstRun = classifyFailureDigest({ status: 'missing', present: false, first_run: true }, { status: 'not-applicable', issues: [] });
const invalid = classifyFailureDigest({ status: 'invalid', present: true, reason: 'fixture invalid' }, { status: 'current', issues: [] });
const staleRawRequired = classifyFailureDigest({
  status: 'compact',
  present: true,
  raw_required: true,
  reason: 'fixture requires raw output',
  input_lines: 10,
  output_lines: 10,
}, { status: 'attention', issues: [{ code: 'failure-digest-commit-stale' }] });

const checks = [
  ['extracts refs', extractFailureRefs(input).some((item) => item.file === 'src/bad.test.ts' && item.line === 12)],
  ['renders markdown', digest.markdown.includes('# Forgeflow Failure Digest') && digest.markdown.includes('src/bad.test.ts:12:4')],
  ['renders triage metadata', digest.markdown.includes('Triage state: usable') && digest.markdown.includes('Usefulness: usable') && digest.markdown.includes('Confidence: high')],
  ['json includes triage', digest.triage.state === 'usable' && digest.triage.next_action.action === 'none'],
  ['json includes preset metadata', autoPreset.preset === 'test' && autoPreset.preset_reason.includes('test command')],
  ['json status uses artifact contract', digest.status === 'compact' && digest.markdown.includes('Status: compact')],
  ['records git provenance', digest.git && typeof digest.git.available === 'boolean' && digest.markdown.includes('Git available:') && digest.markdown.includes('Git commit:') && digest.markdown.includes('Git dirty:')],
  ['compacts failures', digest.compact.status === 'compacted' && !digest.compact.output.includes('PASS src/ok.test.ts')],
  ['preserves unsafe raw output', unsafe.raw_required === true && unsafe.triage.state === 'raw-required' && unsafe.markdown.includes('Raw required: yes')],
  ['raw-required next action is machine safe', unsafe.triage.next_action.command === '' && unsafe.triage.next_action.action === 'inspect-raw-failure-output' && unsafe.markdown.includes('Next action: inspect-raw-failure-output')],
  ['classifies stale digest', stale.state === 'stale' && stale.next_action.command === 'forgeflow-failure-digest'],
  ['classifies missing digest rerun', missing.state === 'rerun-needed' && missing.usefulness === 'not-usable'],
  ['classifies first-run missing digest', firstRun.state === 'first-run' && firstRun.usefulness === 'not-usable' && firstRun.next_action.command === 'forgeflow-failure-digest' && firstRun.reason.includes('normal before the first captured failure')],
  ['classifies invalid digest', invalid.state === 'invalid' && invalid.next_action.command === 'forgeflow-failure-digest'],
  ['raw-required takes precedence over stale', staleRawRequired.state === 'raw-required' && staleRawRequired.next_action.action === 'inspect-raw-failure-output' && staleRawRequired.next_action.command === ''],
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
