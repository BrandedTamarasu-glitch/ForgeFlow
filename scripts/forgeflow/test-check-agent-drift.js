#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  checkAgentDrift,
  jaccardPercent,
  parseSections,
  renderMarkdown,
} = require('./check-agent-drift');

const repoRoot = path.resolve(__dirname, '..', '..');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-agent-drift-'));
const sharedDir = path.join(root, 'agents', '_shared');
const agentsDir = path.join(root, 'agents');
fs.mkdirSync(sharedDir, { recursive: true });
fs.mkdirSync(agentsDir, { recursive: true });

fs.writeFileSync(path.join(sharedDir, 'smith-craft.md'), [
  '---',
  'name: smith-craft',
  '---',
  '',
  '## Shared Checklist',
  '',
  '- Keep functions small.',
  '- Prefer clear names.',
  '',
  '## Database Review',
  '',
  '- Check indexes.',
  '- Check transaction boundaries.',
  '',
].join('\n'));
fs.writeFileSync(path.join(agentsDir, 'smith-review.md'), [
  '---',
  'name: smith-review',
  '---',
  '',
  '<role>Smith review.</role>',
  '',
  '## Shared Checklist',
  '',
  '- Keep functions small.',
  '- Prefer clear names.',
  '',
].join('\n'));
fs.writeFileSync(path.join(agentsDir, 'smith-consult.md'), [
  '## Shared Checklist',
  '',
  '- Different content only.',
  '',
  '## Database Review',
  '',
  '- Check indexes.',
  '- Check transaction boundaries.',
  '',
].join('\n'));

const parsed = parseSections(fs.readFileSync(path.join(sharedDir, 'smith-craft.md'), 'utf8'));
const focused = checkAgentDrift({ root, canonical: 'smith-craft', agent: 'smith-review', threshold: 70 });
const allSmith = checkAgentDrift({ root, canonical: 'smith-craft', threshold: 70 });
fs.writeFileSync(path.join(sharedDir, 'arbiter-intelligence.md'), [
  '## Conflict Resolution Hierarchy',
  '',
  '- Consult and review compare this.',
  '',
  '## Deviation Protocol',
  '',
  '- Implement compares this.',
  '',
  '## Lead Architect Intelligence',
  '',
  '- All Arbiter modes compare this.',
  '',
].join('\n'));
fs.writeFileSync(path.join(agentsDir, 'arbiter-review.md'), [
  '## Conflict Resolution Hierarchy',
  '',
  '- Consult and review compare this.',
  '',
  '<!-- adapted from _shared/arbiter-intelligence.md -->',
  '## Lead Architect Intelligence',
  '',
  '- Review mode adapts this heavily.',
  '',
].join('\n'));
const arbiterReview = checkAgentDrift({ root, canonical: 'arbiter-intelligence', agent: 'arbiter-review', threshold: 70 });
const markdown = renderMarkdown(focused);
const cli = spawnSync(process.execPath, [
  path.join(repoRoot, 'scripts/forgeflow/check-agent-drift.js'),
  '--root',
  root,
  '--canonical',
  'smith-craft',
  '--agent',
  'smith-review',
  '--json',
], { encoding: 'utf8' });
const cliJson = cli.stdout ? JSON.parse(cli.stdout) : {};
const badThreshold = spawnSync(process.execPath, [
  path.join(repoRoot, 'scripts/forgeflow/check-agent-drift.js'),
  '--threshold',
  '101',
], { encoding: 'utf8' });

const checks = [
  ['parses sections', parsed.length === 2 && parsed[0].heading === 'Shared Checklist'],
  ['jaccard scores', jaccardPercent(['a', 'b'], ['b', 'c']) === 33],
  ['detects missing section', focused.status === 'fail' && focused.per_agent[0].missing === 1 && focused.actionable === 1],
  ['detects drifted section', allSmith.per_agent.some((item) => item.agent === 'smith-consult' && item.drifted === 1)],
  ['tracks missing inputs', allSmith.missing_inputs.some((item) => item.kind === 'agent' && item.name === 'smith-audit')],
  ['applies mode-specific expected sections', arbiterReview.status === 'pass' && arbiterReview.per_agent[0].sections.every((section) => section.section !== 'Deviation Protocol')],
  ['treats adapted sections as modified', arbiterReview.per_agent[0].sections.some((section) => section.section === 'Lead Architect Intelligence' && section.status === 'MODIFIED' && section.adapted === true)],
  ['renders markdown', markdown.includes('# Forgeflow Drift Report') && markdown.includes('Actionable Drift')],
  ['cli json exits actionable', cli.status === 1 && Array.isArray(cliJson.per_agent) && cliJson.per_agent[0] && cliJson.per_agent[0].agent === 'smith-review'],
  ['bad threshold exits usage', badThreshold.status === 2 && badThreshold.stderr.includes('Invalid --threshold')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
    if (name === 'cli json exits actionable') {
      console.error(`  status: ${cli.status}`);
      console.error(`  stdout: ${cli.stdout.trim()}`);
      console.error(`  stderr: ${cli.stderr.trim()}`);
    }
  }
}

if (failed > 0) {
  process.exit(1);
}

console.log('agent drift: ok');
