#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  HOST_PROBES,
  buildLeanHostCliProbes,
  evidenceState,
  findOnPath,
  parseArgs,
  renderMarkdown,
} = require('./render-lean-host-cli-probes');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-host-cli-probes-'));
const root = tmp;
const fakeClaude = path.join(tmp, 'claude');
fs.writeFileSync(fakeClaude, '#!/bin/sh\nexit 0\n');
fs.chmodSync(fakeClaude, 0o755);
const evidenceFile = path.join(tmp, 'evidence.json');
fs.writeFileSync(evidenceFile, JSON.stringify({ probes: [{ binary: 'claude', status: 'verified', checked_at: '2026-06-18T00:00:00Z', note: 'manual probe passed', output_digest: 'sha256:fixture' }] }, null, 2));

const result = buildLeanHostCliProbes({ root, path: tmp });
const evidenced = buildLeanHostCliProbes({ root, path: tmp, evidence: evidenceFile });
const templateOut = path.join(tmp, 'host-probe-template.json');
const templated = buildLeanHostCliProbes({ root, path: tmp, writeTemplate: true, out: templateOut });
const template = JSON.parse(fs.readFileSync(templateOut, 'utf8'));
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--path', tmp, '--evidence', evidenceFile, '--write-template', '--out', templateOut, '--json']);

const checks = [
  ['lists expected probes', result.probes.length === HOST_PROBES.length],
  ['detects executable on supplied path', result.probes.some((probe) => probe.binary === 'claude' && probe.status === 'present')],
  ['uses manual evidence when supplied', evidenced.probes.some((probe) => probe.binary === 'claude' && probe.status === 'verified' && probe.evidence.note === 'manual probe passed' && probe.evidence_state === 'strong')],
  ['writes evidence template', fs.existsSync(templateOut) && templated.artifacts.evidence_template === templateOut && template.probes.length === HOST_PROBES.length && template.probes[0].output_digest === '' && templated.next.includes('--evidence')],
  ['reports evidence requirements', evidenced.evidence_requirements.length >= 4 && evidenced.summary.strong_evidence === 1 && evidenceState({ status: 'verified' }) === 'thin'],
  ['reports missing executables without running them', result.status === 'partial' && result.summary.missing > 0],
  ['findOnPath returns basename-safe executable path', path.basename(findOnPath('claude', tmp)) === 'claude'],
  ['renders manual probes', markdown.includes('# Forgeflow Lean Host CLI Probes') && markdown.includes('Manual probe')],
  ['parses args', opts.root === root && opts.path === tmp && opts.evidence === evidenceFile && opts.writeTemplate && opts.out === templateOut && opts.json],
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
