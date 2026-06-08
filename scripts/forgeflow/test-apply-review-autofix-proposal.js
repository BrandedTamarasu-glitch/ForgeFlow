#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildReviewAutofixProposal } = require('./build-review-autofix-proposal');
const { runReviewAutofixSandbox } = require('./run-review-autofix-sandbox');
const {
  applyReviewAutofixProposal,
  parseArgs,
  trackedWorktreeDirty,
} = require('./apply-review-autofix-proposal');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function makeRoot({ git = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-apply-autofix-'));
  fs.writeFileSync(path.join(root, 'README.md'), 'hello old docs\n');
  fs.writeFileSync(path.join(root, 'validate-pass.js'), 'process.exit(0);\n');
  fs.writeFileSync(path.join(root, 'validate-fail.js'), 'process.exit(7);\n');
  if (git) {
    spawnSync('git', ['init'], { cwd: root, encoding: 'utf8' });
    spawnSync('git', ['add', 'README.md', 'validate-pass.js', 'validate-fail.js'], { cwd: root, encoding: 'utf8' });
    spawnSync('git', ['-c', 'user.email=test@example.com', '-c', 'user.name=Test', 'commit', '-m', 'init'], { cwd: root, encoding: 'utf8' });
  }
  return root;
}

function proposalArtifact(root, overrides = {}) {
  const projectDir = path.join(root, '.forgeflow', 'Demo');
  const findingFile = path.join(root, 'finding.json');
  writeJson(findingFile, {
    id: overrides.id || 'docs-1',
    source: 'smith',
    tier: 'NIT',
    title: 'Docs are stale.',
  });
  const proposal = buildReviewAutofixProposal({
    root,
    projectDir,
    finding: findingFile,
    executor: 'docs-reference',
    file: 'README.md',
    search: overrides.search || 'old docs',
    replace: overrides.replace || 'new docs',
    validationCommand: process.execPath,
    validationArgs: ['validate-pass.js'],
  });
  const sandbox = runReviewAutofixSandbox({ root, projectDir, proposal: proposal.out });
  return { projectDir, proposal, sandbox };
}

function throws(fn, pattern) {
  try {
    fn();
  } catch (err) {
    return pattern.test(err.message);
  }
  return false;
}

const cleanRoot = makeRoot({ git: true });
const clean = proposalArtifact(cleanRoot);
const applied = applyReviewAutofixProposal({ root: cleanRoot, projectDir: clean.projectDir, proposal: clean.sandbox.artifacts.json });
const cleanContent = fs.readFileSync(path.join(cleanRoot, 'README.md'), 'utf8');
const applyArtifact = JSON.parse(fs.readFileSync(applied.artifacts.json, 'utf8'));

const mismatchRoot = makeRoot();
const mismatch = proposalArtifact(mismatchRoot);
fs.writeFileSync(path.join(mismatchRoot, 'README.md'), 'hello already changed\n');

const rollbackRoot = makeRoot();
const rollback = proposalArtifact(rollbackRoot);
const rollbackArtifact = JSON.parse(fs.readFileSync(rollback.sandbox.artifacts.json, 'utf8'));
rollbackArtifact.validations_requested = [{ command: process.execPath, args: ['validate-fail.js'] }];
const rollbackFile = path.join(rollback.projectDir, 'review-auto', 'proposals', 'forced-fail.json');
writeJson(rollbackFile, rollbackArtifact);
const rollbackResult = applyReviewAutofixProposal({ root: rollbackRoot, projectDir: rollback.projectDir, proposal: rollbackFile });
const rollbackContent = fs.readFileSync(path.join(rollbackRoot, 'README.md'), 'utf8');

const dirtyRoot = makeRoot({ git: true });
const dirty = proposalArtifact(dirtyRoot);
fs.writeFileSync(path.join(dirtyRoot, 'README.md'), 'tracked dirty old docs\n');

const badStatusRoot = makeRoot();
const badStatus = proposalArtifact(badStatusRoot);
const badStatusArtifact = JSON.parse(fs.readFileSync(badStatus.sandbox.artifacts.json, 'utf8'));
badStatusArtifact.status = 'validation-failed';
const badStatusFile = path.join(badStatus.projectDir, 'review-auto', 'proposals', 'bad-status.json');
writeJson(badStatusFile, badStatusArtifact);

const opts = parseArgs(['--proposal', clean.sandbox.artifacts.json, '--root', cleanRoot, '--project-dir', clean.projectDir, '--allow-dirty', '--json']);

const checks = [
  ['applies clean proposal', applied.status === 'applied' && cleanContent === 'hello new docs\n'],
  ['writes apply artifacts', fs.existsSync(applied.artifacts.json) && fs.existsSync(applied.artifacts.md) && fs.existsSync(applied.artifacts.history)],
  ['apply artifact boundary', applyArtifact.boundary.includes('does not commit') && applyArtifact.changed_files[0] === 'README.md'],
  ['tracked worktree dirty after apply', trackedWorktreeDirty(cleanRoot)],
  ['rejects source mismatch', throws(() => applyReviewAutofixProposal({ root: mismatchRoot, projectDir: mismatch.projectDir, proposal: mismatch.sandbox.artifacts.json }), /matched 0 time/)],
  ['rolls back failed validation', rollbackResult.status === 'validation-failed-rolled-back' && rollbackContent === 'hello old docs\n'],
  ['rejects dirty tracked worktree', throws(() => applyReviewAutofixProposal({ root: dirtyRoot, projectDir: dirty.projectDir, proposal: dirty.sandbox.artifacts.json }), /tracked worktree changes/)],
  ['rejects non-proposed artifact', throws(() => applyReviewAutofixProposal({ root: badStatusRoot, projectDir: badStatus.projectDir, proposal: badStatusFile }), /not applyable/)],
  ['parses args', opts.proposal === clean.sandbox.artifacts.json && opts.allowDirty && opts.json],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('review-auto proposal apply: ok');
