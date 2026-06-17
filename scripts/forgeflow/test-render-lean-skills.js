#!/usr/bin/env node
const path = require('path');
const {
  SKILLS,
  buildLeanSkills,
  parseArgs,
  renderMarkdown,
  skillText,
} = require('./render-lean-skills');

const root = path.resolve(__dirname, '..', '..');
const result = buildLeanSkills({ root });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--write', '--json']);
const sample = skillText(SKILLS[0]);

const checks = [
  ['skills current', result.status === 'pass' && result.skills.length === SKILLS.length],
  ['prime skill present', result.skills.some((item) => item.name === 'forgeflow-lean-prime' && item.status === 'pass')],
  ['skill body carries rule', sample.includes('FORGEFLOW LEAN SESSION ACTIVE') && sample.includes('/forgeflow-lean-prime')],
  ['renders markdown', markdown.includes('# Forgeflow Lean Skills') && markdown.includes('read-only unless --write')],
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
console.log('lean skills: ok');
