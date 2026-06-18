#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  HOST_PROBES,
  buildLeanHostCliProbes,
  findOnPath,
  parseArgs,
  renderMarkdown,
} = require('./render-lean-host-cli-probes');

const root = path.resolve(__dirname, '..', '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-host-cli-probes-'));
const fakeClaude = path.join(tmp, 'claude');
fs.writeFileSync(fakeClaude, '#!/bin/sh\nexit 0\n');
fs.chmodSync(fakeClaude, 0o755);

const result = buildLeanHostCliProbes({ root, path: tmp });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--path', tmp, '--json']);

const checks = [
  ['lists expected probes', result.probes.length === HOST_PROBES.length],
  ['detects executable on supplied path', result.probes.some((probe) => probe.binary === 'claude' && probe.status === 'present')],
  ['reports missing executables without running them', result.status === 'partial' && result.summary.missing > 0],
  ['findOnPath returns basename-safe executable path', path.basename(findOnPath('claude', tmp)) === 'claude'],
  ['renders manual probes', markdown.includes('# Forgeflow Lean Host CLI Probes') && markdown.includes('Manual probe')],
  ['parses args', opts.root === root && opts.path === tmp && opts.json],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
if (failed > 0) process.exit(1);
console.log('lean host CLI probes: ok');
