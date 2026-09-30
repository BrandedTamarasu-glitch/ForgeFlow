#!/usr/bin/env node
const path = require('node:path');
const { spawnSync } = require('node:child_process');

if (process.platform !== 'linux') {
  console.log('Completion runner process/sandbox checks are Linux-only; not run on this host.');
} else {
  const result = spawnSync('python3', [path.join(__dirname, 'test-completion-runner.py')], {
    stdio: 'inherit',
    timeout: 30000,
  });
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status === 0 && !result.error ? 0 : 1;
}
