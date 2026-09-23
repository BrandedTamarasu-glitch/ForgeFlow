#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { safeReadTextFile, writeFileSafe } = require('./file-safety');

const START = '<!-- forgeflow-capability-selection:start -->';
const END = '<!-- forgeflow-capability-selection:end -->';
const WORKFLOWS = ['discuss', 'research', 'plan', 'consult', 'implement', 'review', 'audit', 'ship', 'quick'];
const CODEX_SKILLS = {
  discuss: 'discuss', research: 'research', plan: 'plan', consult: 'consult', implement: 'implement',
  'forge-review': 'review', 'forgeflow-consult': 'consult', 'forgeflow-implement': 'implement',
  'forgeflow-review': 'review', audit: 'audit', ship: 'ship', quick: 'quick',
};
const DESCRIPTION = 'Select relevant ForgeFlow capabilities for a scoped task, including domain procedures, and report availability without executing them.';

function guidance(phase) {
  const phaseText = phase === 'quick' ? 'the actual task phase (usually implement or review)' : phase;
  return [
    'Resolve `select-capabilities.js` from the checkout `scripts/forgeflow`, a host-supplied plugin root, or the installed ForgeFlow runtime for this host. Run `node <helper-dir>/select-capabilities.js --guide` and follow the shared selection procedure',
    `with phase **${phaseText}** and the current objective, criteria and affected scope. Reuse the same result across alias handoffs and pass it through existing context construction; do not reset reassessment limits.`,
    'Missing runtime support is an explicit limitation, not a reason to invent selection results. Preserve current workflow read-only and isolation boundaries. Planned capabilities are not executable and selection grants no new authority.',
  ].join(' ');
}

function workflowBlock(phase) {
  return `${START}\n## Automatic capability selection\n\n${guidance(phase)}\n${END}`;
}

function wrapper(command = false) {
  return [
    '---', 'name: forgeflow-capabilities', `description: ${DESCRIPTION}`,
    ...(command ? ['argument-hint: "[task objective or selection input]"', 'allowed-tools: [Read, Bash, Write]'] : []),
    '---', '', '# Capability selection', '', guidance('quick'), '',
    'This entry point exposes the same automatic step used inside ForgeFlow workflows. Users do not need to invoke it manually to enable money/calendar or CAD selection.', '',
  ].join('\n');
}

function replaceBlock(content, block, file) {
  const starts = content.split(START).length - 1;
  const ends = content.split(END).length - 1;
  if (starts !== ends || starts > 1 || (starts && content.indexOf(END) < content.indexOf(START))) throw new Error(`Invalid capability markers: ${file}`);
  if (starts) return content.slice(0, content.indexOf(START)) + block + content.slice(content.indexOf(END) + END.length);
  const frontmatter = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  if (!frontmatter) throw new Error(`Missing frontmatter: ${file}`);
  return `${frontmatter[0]}\n${block}\n${content.slice(frontmatter[0].length)}`;
}

function renderEntrypoints({ root = path.resolve(__dirname, '../..'), write = false } = {}) {
  const workflows = [
    ...WORKFLOWS.map(phase => [`commands/${phase}.md`, phase]),
    ...Object.entries(CODEX_SKILLS).map(([name, phase]) => [`.agents/skills/${name}/SKILL.md`, phase]),
  ];
  // Resolve every existing input before mutating any generated entry point.
  const outputs = workflows.map(([file, phase]) => ({ file, expected: replaceBlock(safeReadTextFile(path.join(root, file), root).content, workflowBlock(phase), file) }));
  outputs.push(
    { file: 'commands/forgeflow-capabilities.md', expected: wrapper(true) },
    { file: '.agents/skills/forgeflow-capabilities/SKILL.md', expected: wrapper() },
    { file: 'skills/forgeflow-capabilities/SKILL.md', expected: wrapper() },
  );
  const entries = outputs.map(({ file, expected }) => {
    const full = path.join(root, file);
    const actual = fs.existsSync(full) ? safeReadTextFile(full, root).content : '';
    if (write && actual !== expected) writeFileSafe(full, expected);
    return { file, status: actual === expected || write ? 'pass' : 'drift' };
  });
  return { status: entries.every(item => item.status === 'pass') ? 'pass' : 'drift', entries };
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== '--write')) throw new Error('Usage: render-capability-entrypoints.js [--write]');
    const result = renderEntrypoints({ write: args.includes('--write') });
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== 'pass') process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { renderEntrypoints, replaceBlock, workflowBlock, WORKFLOWS, CODEX_SKILLS };
