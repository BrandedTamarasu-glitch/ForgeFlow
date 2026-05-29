#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildCommandIndex, parseArgs, renderMarkdown } = require('./render-command-index');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-command-index-'));
const commandsDir = path.join(root, 'commands');
fs.mkdirSync(path.join(commandsDir, 'agent-chat'), { recursive: true });
fs.writeFileSync(path.join(commandsDir, 'forgeflow-health.md'), [
  '---',
  'name: forgeflow-health',
  'description: Check install health',
  'argument-hint: "[--json]"',
  '---',
  '',
].join('\n'));
fs.writeFileSync(path.join(commandsDir, 'forgeflow-efficiency-gaps.md'), [
  '---',
  'name: forgeflow-efficiency-gaps',
  'description: Plan efficiency gaps',
  'argument-hint: "[--json]"',
  '---',
  '',
].join('\n'));
fs.writeFileSync(path.join(commandsDir, 'review.md'), [
  '---',
  'name: review',
  'description: Review current changes',
  'argument-hint: ""',
  '---',
  '',
].join('\n'));
fs.writeFileSync(path.join(commandsDir, 'forgeflow-review-wave-prep.md'), [
  '---',
  'name: forgeflow-review-wave-prep',
  'description: Prepare review waves',
  'argument-hint: ""',
  '---',
  '',
].join('\n'));
fs.writeFileSync(path.join(commandsDir, 'agent-chat', 'on.md'), [
  '---',
  'name: agent-chat:on',
  'description: Start agent chat',
  'argument-hint: ""',
  '---',
  '',
].join('\n'));

const result = buildCommandIndex({ root });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--json']);

const checks = [
  ['counts commands', result.command_count === 5],
  ['groups workflow commands', result.groups.workflow.some((item) => item.name === 'review') && result.groups.workflow.some((item) => item.name === 'agent-chat:on') && result.groups.workflow.some((item) => item.name === 'forgeflow-review-wave-prep')],
  ['groups intelligence commands', result.groups.intelligence.some((item) => item.name === 'forgeflow-efficiency-gaps')],
  ['groups install release commands', result.groups['install-release'].some((item) => item.name === 'forgeflow-health')],
  ['renders slash commands with args', markdown.includes('`/forgeflow-health [--json]` - Check install health')],
  ['renders nested command contract', markdown.includes('`/agent-chat:on` - Start agent chat')],
  ['renders generated boundary', markdown.includes('command frontmatter and runtime inventory command discovery')],
  ['parses args', opts.root === root && opts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('command index: ok');
