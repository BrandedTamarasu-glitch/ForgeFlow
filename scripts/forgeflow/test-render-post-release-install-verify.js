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

const checks = [
  ['schema version', result.schema_version === '1'],
  ['includes checks', result.checks.some((item) => item.name === 'release-verify') && result.checks.some((item) => item.name === 'downstream-smoke')],
  ['read-only boundary', result.boundary.includes('read-only') && result.boundary.includes('does not update')],
  ['renders markdown', markdown.includes('# Forgeflow Post-Release Install Verify') && markdown.includes('Install root')],
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
