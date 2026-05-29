#!/usr/bin/env node
const { adviseCommand } = require('./advise-noisy-command');

const checks = [
  ['flags unbounded find', adviseCommand('find . -type f').recommendations.some((item) => item.action === 'bound-find-depth')],
  ['passes narrow find', adviseCommand('find src -name "*.ts"').status === 'pass'],
  ['flags recursive ls', adviseCommand('ls -R .').recommendations.some((item) => item.action === 'avoid-recursive-dump')],
  ['passes quiet command', adviseCommand('git status --short').status === 'pass'],
  ['flags exact file lists', adviseCommand('git diff --name-only').recommendations.some((item) => item.action === 'keep-exact-file-list-raw')],
  ['flags porcelain status', adviseCommand('git status --porcelain').recommendations.some((item) => item.action === 'keep-porcelain-status-raw')],
  ['flags broad tests', adviseCommand('pnpm test').recommendations.some((item) => item.action === 'capture-test-output')],
  ['passes narrow vitest', adviseCommand('vitest run src/foo.test.ts').status === 'pass'],
  ['flags typecheck output', adviseCommand('pnpm typecheck').recommendations.some((item) => item.action === 'capture-typecheck-output')],
  ['flags lint output', adviseCommand('pnpm lint').recommendations.some((item) => item.action === 'capture-lint-output')],
  ['flags build output', adviseCommand('npm run build').recommendations.some((item) => item.action === 'capture-build-output')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('noisy command advisor: ok');
