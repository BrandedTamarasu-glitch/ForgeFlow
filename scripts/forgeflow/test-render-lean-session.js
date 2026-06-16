#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildLeanSession,
  parseArgs,
  renderMarkdown,
  resolveLeanProfile,
} = require('./render-lean-session');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-lean-session-'));
const projectDir = path.join(root, '.forgeflow', 'Demo');
fs.mkdirSync(path.join(projectDir, 'context'), { recursive: true });
fs.writeFileSync(path.join(projectDir, 'context', 'lean-policy.json'), JSON.stringify({ profile: 'lite', enabled: true }, null, 2));
const fromPolicy = buildLeanSession({ root, projectDir });
const explicitOff = buildLeanSession({ root, projectDir, profile: 'off' });
const explicitUltra = buildLeanSession({ root, projectDir, profile: 'ultra' });
const markdown = renderMarkdown(fromPolicy);
process.env.FORGEFLOW_LEAN_DEFAULT_MODE = 'strict';
const envResolved = resolveLeanProfile({ root: fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-lean-session-env-')) });
delete process.env.FORGEFLOW_LEAN_DEFAULT_MODE;
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--profile', 'balanced', '--json']);

const checks = [
  ['policy profile wins', fromPolicy.profile === 'lite' && fromPolicy.source === 'project-policy' && fromPolicy.instructions.includes('Lite mode')],
  ['explicit off disables guidance', explicitOff.status === 'off' && explicitOff.statusline === 'LEAN:off'],
  ['explicit ultra renders boundaries', explicitUltra.instructions.includes('calibration/tuning knobs') && explicitUltra.instructions.includes('current user instructions')],
  ['env default resolves', envResolved.profile === 'strict' && envResolved.source === 'FORGEFLOW_LEAN_DEFAULT_MODE'],
  ['renders markdown', markdown.includes('# Forgeflow Lean Session') && markdown.includes('Statusline: LEAN:lite')],
  ['parses args', opts.root === root && opts.projectDir === projectDir && opts.profile === 'balanced' && opts.json],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('lean session: ok');
