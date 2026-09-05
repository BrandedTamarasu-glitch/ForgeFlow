#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/forgeflow.yml'), 'utf8');
const validation = workflow.slice(workflow.indexOf('  validate:'), workflow.indexOf('  review:'));
const review = workflow.slice(workflow.indexOf('  review:'));
// These are trust-boundary contracts, independent of a fork's chosen branch name.
const checkoutRefs = [...workflow.matchAll(/^\s+ref:\s*(.+)$/gm)].map(match => match[1]);
assert.equal(checkoutRefs.length, 2);
assert.equal(checkoutRefs[0], '${{ github.event.pull_request.head.sha || github.sha }}');
assert.equal(checkoutRefs[1], '${{ github.event.pull_request.head.sha }}');
assert.match(workflow, /push:\n    branches: \[main\]/);
assert.match(workflow, /workflow_dispatch:/);
assert.doesNotMatch(workflow, /pull_request_target/);
assert.match(workflow, /^permissions:\n  contents: read/m);
assert.doesNotMatch(validation, /contents: write|secrets\.|needs:|\n\s+if:/);
assert.match(validation, /persist-credentials: false/);
assert.match(validation, /run: npm ci --ignore-scripts/);
assert.match(validation, /run: npm test/);
assert.match(review, /if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository/);
assert.match(review, /if: vars.FORGEFLOW_ENABLE_AUTOFIX == 'true'/);
assert.match(review, /git check-ref-format --branch "\$PR_HEAD_REF"/);
assert.match(review, /git switch -c "\$PR_HEAD_REF"/);
assert.doesNotMatch(review, /git switch -[cC].*\$\{\{/);
console.log('CI workflow trust contracts: ok');
