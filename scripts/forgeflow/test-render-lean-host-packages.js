#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  HOSTS,
  buildLeanHostPackages,
  parseArgs,
  renderMarkdown,
} = require('./render-lean-host-packages');

const root = path.resolve(__dirname, '..', '..');
const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-lean-hosts-')), '.forgeflow', 'Demo');
const preview = buildLeanHostPackages({ root, projectDir, profile: 'strict' });
const written = buildLeanHostPackages({ root, projectDir, profile: 'strict', write: true });
const markdown = renderMarkdown(preview);
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--profile', 'lite', '--write', '--json']);

const checks = [
  ['host package preview passes', preview.status === 'pass' && preview.hosts.length === HOSTS.length],
  ['includes plugin and instruction tiers', preview.hosts.some((host) => host.tier === 'plugin') && preview.hosts.some((host) => host.tier === 'instruction')],
  ['write creates artifacts', fs.existsSync(written.artifacts.json) && fs.existsSync(written.artifacts.markdown)],
  ['renders markdown', markdown.includes('# Forgeflow Lean Host Packages') && markdown.includes('OpenClaw')],
  ['parses args', opts.root === root && opts.projectDir === projectDir && opts.profile === 'lite' && opts.write && opts.json],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('lean host packages: ok');
