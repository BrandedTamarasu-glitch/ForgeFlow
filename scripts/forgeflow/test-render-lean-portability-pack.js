#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  TARGETS,
  buildLeanPortabilityPack,
  parseArgs,
  renderMarkdown,
} = require('./render-lean-portability-pack');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-lean-portability-'));
const projectDir = path.join(root, '.forgeflow', 'Demo');
fs.mkdirSync(path.join(projectDir, 'context'), { recursive: true });
fs.writeFileSync(path.join(projectDir, 'context', 'lean-policy.json'), JSON.stringify({ profile: 'strict', enabled: true }, null, 2));

const missing = buildLeanPortabilityPack({ root, projectDir });
const written = buildLeanPortabilityPack({ root, projectDir, write: true });
const current = buildLeanPortabilityPack({ root, projectDir });
fs.appendFileSync(written.targets[0].path, '\nDRIFT\n');
const drift = buildLeanPortabilityPack({ root, projectDir });
const markdown = renderMarkdown(written);
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--profile', 'lite', '--write', '--json']);

const checks = [
  ['target list stable', TARGETS.length >= 11 && TARGETS.some((target) => target.name === 'generic-skill') && TARGETS.some((target) => target.name === 'openclaw')],
  ['missing status before write', missing.status === 'missing' && missing.summary.missing === TARGETS.length],
  ['write creates every target', written.status === 'pass' && written.targets.every((target) => fs.existsSync(target.path))],
  ['current after write', current.status === 'pass' && current.targets.every((target) => target.status === 'current')],
  ['drift detected', drift.status === 'drift' && drift.summary.drift === 1],
  ['renders markdown', markdown.includes('# Forgeflow Lean Portability Pack') && markdown.includes('generic-skill')],
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
console.log('lean portability pack: ok');
