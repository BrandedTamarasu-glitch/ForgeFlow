#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('node:assert/strict');
const { checkContextContract, parseArgs, renderMarkdown } = require('./check-context-contract');

const contextDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-contract-'));
const packetDir = path.join(contextDir, 'agent-packets');
fs.mkdirSync(packetDir, { recursive: true });
fs.writeFileSync(path.join(contextDir, 'agent-context-contract.json'), JSON.stringify({
  schema_version: '1',
  agents: {
    guardian_reviewer: { agent: 'guardian_reviewer', allowed_signals: [], advisory_signals: [], verify_before_use: [], prohibited_uses: [] },
  },
}, null, 2));
fs.writeFileSync(path.join(packetDir, 'guardian_reviewer.md'), [
  '# Packet',
  '',
  '## Packet Artifact Trust',
  'ok',
  '',
  '## Agent Context Contract',
  'ok',
  '',
  '## Output Contract',
  'ok',
  '',
].join('\n'));

const result = checkContextContract({ contextDir });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--context-dir', contextDir, '--json']);

const manifestPath = path.join(contextDir, 'synthesis-input.json');
const historicalPath = path.join(packetDir, 'warden_reviewer.md');
const historicalBytes = '# Historical packet\nThis content predates the current contract.\n';
fs.writeFileSync(historicalPath, historicalBytes);
const manifest = { agent_packets: { guardian_reviewer: '.forgeflow/Demo/context/latest/agent-packets/guardian_reviewer.md' } };
fs.writeFileSync(manifestPath, JSON.stringify(manifest));
assert.equal(checkContextContract({ contextDir }).status, 'pass');
assert.equal(checkContextContract({ contextDir }).packet_count, 1);
assert.equal(fs.readFileSync(historicalPath, 'utf8'), historicalBytes);
const currentPath = path.join(packetDir, 'guardian_reviewer.md');
const currentBytes = fs.readFileSync(currentPath, 'utf8');
fs.unlinkSync(currentPath);
assert.ok(checkContextContract({ contextDir }).issues.some((issue) => issue.code === 'agent-packet-missing' && issue.severity === 'fail'));
fs.writeFileSync(currentPath, currentBytes);
for (const invalid of [null, [], {}, { guardian_reviewer: 'agent-packets/warden_reviewer.md' }, { guardian_reviewer: 42 }]) {
  fs.writeFileSync(manifestPath, JSON.stringify({ agent_packets: invalid }));
  assert.equal(checkContextContract({ contextDir }).status, 'fail');
}
fs.writeFileSync(manifestPath, 'null');
assert.equal(checkContextContract({ contextDir }).status, 'fail');
fs.writeFileSync(manifestPath, JSON.stringify({ agent_packets: { ...manifest.agent_packets, custom: 'agent-packets/custom.md' } }));
fs.writeFileSync(path.join(packetDir, 'custom.md'), currentBytes);
assert.ok(checkContextContract({ contextDir }).issues.some((issue) => issue.code === 'agent-contract-missing'));
fs.unlinkSync(manifestPath);
assert.ok(checkContextContract({ contextDir }).issues.some((issue) => issue.code === 'agent-contract-missing' && issue.agent === 'warden_reviewer'));

const checks = [
  ['passes valid packet', result.status === 'pass' && result.packet_count === 1],
  ['renders markdown', markdown.includes('# Forgeflow Context Contract Check') && markdown.includes('read-only')],
  ['parses args', opts.contextDir === contextDir && opts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('context contract check: ok');
