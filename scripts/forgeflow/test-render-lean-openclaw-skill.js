#!/usr/bin/env node
const path = require('path');
const {
  SKILL_PATH,
  buildLeanOpenClawSkill,
  parseArgs,
  renderMarkdown,
  skillText,
} = require('./render-lean-openclaw-skill');

const root = path.resolve(__dirname, '..', '..');
const result = buildLeanOpenClawSkill({ root });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--write', '--json']);

const checks = [
  ['openclaw skill current', result.status === 'pass' && result.current],
  ['skill text has frontmatter and canonical rule', skillText().includes('name: forgeflow-lean') && skillText().includes('FORGEFLOW LEAN SESSION ACTIVE')],
  ['renders markdown', markdown.includes('# Forgeflow Lean OpenClaw Skill') && markdown.includes('read-only unless --write')],
  ['parses args', opts.root === root && opts.write && opts.json],
  ['path is expected', SKILL_PATH.endsWith(path.join('forgeflow-lean', 'SKILL.md'))],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('lean openclaw skill: ok');
