#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  changelogCandidates,
  collectReleaseNotes,
  mergeIssueMetadata,
  issueReferencesFromText,
  parseArgs,
  publicSafeText,
  releaseNoteSensitiveLabels,
  releaseCheckCommands,
  renderMarkdown,
} = require('./render-release-notes');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-release-notes-'));
fs.mkdirSync(path.join(tmp, '.claude-plugin'), { recursive: true });
fs.mkdirSync(path.join(tmp, 'docs', 'changelogs'), { recursive: true });
fs.mkdirSync(path.join(tmp, 'commands'), { recursive: true });
fs.writeFileSync(path.join(tmp, '.claude-plugin', 'plugin.json'), JSON.stringify({
  name: 'forgeflow',
  version: '9.8.0',
}, null, 2));
fs.writeFileSync(path.join(tmp, '.claude-plugin', 'marketplace.json'), JSON.stringify({
  plugins: [{ name: 'forgeflow', version: '9.8.0' }],
}, null, 2));
fs.writeFileSync(path.join(tmp, 'docs', 'changelogs', 'v9.8.html'), '<h1>Release: /home/corye/.ssh/config</h1>\n');
fs.writeFileSync(path.join(tmp, 'commands', 'forgeflow-release-check.md'), [
  '```bash',
  'node scripts/forgeflow/test-release-version.js',
  'node scripts/forgeflow/test-doc-links.js',
  'node scripts/forgeflow/test-render-release-notes.js',
  'node scripts/forgeflow/smoke-check.js --mode source --json',
  'git diff --check',
  '```',
].join('\n'));
fs.writeFileSync(path.join(tmp, 'issues.json'), JSON.stringify({
  issues: [
    { number: 42, title: 'Release smoke path', status: 'fixed', evidence: 'Fixed in v9.8.0' },
    { number: 7, title: '/home/corye/private', status: 'surprise', evidence: 'token=SHOULD_NOT_PRINT' },
  ],
}, null, 2));
fs.writeFileSync(path.join(tmp, 'issues-array.json'), JSON.stringify([
  { number: 42, title: 'Wrong shape' },
], null, 2));
spawnSync('git', ['init'], { cwd: tmp, encoding: 'utf8' });
spawnSync('git', ['config', 'user.email', 'forgeflow@example.test'], { cwd: tmp, encoding: 'utf8' });
spawnSync('git', ['config', 'user.name', 'Forgeflow Test'], { cwd: tmp, encoding: 'utf8' });
fs.writeFileSync(path.join(tmp, 'feature.txt'), 'feature\n');
spawnSync('git', ['add', '.'], { cwd: tmp, encoding: 'utf8' });
spawnSync('git', ['commit', '-m', 'Add release_helper [draft] (#42)'], { cwd: tmp, encoding: 'utf8' });
fs.writeFileSync(path.join(tmp, 'space.txt'), 'space\n');
spawnSync('git', ['add', 'space.txt'], { cwd: tmp, encoding: 'utf8' });
spawnSync('git', ['commit', '-m', 'Add   spaced   subject'], { cwd: tmp, encoding: 'utf8' });
fs.writeFileSync(path.join(tmp, 'secret.txt'), 'secret\n');
spawnSync('git', ['add', 'secret.txt'], { cwd: tmp, encoding: 'utf8' });
spawnSync('git', ['commit', '-m', 'token=SHOULD_NOT_PRINT'], { cwd: tmp, encoding: 'utf8' });
fs.writeFileSync(path.join(tmp, 'path.txt'), 'path\n');
spawnSync('git', ['add', 'path.txt'], { cwd: tmp, encoding: 'utf8' });
spawnSync('git', ['commit', '-m', 'Touch /home/corye/.ssh/config'], { cwd: tmp, encoding: 'utf8' });

const notes = collectReleaseNotes({ root: tmp, maxCommits: 5, issues: 'issues.json' });
const markdown = renderMarkdown(notes);
const redacted = publicSafeText('token=SHOULD_NOT_PRINT');
const pathRedacted = publicSafeText('Touch /home/corye/.ssh/config');
const nonRepo = collectReleaseNotes({ root: tmp, maxCommits: 5 });
let missingIssuesArg = false;
try {
  parseArgs(['--root', tmp, '--issues', '--json']);
} catch (err) {
  missingIssuesArg = err.message.includes('Missing value for --issues');
}
let malformedIssues = false;
try {
  collectReleaseNotes({ root: tmp, maxCommits: 5, issues: 'issues-array.json' });
} catch (err) {
  malformedIssues = err.message.includes('object with an issues array');
}
fs.renameSync(path.join(tmp, '.git'), path.join(tmp, 'git.backup'));
const unavailableGit = collectReleaseNotes({ root: tmp, maxCommits: 5 });
fs.renameSync(path.join(tmp, 'git.backup'), path.join(tmp, '.git'));

const checks = [
  ['patch-zero changelog candidate supported', changelogCandidates('9.8.0').includes('docs/changelogs/v9.8.html')],
  ['reads version metadata', notes.version === '9.8.0' && notes.marketplace_version === '9.8.0'],
  ['finds changelog', notes.changelog_path === 'docs/changelogs/v9.8.html' && notes.changelog_title.includes('redacted sensitive content')],
  ['collects commits', notes.commits.length >= 3 && notes.commits.some((commit) => commit.subject.includes('Add release_helper [draft]'))],
  ['extracts issue references', issueReferencesFromText('Fix smoke gate (#42), refs #7 and owner/repo#99').join(',') === '42,7' && notes.referenced_issues.some((issue) => issue.number === 42 && issue.commits.length === 1)],
  ['merges curated issue metadata safely', notes.referenced_issues.some((issue) => issue.number === 42 && issue.title === 'Release smoke path' && issue.status === 'fixed' && issue.evidence === 'Fixed in v9.8.0') && notes.referenced_issues.some((issue) => issue.number === 7 && issue.title.includes('redacted sensitive content') && issue.status === 'unknown') && mergeIssueMetadata([], [{ number: 2, reference: '#2', title: 'Two', status: 'open', evidence: '' }])[0].number === 2],
  ['whitespace normalization is not redaction', notes.commits.some((commit) => commit.subject === 'Add spaced subject' && commit.redacted === false)],
  ['redacts sensitive commits', redacted.includes('redacted sensitive content') && notes.commits.some((commit) => commit.redacted) && !JSON.stringify(notes).includes('SHOULD_NOT_PRINT')],
  ['redacts local paths', releaseNoteSensitiveLabels('/home/corye/.ssh/config').includes('local-path') && releaseNoteSensitiveLabels('path=/home/corye/.ssh/config').includes('local-path') && releaseNoteSensitiveLabels('out=../tmp/file').includes('local-path') && releaseNoteSensitiveLabels('path=C:\\Temp\\file.txt').includes('local-path') && pathRedacted.includes('redacted sensitive content') && notes.commits.some((commit) => commit.redacted) && !JSON.stringify(notes).includes('/home/corye/.ssh/config')],
  ['git unavailable is explicit', nonRepo.git.available === true && unavailableGit.git.available === false && unavailableGit.git.dirty === null && renderMarkdown(unavailableGit).includes('Git: unavailable')],
  ['captures validation commands', notes.validation_commands.length === 5 && notes.validation_commands.includes('git diff --check')],
  ['parses fenced release commands', releaseCheckCommands('```bash\nnode a.js\ngit diff --check\n```').length === 2],
  ['requires issue metadata path value', missingIssuesArg],
  ['rejects malformed issue metadata schema', malformedIssues],
  ['renders markdown draft', markdown.includes('# Forgeflow 9.8.0 Release Notes Draft') && markdown.includes('## Issue Context') && markdown.includes('#42: Release smoke path; status fixed; referenced by') && markdown.includes('Verify issue state and source before claiming closure') && markdown.includes('## Validation Evidence To Capture')],
  ['escapes markdown draft text', markdown.includes('Add release\\_helper \\[draft\\]')],
  ['markdown stays public safe', !markdown.includes('SHOULD_NOT_PRINT')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('release notes draft: ok');
