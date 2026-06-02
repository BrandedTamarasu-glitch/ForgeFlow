#!/usr/bin/env node
const path = require('path');
const { buildCommandWrapperContract } = require('./command-wrapper-contract');

function usage() {
  console.error('Usage: render-wrapper-drift-plan.js [--root <repo>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function classifyIssue(issue) {
  if (issue.issue === 'missing-safe-args' || issue.source === 'commands/review.md') return 'high-risk';
  if (issue.issue === 'missing-node-env-scrub' || issue.issue === 'missing-repair-guidance') return 'safe-mechanical';
  return 'manual-review';
}

function commandForIssue(issue) {
  if (issue.issue === 'missing-node-env-scrub') return `Add env-scrubbed node invocation to ${issue.source}.`;
  if (issue.issue === 'missing-repair-guidance') return `Add /update-forgeflow --repair missing-helper guidance to ${issue.source}.`;
  if (issue.issue === 'missing-safe-args') return `Design and test safe argument parsing for ${issue.source}.`;
  return `Review ${issue.source} for ${issue.issue}.`;
}

function groupIssues(issues) {
  const groups = {
    safe_mechanical: [],
    manual_review: [],
    high_risk: [],
  };
  for (const issue of issues || []) {
    const entry = {
      source: issue.source,
      issue: issue.issue,
      action: commandForIssue(issue),
    };
    const classification = classifyIssue(issue);
    if (classification === 'safe-mechanical') groups.safe_mechanical.push(entry);
    else if (classification === 'high-risk') groups.high_risk.push(entry);
    else groups.manual_review.push(entry);
  }
  return groups;
}

function buildWrapperDriftPlan(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const contract = opts.contract || buildCommandWrapperContract({ root });
  const groups = groupIssues(contract.issues || []);
  const status = groups.safe_mechanical.length === 0 && groups.manual_review.length === 0
    ? (groups.high_risk.length > 0 ? 'blocked-on-high-risk' : 'clear')
    : 'actionable';
  const next = groups.safe_mechanical[0] || groups.manual_review[0] || groups.high_risk[0] || null;
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    status,
    issue_count: contract.issue_count || 0,
    pass_count: (contract.wrappers || []).filter((item) => item.status === 'pass').length,
    groups,
    next_action: next ? next.action : 'No wrapper drift remains.',
    next_source: next ? next.source : '',
    validation: [
      'node scripts/forgeflow/test-command-wrapper-contract.js',
      'node scripts/forgeflow/test-command-coverage.js',
      'node scripts/forgeflow/command-wrapper-contract.js --json',
    ],
    boundary: 'Wrapper drift plan is read-only. It does not edit command files, commit, push, or apply auto-fixes.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Wrapper Drift Plan',
    '',
    `Status: ${result.status}`,
    `Issues: ${result.issue_count}`,
    `Passing wrappers: ${result.pass_count}`,
    '',
    result.boundary,
    '',
  ];
  for (const [key, items] of Object.entries(result.groups)) {
    lines.push(`## ${key.replace(/_/g, ' ')}`, '');
    if (items.length === 0) lines.push('- None');
    for (const item of items) lines.push(`- ${item.source}: ${item.issue} - ${item.action}`);
    lines.push('');
  }
  lines.push('## Validation', '');
  for (const command of result.validation) lines.push(`- \`${command}\``);
  lines.push('', `Next: ${result.next_action}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildWrapperDriftPlan(opts);
  process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    usage();
    process.exit(1);
  }
}

module.exports = { buildWrapperDriftPlan, classifyIssue, groupIssues, parseArgs, renderMarkdown };
