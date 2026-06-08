#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  parseArgs,
  renderMarkdown,
  showReviewAutofixStatus,
} = require('./show-review-autofix-status');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-review-status-'));
  return {
    root,
    projectDir: path.join(root, '.forgeflow', 'Demo'),
  };
}

function artifact(projectDir, rel, value) {
  const file = path.join(projectDir, rel);
  writeJson(file, value);
  return file;
}

function throws(fn, pattern) {
  try {
    fn();
  } catch (err) {
    return pattern.test(err.message);
  }
  return false;
}

const empty = makeRoot();
const emptyStatus = showReviewAutofixStatus(empty);

const inputOnly = makeRoot();
const inputFile = artifact(inputOnly.projectDir, 'review-auto/proposal-inputs/docs-1.json', {
  schema_version: '1',
  generated_at: '2026-06-08T19:00:00Z',
  id: 'docs-1',
});
const inputStatus = showReviewAutofixStatus(inputOnly);

const proposed = makeRoot();
artifact(proposed.projectDir, 'review-auto/proposals/docs-1/proposal.json', {
  schema_version: '1',
  generated_at: '2026-06-08T19:01:00Z',
  status: 'proposed',
  finding: { id: 'docs-1' },
});
const proposedStatus = showReviewAutofixStatus(proposed);

const applied = makeRoot();
artifact(applied.projectDir, 'review-auto/proposals/docs-1/proposal.json', {
  schema_version: '1',
  generated_at: '2026-06-08T19:01:00Z',
  status: 'proposed',
  finding: { id: 'docs-1' },
});
artifact(applied.projectDir, 'review-auto/applied/docs-1/apply.json', {
  schema_version: '1',
  generated_at: '2026-06-08T19:02:00Z',
  status: 'applied',
});
fs.appendFileSync(path.join(applied.projectDir, 'review-auto', 'apply-history.jsonl'), `${JSON.stringify({
  ts: '2026-06-08T19:02:00Z',
  status: 'applied',
  proposal_file: 'proposal.json',
  changed_files: ['README.md'],
})}\n`);
const appliedStatus = showReviewAutofixStatus(applied);

const rolledBack = makeRoot();
artifact(rolledBack.projectDir, 'review-auto/applied/docs-1/apply.json', {
  schema_version: '1',
  generated_at: '2026-06-08T19:03:00Z',
  status: 'validation-failed-rolled-back',
});
const rolledBackStatus = showReviewAutofixStatus(rolledBack);
const helperSource = fs.readFileSync(path.join(__dirname, 'show-review-autofix-status.js'), 'utf8');

const invalid = makeRoot();
fs.mkdirSync(path.join(invalid.projectDir, 'review-auto', 'proposal-inputs'), { recursive: true });
fs.writeFileSync(path.join(invalid.projectDir, 'review-auto', 'proposal-inputs', 'broken.json'), '{nope');
const invalidStatus = showReviewAutofixStatus(invalid);

const symlink = makeRoot();
fs.mkdirSync(path.join(symlink.projectDir, 'review-auto', 'proposal-inputs'), { recursive: true });
fs.writeFileSync(path.join(symlink.root, 'outside.json'), '{}\n');
fs.symlinkSync(path.join(symlink.root, 'outside.json'), path.join(symlink.projectDir, 'review-auto', 'proposal-inputs', 'outside.json'));
const symlinkStatus = showReviewAutofixStatus(symlink);

const symlinkProject = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-review-status-symlink-project-'));
const realProject = path.join(symlinkProject, 'real');
fs.mkdirSync(realProject, { recursive: true });
const linkedProject = path.join(symlinkProject, 'linked');
fs.symlinkSync(realProject, linkedProject);

const opts = parseArgs(['--root', empty.root, '--project-dir', empty.projectDir, '--json']);
const markdown = renderMarkdown(proposedStatus);

const checks = [
  ['empty state suggests evidence capture', emptyStatus.status === 'empty' && emptyStatus.next.includes('/forgeflow-review-auto-evidence')],
  ['proposal input suggests sandbox command', inputStatus.status === 'ready' && inputStatus.next.includes('/forgeflow-review-autofix-sandbox') && inputStatus.next.includes(inputFile)],
  ['proposed sandbox suggests apply command', proposedStatus.status === 'ready' && proposedStatus.next.includes('/forgeflow-review-autofix-apply')],
  ['applied state suggests review', appliedStatus.status === 'ready' && appliedStatus.next === '/review' && appliedStatus.counts.apply_history_entries === 1],
  ['rollback state requires attention', rolledBackStatus.status === 'attention' && rolledBackStatus.next.includes('Inspect')],
  ['attention status is informational', !helperSource.includes("result.status === 'attention'") && !helperSource.includes('result.status === "attention"')],
  ['invalid artifact counted', invalidStatus.status === 'attention' && invalidStatus.counts.invalid_artifacts === 1],
  ['symlink artifact skipped', symlinkStatus.status === 'attention' && symlinkStatus.invalid_artifacts.some((item) => item.reason === 'symlink-skipped')],
  ['symlink project directory refused', throws(() => showReviewAutofixStatus({ root: symlinkProject, projectDir: linkedProject }), /symlinked project directory/)],
  ['parses args', opts.root === empty.root && opts.projectDir === empty.projectDir && opts.json],
  ['markdown renders boundary and next', markdown.includes('Review-auto status is read-only') && markdown.includes('/forgeflow-review-autofix-apply')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('review-auto status: ok');
