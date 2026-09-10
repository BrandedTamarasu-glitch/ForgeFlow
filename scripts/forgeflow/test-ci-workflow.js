#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const workflowsDir = path.join(root, '.github/workflows');
const workflows = fs.existsSync(workflowsDir)
  ? fs.readdirSync(workflowsDir).filter(file => /\.ya?ml$/i.test(file))
  : [];
// Repository policy: GitHub hosts release pushes and artifacts, never jobs.
// This checks source configuration; the remote Actions setting is verified separately.
assert.deepEqual(workflows, [], 'Run validation locally; do not add GitHub Actions workflows.');
console.log('Local validation policy: no GitHub Actions workflows');
