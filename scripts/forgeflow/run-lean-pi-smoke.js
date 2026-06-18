#!/usr/bin/env node
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const env = { ...process.env };
delete env.NODE_OPTIONS;
delete env.NODE_PATH;

const result = spawnSync(process.execPath, ['--test', path.join(root, 'pi-extension', 'test', 'extension.test.js')], {
  cwd: root,
  encoding: 'utf8',
  env,
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.status !== 0) process.exit(result.status || 1);
console.log('lean pi smoke: ok');
