#!/usr/bin/env node
const path = require('path');
const {
  buildLeanDecision,
  forbiddenSimplifications,
  parseArgs,
  renderBriefSection,
  renderMarkdown,
  reuseCandidates,
  validationMinimum,
} = require('./render-lean-decision');

const pkg = { dependencies: ['zod', 'express'], dev_dependencies: [], scripts: ['test'] };
const artifacts = {
  invocation: { hints: [{ suggested_invocation: 'npm test' }] },
};
const dateDecision = buildLeanDecision({
  root: '.',
  projectDir: '.forgeflow/Demo',
  text: 'Add a date picker to the settings form.',
  packageInfo: pkg,
  invocation: artifacts.invocation,
  model: { validation_norms: ['Run focused UI test after form changes.'] },
  architecture: {},
  ownership: {},
});
const authDecision = buildLeanDecision({
  root: '.',
  projectDir: '.forgeflow/Demo',
  text: 'Add auth token validation for dashboard API requests.',
  packageInfo: pkg,
  model: {},
  architecture: {},
  ownership: {},
  invocation: {},
});
const commandDecision = buildLeanDecision({
  root: '.',
  projectDir: '.forgeflow/Demo',
  text: 'Add a Forgeflow command wrapper for docs validation.',
  packageInfo: { dependencies: [], dev_dependencies: [], scripts: [] },
  model: {},
  architecture: {},
  ownership: {},
  invocation: {},
});
const missing = buildLeanDecision({
  root: '.',
  projectDir: '.forgeflow/Demo',
  text: '',
  packageInfo: pkg,
  model: {},
  architecture: {},
  ownership: {},
  invocation: {},
});
const optional = buildLeanDecision({
  root: '.',
  projectDir: '.forgeflow/Demo',
  text: 'Eventually add optional dashboard theme plugins.',
  packageInfo: pkg,
  model: {},
  architecture: {},
  ownership: {},
  invocation: {},
});
const markdown = renderMarkdown(dateDecision);
const briefSection = renderBriefSection(dateDecision);
const opts = parseArgs(['--root', '.', '--project-dir', '.forgeflow/Demo', '--task', 'Add cache', '--json']);

const checks = [
  ['detects native date candidate', dateDecision.reuse_candidates.some((item) => item.kind === 'native' && item.candidate.includes('date'))],
  ['detects installed dependencies', reuseCandidates('validate schema', pkg, {}).some((item) => item.candidate.includes('zod'))],
  ['uses simplify-first decision', dateDecision.decision === 'simplify-first' && dateDecision.next_command === '/consult'],
  ['emits implementation note candidate', dateDecision.implementation_note_candidate && dateDecision.implementation_note_candidate.category === 'tradeoff' && dateDecision.implementation_note_candidate.note.includes('Known ceiling') && dateDecision.implementation_note_candidate.why.includes('Upgrade trigger')],
  ['keeps safety boundaries', authDecision.do_not_simplify.includes('authentication and authorization behavior') && forbiddenSimplifications('money ledger').includes('money correctness and concurrency')],
  ['adds command validation minimum', commandDecision.validation_minimum.commands.includes('node scripts/forgeflow/test-command-wrapper-smoke.js') && commandDecision.validation_minimum.commands.includes('node scripts/forgeflow/test-doc-links.js')],
  ['uses project validation norms', validationMinimum('helper', { model: { validation_norms: ['Run helper test.'] } }).project_norms[0] === 'Run helper test.'],
  ['missing task is attention', missing.status === 'attention' && missing.decision === 'needs-task'],
  ['optional work can defer', optional.decision === 'skip-or-defer'],
  ['renders markdown', markdown.includes('# Forgeflow Lean Decision') && markdown.includes('## Do Not Simplify') && markdown.includes('Known ceiling')],
  ['renders implementation brief section', briefSection.includes('## Lean Decision') && briefSection.includes('### Do First') && briefSection.includes('### Avoid First') && briefSection.includes('### Validate With') && briefSection.includes('### Do Not Simplify') && briefSection.includes('### Upgrade When') && briefSection.includes('Lean guidance is advisory only')],
  ['parses args', opts.root === path.resolve('.') && opts.projectDir === path.resolve('.forgeflow/Demo') && opts.task === 'Add cache' && opts.json === true],
  ['boundary is read-only', dateDecision.boundary.includes('read-only') && dateDecision.boundary.includes('does not edit files')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('lean decision: ok');
