#!/usr/bin/env node
const path = require('path');
const {
  SKILLS,
  buildForgeflowSkills,
  parseArgs,
  renderMarkdown,
  skillText,
} = require('./render-forgeflow-skills');

const root = path.resolve(__dirname, '..', '..');
const result = buildForgeflowSkills({ root });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--write', '--json']);

const checks = [
  ['core skills current', result.status === 'pass' && result.skills.length === SKILLS.length],
  ['review skill present', result.skills.some((item) => item.name === 'forgeflow-review' && item.command === '/review')],
  ['skill body carries boundary', skillText(SKILLS[0]).includes('Do not commit, push')],
  ['renders markdown', markdown.includes('# Forgeflow Skills') && markdown.includes('read-only unless --write')],
  ['parses args', opts.root === root && opts.write && opts.json],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('forgeflow skills: ok');
