#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  parseArgs,
  renderMarkdown,
  runReviewAutofixSandbox,
} = require('./run-review-autofix-sandbox');

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-autofix-root-'));
  fs.writeFileSync(path.join(root, 'README.md'), 'hello old docs\n');
  fs.writeFileSync(path.join(root, 'validate-pass.js'), 'process.exit(0);\n');
  fs.writeFileSync(path.join(root, 'validate-fail.js'), 'process.exit(7);\n');
  return root;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function proposal(overrides = {}) {
  return {
    id: 'docs-1',
    finding: {
      id: 'docs-1',
      source: 'smith',
      tier: 'NIT',
      class: 'docs-drift',
      title: 'Docs are stale.',
      file: 'README.md',
    },
    operations: [
      { op: 'replace', file: 'README.md', search: 'old docs', replace: 'new docs' },
    ],
    validations: [
      { command: process.execPath, args: ['validate-pass.js'] },
    ],
    ...overrides,
  };
}

function throws(fn, pattern) {
  try {
    fn();
  } catch (err) {
    return pattern.test(err.message);
  }
  return false;
}

const root = makeRoot();
const projectDir = path.join(root, '.forgeflow', 'Demo');
const proposalFile = path.join(root, 'proposal.json');
writeJson(proposalFile, proposal());
const result = runReviewAutofixSandbox({ root, projectDir, proposal: proposalFile });
const artifact = JSON.parse(fs.readFileSync(result.artifacts.json, 'utf8'));
const markdown = renderMarkdown(result);
const sourceAfter = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const sandboxAfter = fs.readFileSync(path.join(result.sandbox, 'README.md'), 'utf8');

const failRoot = makeRoot();
const failProjectDir = path.join(failRoot, '.forgeflow', 'Demo');
const failProposalFile = path.join(failRoot, 'proposal.json');
writeJson(failProposalFile, proposal({
  id: 'docs-fail',
  validations: [{ command: process.execPath, args: ['validate-fail.js'] }],
}));
const failResult = runReviewAutofixSandbox({ root: failRoot, projectDir: failProjectDir, proposal: failProposalFile });

const traversalRoot = makeRoot();
const traversalProposalFile = path.join(traversalRoot, 'proposal.json');
writeJson(traversalProposalFile, proposal({
  operations: [{ op: 'replace', file: '../README.md', search: 'old', replace: 'new' }],
}));

const absoluteRoot = makeRoot();
const absoluteProposalFile = path.join(absoluteRoot, 'proposal.json');
writeJson(absoluteProposalFile, proposal({
  operations: [{ op: 'replace', file: path.join(absoluteRoot, 'README.md'), search: 'old', replace: 'new' }],
}));

const symlinkRoot = makeRoot();
const outside = path.join(os.tmpdir(), `forgeflow-autofix-outside-${process.pid}.md`);
fs.writeFileSync(outside, 'outside old docs\n');
fs.unlinkSync(path.join(symlinkRoot, 'README.md'));
fs.symlinkSync(outside, path.join(symlinkRoot, 'README.md'));
const symlinkProposalFile = path.join(symlinkRoot, 'proposal.json');
writeJson(symlinkProposalFile, proposal());

const blockerRoot = makeRoot();
const blockerProposalFile = path.join(blockerRoot, 'proposal.json');
writeJson(blockerProposalFile, proposal({
  finding: {
    id: 'auth-1',
    source: 'warden',
    tier: 'MUST-FIX',
    class: 'auth',
    title: 'Auth needs judgment.',
    file: 'README.md',
  },
}));

const unsafeOutRoot = makeRoot();
const unsafeProjectDir = path.join(unsafeOutRoot, '.forgeflow', 'Demo');
const unsafeProposalFile = path.join(unsafeOutRoot, 'proposal.json');
writeJson(unsafeProposalFile, proposal({ id: 'unsafe-out' }));
const outsideOut = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-autofix-out-'));
fs.mkdirSync(path.join(unsafeProjectDir, 'review-auto'), { recursive: true });
fs.symlinkSync(outsideOut, path.join(unsafeProjectDir, 'review-auto', 'proposals'));

const opts = parseArgs(['--proposal', proposalFile, '--root', root, '--project-dir', projectDir, '--json']);

const checks = [
  ['successful proposal status', result.status === 'proposed'],
  ['source checkout unchanged', sourceAfter === 'hello old docs\n'],
  ['sandbox changed', sandboxAfter === 'hello new docs\n'],
  ['artifacts written', fs.existsSync(result.artifacts.json) && fs.existsSync(result.artifacts.md) && fs.existsSync(result.artifacts.diff)],
  ['artifact shape preserved', artifact.schema_version === '1' && artifact.finding.policy.sandbox_required === true && artifact.changed_files[0] === 'README.md'],
  ['diff captures proposal', fs.readFileSync(result.artifacts.diff, 'utf8').includes('hello new docs')],
  ['markdown boundary', markdown.includes('does not mutate the source checkout') && markdown.includes('Status: proposed')],
  ['validation failure status', failResult.status === 'validation-failed' && failResult.validation[0].exit_code === 7 && fs.existsSync(failResult.artifacts.json)],
  ['rejects traversal', throws(() => runReviewAutofixSandbox({ root: traversalRoot, projectDir: path.join(traversalRoot, '.forgeflow', 'Demo'), proposal: traversalProposalFile }), /unsafe proposal path/)],
  ['rejects absolute path', throws(() => runReviewAutofixSandbox({ root: absoluteRoot, projectDir: path.join(absoluteRoot, '.forgeflow', 'Demo'), proposal: absoluteProposalFile }), /absolute proposal path/)],
  ['rejects source symlink', throws(() => runReviewAutofixSandbox({ root: symlinkRoot, projectDir: path.join(symlinkRoot, '.forgeflow', 'Demo'), proposal: symlinkProposalFile }), /symlink/)],
  ['rejects unsafe finding', throws(() => runReviewAutofixSandbox({ root: blockerRoot, projectDir: path.join(blockerRoot, '.forgeflow', 'Demo'), proposal: blockerProposalFile }), /not eligible/)],
  ['rejects symlinked proposal output', throws(() => runReviewAutofixSandbox({ root: unsafeOutRoot, projectDir: unsafeProjectDir, proposal: unsafeProposalFile }), /symlinked directory/)],
  ['does not write through symlinked proposal output', fs.readdirSync(outsideOut).length === 0],
  ['parses args', opts.proposal === proposalFile && opts.root === root && opts.projectDir === projectDir && opts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('review-auto sandbox: ok');
