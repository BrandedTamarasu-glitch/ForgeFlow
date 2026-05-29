#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildPostReleaseInstallVerify, parseArgs, renderMarkdown } = require('./render-post-release-install-verify');

const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-post-release-install-'));
fs.writeFileSync(path.join(installRoot, 'forgeflow-version'), '0000000\n');
const result = buildPostReleaseInstallVerify({
  root: path.resolve(__dirname, '..', '..'),
  installRoot,
  runner: () => ({ status: 0, stdout: '', stderr: '' }),
});
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', '.', '--install-root', installRoot, '--json']);
const infoResult = buildPostReleaseInstallVerify({
  root: path.resolve(__dirname, '..', '..'),
  installRoot,
  release: {
    status: 'install-attention',
    next_command: 'forgeflow-release-readiness --post-publish',
    local_consumability: { status: 'info' },
    version: '4.3.99',
    tag: 'v4.3.99',
    head: 'abc123',
  },
  smoke: { status: 'pass', checks: [] },
});

const checks = [
  ['schema version', result.schema_version === '1'],
  ['includes checks', result.checks.some((item) => item.name === 'release-verify') && result.checks.some((item) => item.name === 'downstream-smoke')],
  ['read-only boundary', result.boundary.includes('read-only') && result.boundary.includes('does not update')],
  ['info install status is not repair attention', infoResult.status === 'info' && infoResult.checks.some((item) => item.name === 'install-consumability' && item.status === 'info' && item.next.includes('forgeflow-version')) && infoResult.next.includes('forgeflow-version') && infoResult.next_reason],
  ['renders markdown', markdown.includes('# Forgeflow Post-Release Install Verify') && markdown.includes('Install root') && markdown.includes('Why:')],
  ['parses args', opts.installRoot === installRoot && opts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('post-release install verify: ok');
