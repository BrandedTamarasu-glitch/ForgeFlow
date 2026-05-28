#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { checkContextContract, parseArgs, renderMarkdown } = require('./check-context-contract');

const contextDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-contract-'));
const packetDir = path.join(contextDir, 'agent-packets');
fs.mkdirSync(packetDir, { recursive: true });
fs.writeFileSync(path.join(contextDir, 'agent-context-contract.json'), JSON.stringify({
  schema_version: '1',
  agents: {
    warden_reviewer: { agent: 'warden_reviewer', allowed_signals: [], advisory_signals: [], verify_before_use: [], prohibited_uses: [] },
  },
}, null, 2));
fs.writeFileSync(path.join(packetDir, 'warden_reviewer.md'), [
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
