#!/usr/bin/env node
const path = require('path');
const { buildPilotScript } = require('./render-pilot-script');
const { rollupPilotEvidence } = require('./rollup-pilot-evidence');

function usage() {
  console.error('Usage: render-adoption-pack.js [--runtime claude-code|codex] [--project-name <name>] [--path maintainer|new-user] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}`);
  }
  return value;
}

function parseArgs(argv) {
  const opts = {
    runtime: 'codex',
    projectName: '',
    path: 'new-user',
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--runtime') {
      opts.runtime = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--project-name') {
      opts.projectName = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--path') {
      opts.path = requireValue(argv, arg, i);
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
  if (!['claude-code', 'codex'].includes(opts.runtime)) throw new Error(`Invalid --runtime: ${opts.runtime}`);
  if (!['maintainer', 'new-user'].includes(opts.path)) throw new Error(`Invalid --path: ${opts.path}`);
  return opts;
}

function buildAdoptionPack(opts = {}) {
  const pilot = buildPilotScript({
    runtime: opts.runtime || 'codex',
    projectName: opts.projectName || '',
    path: opts.path || 'new-user',
  });
  const projectDir = path.join(process.cwd(), pilot.project_dir);
  const rollup = rollupPilotEvidence({ projectDir });
  const trialEvidence = {
    status: rollup.pilot_count > 0 ? 'available' : 'not-recorded',
    pilot_count: rollup.pilot_count,
    decision: rollup.decision,
    health_results: rollup.health_results,
    support_categories: rollup.support_categories,
    findings: rollup.findings,
    review_minutes: rollup.review_minutes,
    blocked_first_review_count: rollup.blocked_first_review_count,
    repeated_issue_categories: rollup.repeat_issue_count,
    next_fix_layer: rollup.next_fix_layer,
    rollup_path: path.join(pilot.project_dir, 'pilot-evidence-rollup.md'),
  };
  return {
    schema_version: '1',
    runtime: pilot.runtime,
    path: pilot.path,
    project_name: pilot.project_name,
    thesis: 'Forgeflow is worth trying when a project needs repeatable planning, implementation notes, evidence-based review, and local project memory without handing over maintainer judgment.',
    best_fit: [
      'A real work item is clear enough to plan and test.',
      'The user wants reviewer findings tied to files, tests, and current evidence.',
      'The team wants local learning across work items, not a one-off chat transcript.',
      'The project can keep `.forgeflow/` artifacts private by default.',
    ],
    not_a_fit_yet: [
      'Emergency production fixes where extra workflow steps would slow response.',
      'Projects that cannot store local workflow artifacts.',
      'Tasks with no test, review, or human triage surface.',
    ],
    first_trial: pilot.steps.map((step, index) => ({
      order: index + 1,
      name: step.name,
      evidence: step.evidence,
      commands: step.commands,
    })),
    trial_evidence: trialEvidence,
    decision_rubric: {
      repeat_pilot: 'Use when setup worked and at least one signal was useful, but evidence is still thin.',
      expand_small_team: 'Use when setup is repeatable, findings are actionable, privacy boundaries are clear, and friction is manageable.',
      stop_and_fix: 'Use when install, privacy, routing, evidence quality, or review usefulness blocks another trial.',
      defer: 'Use when the workflow works but the team does not need more process right now.',
    },
    proof_boundary: [
      'Forgeflow output is guidance until verified against current code, tests, and artifacts.',
      'Raw `.forgeflow/` records stay local unless the project explicitly approves sharing.',
      'Public summaries should use aggregate counts and redacted notes only.',
    ],
    follow_up_commands: [
      `scripts/forgeflow/render-pilot-script.js --runtime ${pilot.runtime} --path ${pilot.path}`,
      `scripts/forgeflow/record-pilot-evidence.js --runtime ${pilot.runtime} --health-result <pass|warn|fail> --project-type other --adoption-decision <repeat-pilot|expand-small-team|stop-and-fix|defer> --json`,
      'scripts/forgeflow/rollup-pilot-evidence.js --json',
    ],
  };
}

function countLines(counts) {
  const entries = Object.entries(counts || {});
  if (entries.length === 0) return ['- none recorded'];
  return entries.map(([name, count]) => `- ${name}: ${count}`);
}

function renderMarkdown(pack) {
  const lines = [
    '# Forgeflow Adoption Pack',
    '',
    `Runtime: ${pack.runtime}`,
    `Path: ${pack.path}`,
    `Project: ${pack.project_name}`,
    '',
    '## Why Use It',
    '',
    pack.thesis,
    '',
    '## Best Fit',
    '',
    ...pack.best_fit.map((item) => `- ${item}`),
    '',
    '## Not A Fit Yet',
    '',
    ...pack.not_a_fit_yet.map((item) => `- ${item}`),
    '',
    '## First Trial',
    '',
  ];
  for (const step of pack.first_trial) {
    lines.push(`### ${step.order}. ${step.name}`, '', `Evidence: ${step.evidence}`, '', 'Commands:', '');
    for (const command of step.commands) lines.push(`- \`${command}\``);
    lines.push('');
  }
  lines.push('## Existing Trial Evidence', '');
  if (pack.trial_evidence.status === 'available') {
    lines.push(
      `Pilot count: ${pack.trial_evidence.pilot_count}`,
      `Current rollup decision: ${pack.trial_evidence.decision}`,
      `Blocked first reviews: ${pack.trial_evidence.blocked_first_review_count}`,
      `Repeated issue categories: ${pack.trial_evidence.repeated_issue_categories}`,
      `Review minutes: ${pack.trial_evidence.review_minutes}`,
      `Findings: ${pack.trial_evidence.findings.confirmed} confirmed, ${pack.trial_evidence.findings.rejected} rejected, ${pack.trial_evidence.findings.deferred} deferred`,
    );
    if (pack.trial_evidence.next_fix_layer) lines.push(`Next fix layer: ${pack.trial_evidence.next_fix_layer}`);
    lines.push('', 'Health results:', '', ...countLines(pack.trial_evidence.health_results), '', 'Support categories:', '', ...countLines(pack.trial_evidence.support_categories), '');
  } else {
    lines.push('No pilot evidence has been recorded yet. Run the first trial, record evidence, then rerender this pack to see adoption signal.', '');
  }
  lines.push('## Decision Rubric', '');
  for (const [key, value] of Object.entries(pack.decision_rubric)) {
    lines.push(`- ${key}: ${value}`);
  }
  lines.push('', '## Proof Boundary', '', ...pack.proof_boundary.map((item) => `- ${item}`), '', '## Follow-Up Commands', '');
  for (const command of pack.follow_up_commands) lines.push(`- \`${command}\``);
  lines.push('');
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const pack = buildAdoptionPack(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(pack, null, 2)}\n` : renderMarkdown(pack));
  } catch (err) {
    console.error(err.message);
    usage();
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  buildAdoptionPack,
  renderMarkdown,
};
