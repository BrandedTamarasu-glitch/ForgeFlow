#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const path = require('node:path');
if (process.platform !== 'linux') {
  console.log('Completion comparison process checks require Linux; not run.');
} else {
  const result = spawnSync('python3', [path.join(__dirname, 'test-completion-comparison.py')], { stdio: 'inherit', timeout: 30000 });
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status === 0 && !result.error ? 0 : 1;
}
