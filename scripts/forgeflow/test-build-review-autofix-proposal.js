#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  EXECUTORS,
  buildReviewAutofixProposal,
  parseArgs,
} = require('./build-review-autofix-proposal');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function throws(fn, pattern) {
  try {
    fn();
  } catch (err) {
    return pattern.test(err.message);
  }
  return false;
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-build-autofix-'));
const projectDir = path.join(root, '.forgeflow', 'Demo');
const findingFile = path.join(root, 'finding.json');
writeJson(findingFile, {
  id: 'docs-1',
  source: 'smith',
  tier: 'NIT',
  title: 'Docs are stale.',
});
const result = buildReviewAutofixProposal({
  root,
  projectDir,
  finding: findingFile,
  executor: 'docs-reference',
  file: 'README.md',
  search: 'old docs',
  replace: 'new docs',
  validationCommand: process.execPath,
  validationArgs: ['validate-pass.js'],
});
const written = JSON.parse(fs.readFileSync(result.out, 'utf8'));
const opts = parseArgs([
  '--executor', 'docs-reference',
  '--finding', findingFile,
  '--file', 'README.md',
  '--search', 'old',
  '--replace', 'new',
  '--validation-command', 'node',
  '--validation-arg', 'test.js',
  '--json',
]);

const checks = [
  ['has expected executors', EXECUTORS['docs-reference'] && EXECUTORS['command-wrapper-parity'] && EXECUTORS['manifest-runtime-helper-parity'] && EXECUTORS['fixture-expectation-update']],
  ['writes proposal', fs.existsSync(result.out)],
  ['uses deterministic class', written.finding.class === 'docs-drift'],
  ['writes exact replace operation', written.operations.length === 1 && written.operations[0].op === 'replace' && written.operations[0].search === 'old docs'],
  ['writes validation command', written.validations[0].command === process.execPath && written.validations[0].args[0] === 'validate-pass.js'],
  ['boundary is non-mutating', written.boundary.includes('does not edit files')],
  ['parses args', opts.executor === 'docs-reference' && opts.validationArgs[0] === 'test.js' && opts.json],
  ['rejects unsupported executor', throws(() => buildReviewAutofixProposal({ root, projectDir, finding: findingFile, executor: 'unknown', file: 'README.md', search: 'a', replace: 'b' }), /Unsupported executor/)],
  ['rejects unsafe path', throws(() => buildReviewAutofixProposal({ root, projectDir, finding: findingFile, executor: 'docs-reference', file: '../README.md', search: 'a', replace: 'b' }), /unsafe proposal path/)],
  ['rejects output outside project dir', throws(() => buildReviewAutofixProposal({ root, projectDir, finding: findingFile, executor: 'docs-reference', file: 'README.md', search: 'a', replace: 'b', out: path.join(root, 'outside.json') }), /inside --project-dir/)],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('review-auto proposal builder: ok');
