#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildReleaseVerify, githubVerification, parseArgs, renderMarkdown } = require('./render-release-verify');

const passRunner = () => ({ status: 0, stdout: '', stderr: '' });
const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-release-verify-install-'));
fs.writeFileSync(path.join(installRoot, 'forgeflow-version'), '0000000\n');
const version = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '.claude-plugin', 'plugin.json'), 'utf8')).version;
const tag = `v${version}`;
const result = buildReleaseVerify({ root: process.cwd(), runner: passRunner, installRoot });
const github = githubVerification(process.cwd(), version, (bin) => (bin === 'gh'
  ? { status: 0, stdout: JSON.stringify({ tagName: tag, name: `Forgeflow ${version}`, isPrerelease: false, url: 'https://example.invalid/release' }), stderr: '' }
  : { status: 0, stdout: `abc123\trefs/tags/${tag}\n`, stderr: '' }));
const withGithub = buildReleaseVerify({
  root: process.cwd(),
  runner: passRunner,
  installRoot,
  github: true,
  githubRunner: (bin) => (bin === 'gh'
    ? { status: 0, stdout: JSON.stringify({ tagName: tag, name: `Forgeflow ${version}`, isPrerelease: false, url: 'https://example.invalid/release' }), stderr: '' }
    : { status: 0, stdout: `abc123\trefs/tags/${tag}\n`, stderr: '' }),
});
const networkBlocked = githubVerification(process.cwd(), '4.3.24', (bin) => (bin === 'gh'
  ? { status: 1, error: new Error('spawnSync gh EPERM'), stdout: '', stderr: 'error connecting to api.github.com\ncheck your internet connection\n' }
  : { status: 128, error: new Error('spawnSync git EPERM'), stdout: '', stderr: "fatal: unable to access 'https://github.com/example/repo/': Could not resolve host: github.com\n" }));
const markdown = renderMarkdown(result);
const githubMarkdown = renderMarkdown(withGithub);
const opts = parseArgs(['--root', '.', '--save', '--compare-last', '--github', '--json']);

const checks = [
  ['builds release verify result', result.schema_version === '1' && result.summary && Array.isArray(result.evidence)],
  ['renders shareable summary', markdown.includes('# Forgeflow Release Verify') && markdown.includes('## Shareable Summary') && markdown.includes('local and advisory')],
  ['install consumability included', result.status === 'install-attention' && result.local_consumability.status === 'attention' && result.local_consumability.runtime_drift.repair_preview && markdown.includes('## Install Consumability')],
  ['parses flags', opts.save === true && opts.compareLast === true && opts.github === true && opts.json === true],
  ['does not claim mutation', /does not (tag|create tags)/.test(result.boundary) && result.boundary.includes('call GitHub')],
  ['github verification optional', github.status === 'pass' && withGithub.github_verification.status === 'pass' && githubMarkdown.includes('## GitHub Verification')],
  ['github verification distinguishes network unavailable', networkBlocked.status === 'warn' && networkBlocked.evidence.every((item) => item.status === 'attention' && item.reason === 'network-unavailable' && item.clears.includes('does not prove'))],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('release verify: ok');
