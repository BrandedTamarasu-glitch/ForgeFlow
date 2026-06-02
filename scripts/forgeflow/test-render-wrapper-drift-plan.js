#!/usr/bin/env node
const path = require('path');
const {
  buildWrapperDriftPlan,
  classifyIssue,
  groupIssues,
  parseArgs,
  renderMarkdown,
} = require('./render-wrapper-drift-plan');

const sampleContract = {
  issue_count: 3,
  wrappers: [
    { source: 'commands/a.md', status: 'pass' },
    { source: 'commands/b.md', status: 'attention' },
  ],
  issues: [
    { source: 'commands/a.md', issue: 'missing-node-env-scrub' },
    { source: 'commands/b.md', issue: 'missing-repair-guidance' },
    { source: 'commands/review.md', issue: 'missing-safe-args' },
  ],
};
const plan = buildWrapperDriftPlan({ root: '.', contract: sampleContract });
const highRiskOnly = buildWrapperDriftPlan({
  root: '.',
  contract: {
    issue_count: 1,
    wrappers: [],
    issues: [{ source: 'commands/review.md', issue: 'missing-safe-args' }],
  },
});
const clear = buildWrapperDriftPlan({ root: '.', contract: { issue_count: 0, wrappers: [], issues: [] } });
const groups = groupIssues(sampleContract.issues);
const markdown = renderMarkdown(plan);
const opts = parseArgs(['--root', '.', '--json']);

const checks = [
  ['classifies safe issues', classifyIssue({ source: 'commands/a.md', issue: 'missing-node-env-scrub' }) === 'safe-mechanical'],
  ['classifies high-risk review safe args', classifyIssue({ source: 'commands/review.md', issue: 'missing-safe-args' }) === 'high-risk'],
  ['groups issues', groups.safe_mechanical.length === 2 && groups.high_risk.length === 1],
  ['builds actionable plan', plan.status === 'actionable' && plan.groups.safe_mechanical.length === 2 && plan.next_action.includes('env-scrubbed')],
  ['builds high-risk blocked plan', highRiskOnly.status === 'blocked-on-high-risk' && highRiskOnly.next_source === 'commands/review.md'],
  ['builds clear plan', clear.status === 'clear' && clear.next_action === 'No wrapper drift remains.'],
  ['renders markdown', markdown.includes('# Forgeflow Wrapper Drift Plan') && markdown.includes('## safe mechanical') && markdown.includes('## high risk')],
  ['parses args', opts.root === path.resolve('.') && opts.json === true],
  ['lists validation', plan.validation.some((command) => command.includes('test-command-wrapper-contract.js'))],
  ['boundary read-only', plan.boundary.includes('read-only') && plan.boundary.includes('does not edit')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('wrapper drift plan: ok');
