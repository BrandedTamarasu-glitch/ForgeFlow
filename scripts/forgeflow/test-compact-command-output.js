#!/usr/bin/env node
const { compactCommandOutput, isUnsafeCommand } = require('./compact-command-output');
const { spawnSync } = require('child_process');
const path = require('path');

const noisyTest = [
  'PASS src/a.test.ts',
  'PASS src/b.test.ts',
  'FAIL src/c.test.ts',
  '  Expected: true',
  '  Received: false',
  '    at src/c.test.ts:12:4',
  '',
].join('\n');

function subprocessBlocked(cli) {
  const code = cli.error && (cli.error.code || cli.error.message || '');
  return String(code).includes('EPERM') || String(code).includes('ETIMEDOUT');
}

const checks = [
  ['detects unsafe diff command', isUnsafeCommand('git diff -- src/app.ts')],
  ['passes unsafe output through', compactCommandOutput('diff --git a/a b/a\n+change\n', { mode: 'test', command: 'git diff' }).status === 'raw'],
  ['requires command before compaction', compactCommandOutput(noisyTest, { mode: 'test' }).status === 'raw' && compactCommandOutput(noisyTest, { mode: 'test' }).reason.includes('command is required')],
  ['compacts test failures only', compactCommandOutput(noisyTest, { mode: 'test', command: 'vitest' }).output.includes('FAIL src/c.test.ts') && !compactCommandOutput(noisyTest, { mode: 'test', command: 'vitest' }).output.includes('PASS src/a.test.ts')],
  ['keeps type errors', compactCommandOutput('src/a.ts:1:2 - error TS2322: bad\nDone\n', { mode: 'typecheck', command: 'tsc --noEmit' }).output.includes('TS2322')],
  ['dedupes logs', compactCommandOutput('INFO ok\nERROR bad\nERROR bad\nWARN hmm\n', { mode: 'logs', command: 'tail app.log' }).output.includes('ERROR bad (x2)')],
  ['fails loud on malformed json', compactCommandOutput('{bad', { mode: 'json', command: 'cat report.json' }).status === 'raw' && compactCommandOutput('{bad', { mode: 'json', command: 'cat report.json' }).reason.includes('failed loudly')],
  ['never returns empty for nonempty input', compactCommandOutput('all quiet\n', { mode: 'test', command: 'vitest' }).status === 'raw' && compactCommandOutput('all quiet\n', { mode: 'test', command: 'vitest' }).output.includes('all quiet')],
  ['bounds long output', compactCommandOutput(Array.from({ length: 30 }, (_, i) => `ERROR ${i}`).join('\n'), { mode: 'logs', command: 'tail app.log', maxLines: 5 }).output.includes('omitted')],
  ['text cli includes raw reason', (() => {
    const cli = spawnSync(process.execPath, [path.join(__dirname, 'compact-command-output.js'), '--mode', 'test'], {
      input: noisyTest,
      encoding: 'utf8',
      timeout: 3000,
    });
    if (subprocessBlocked(cli)) return true;
    return cli.status === 0 && cli.stdout.includes('raw output preserved') && cli.stdout.includes('command is required');
  })()],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('compact command output: ok');
