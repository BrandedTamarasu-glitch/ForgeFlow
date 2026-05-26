#!/usr/bin/env node
const path = require('path');
const { buildPilotScript } = require('./render-pilot-script');
const { isPathInside } = require('./file-safety');
const { publicSafeBlocker, shellQuote } = require('./privacy-boundary');
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
  if (!['claude-code', 'codex'].includes(opts.runtime)) throw new Error('Invalid --runtime');
  if (!['maintainer', 'new-user'].includes(opts.path)) throw new Error('Invalid --path');
  return opts;
}

function buildAdoptionPack(opts = {}) {
  const pilot = buildPilotScript({
    runtime: opts.runtime || 'codex',
    projectName: opts.projectName || '',
    path: opts.path || 'new-user',
  });
  const projectDir = safePilotProjectDir(pilot.project_dir);
  const rollup = rollupPilotEvidence({ projectDir });
  const nextAction = adoptionNextAction(rollup, pilot);
  const publicSummary = publicSafeSummary(rollup, pilot, nextAction);
  const smallTeamHandoff = smallTeamHandoffPlan(pilot, nextAction);
  const trialEvidence = {
    status: rollup.pilot_count > 0 ? 'available' : 'not-recorded',
    pilot_count: rollup.pilot_count,
    decision: rollup.decision,
    health_results: rollup.health_results,
    support_categories: publicSafeCounts(rollup.support_categories),
    findings: rollup.findings,
    review_minutes: rollup.review_minutes,
    blocked_first_review_count: rollup.blocked_first_review_count,
    repeated_issue_categories: rollup.repeat_issue_count,
    next_fix_layer: rollup.next_fix_layer,
    next_action: publicSafeNextAction(nextAction),
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
    public_safe_summary: publicSummary,
    small_team_handoff: smallTeamHandoff,
    decision_rubric: {
      repeat_pilot: 'Use when setup worked and at least one signal was useful, but evidence is still thin.',
      expand_small_team: 'Use when setup is repeatable, findings are actionable, privacy boundaries are clear, and friction is manageable.',
      stop_and_fix: 'Use when install, privacy, routing, evidence quality, or review usefulness blocks another trial.',
      defer: 'Use when the workflow works but the team does not need more process right now.',
    },
    decision_template: {
      decision: '<repeat-pilot|expand-small-team|stop-and-fix|defer>',
      decision_reason: '<short evidence-backed reason>',
      owner: '<maintainer|team-lead|forgeflow-maintainer>',
      blocker: '<public-safe blocker category or none>',
      next_command: '<command to run next>',
      next_review_date: '<date or not scheduled>',
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

function safePilotProjectDir(projectDir) {
  const root = process.cwd();
  const forgeflowRoot = path.join(root, '.forgeflow');
  const resolved = path.resolve(root, projectDir || '');
  if (!isPathInside(forgeflowRoot, resolved)) {
    throw new Error('Pilot project directory must stay under .forgeflow');
  }
  return resolved;
}

function publicSafeCounts(counts) {
  const safeCounts = {};
  for (const [name, count] of Object.entries(counts || {})) {
    const safeName = publicSafeBlocker(name) || 'unclassified-support-category';
    safeCounts[safeName] = (safeCounts[safeName] || 0) + count;
  }
  return safeCounts;
}

function publicSafeNextAction(action = {}) {
  return {
    ...action,
    blocker: publicSafeBlocker(action.blocker),
  };
}

function publicSafeSummary(rollup, pilot, nextAction) {
  const hasEvidence = rollup && rollup.pilot_count > 0;
  return {
    sharing_level: 'public-safe',
    runtime: pilot.runtime,
    path: pilot.path,
    evidence_status: hasEvidence ? 'available' : 'not-recorded',
    pilot_count: hasEvidence ? rollup.pilot_count : 0,
    decision: hasEvidence ? adoptionDecisionFromRollup(rollup) : 'repeat-pilot',
    recommended_action: nextAction.action,
    owner: nextAction.owner,
    blocker: publicSafeBlocker(nextAction.blocker),
    review_minutes: hasEvidence ? rollup.review_minutes : 0,
    confirmed_findings: hasEvidence && rollup.findings ? rollup.findings.confirmed : 0,
    rejected_findings: hasEvidence && rollup.findings ? rollup.findings.rejected : 0,
    deferred_findings: hasEvidence && rollup.findings ? rollup.findings.deferred : 0,
    note: 'Share aggregate counts and decisions only; keep raw .forgeflow evidence local unless the project explicitly approves sharing.',
  };
}

function adoptionDecisionFromRollup(rollup) {
  const decision = rollup && rollup.decision ? rollup.decision : '';
  if (decision === 'fix-now') return 'stop-and-fix';
  if (decision === 'run-another-pilot') return 'repeat-pilot';
  if (decision === 'expand-small-team') return 'expand-small-team';
  if (decision === 'defer') return 'defer';
  return 'repeat-pilot';
}

function projectNameArg(pilot) {
  return shellQuote(pilot.project_name);
}

function smallTeamHandoffPlan(pilot, nextAction) {
  const command = pilot.runtime === 'claude-code'
    ? `/forgeflow-pilot --runtime claude-code --project-name ${projectNameArg(pilot)} --path maintainer`
    : `scripts/forgeflow/render-pilot-script.js --runtime codex --project-name ${projectNameArg(pilot)} --path maintainer`;
  return {
    status: nextAction.action === 'expand-small-team' ? 'ready-to-expand' : 'not-ready-yet',
    owner: nextAction.action === 'expand-small-team' ? 'team-lead' : nextAction.owner,
    candidate_count: 'one or two maintainers',
    command,
    prerequisites: [
      'Keep the same privacy boundary and sharing level from the first trial.',
      'Pick one bounded branch per added maintainer.',
      'Record pilot evidence after each trial before changing rollout scope.',
      'Stop and fix before expanding if install, privacy, routing, or review quality blocks the first review.',
    ],
    next_check: 'Rerender the adoption pack after the next recorded trial.',
  };
}

function firstCountKey(counts) {
  return Object.entries(counts || {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || '';
}

function adoptionCommand(pilot) {
  if (pilot.runtime === 'claude-code') return `/forgeflow-adoption --runtime claude-code --project-name ${projectNameArg(pilot)} --path ${pilot.path}`;
  return `scripts/forgeflow/render-adoption-pack.js --runtime codex --project-name ${projectNameArg(pilot)} --path ${pilot.path}`;
}

function healthCommand(pilot) {
  if (pilot.runtime === 'claude-code') return '/forgeflow-health';
  return 'scripts/forgeflow/health-check.js --json';
}

function pilotCommand(pilot) {
  if (pilot.runtime === 'claude-code') return `/forgeflow-pilot --runtime claude-code --project-name ${projectNameArg(pilot)} --path ${pilot.path}`;
  return `scripts/forgeflow/render-pilot-script.js --runtime codex --project-name ${projectNameArg(pilot)} --path ${pilot.path}`;
}

function adoptionNextAction(rollup, pilot) {
  if (!rollup || rollup.pilot_count === 0) {
    return {
      action: 'run-first-trial',
      owner: 'maintainer',
      blocker: '',
      fix_layer: '',
      command: pilotCommand(pilot),
      reason: 'No local pilot evidence has been recorded yet.',
    };
  }
  const topCategory = firstCountKey(rollup.support_categories);
  if (rollup.blocked_first_review_count > 0) {
    return {
      action: 'fix-blocked-first-review',
      owner: 'maintainer',
      blocker: topCategory || 'first-review-blocked',
      fix_layer: rollup.next_fix_layer || '',
      command: healthCommand(pilot),
      reason: `${rollup.blocked_first_review_count} pilot record(s) show a blocked first review or stop-and-fix decision.`,
    };
  }
  if (rollup.repeat_issue_count > 0) {
    return {
      action: 'fix-repeated-friction',
      owner: 'forgeflow-maintainer',
      blocker: topCategory || 'repeated-support-category',
      fix_layer: rollup.next_fix_layer || '',
      command: adoptionCommand(pilot),
      reason: `${rollup.repeat_issue_count} support categor${rollup.repeat_issue_count === 1 ? 'y has' : 'ies have'} repeated across pilot evidence.`,
    };
  }
  if ((rollup.adoption_decisions['expand-small-team'] || 0) > 0) {
    return {
      action: 'expand-small-team',
      owner: 'team-lead',
      blocker: '',
      fix_layer: '',
      command: pilot.runtime === 'claude-code'
        ? `/forgeflow-pilot --runtime claude-code --project-name ${projectNameArg(pilot)} --path maintainer`
        : `scripts/forgeflow/render-pilot-script.js --runtime codex --project-name ${projectNameArg(pilot)} --path maintainer`,
      reason: 'Pilot evidence includes an expand-small-team decision and no blocking repeated friction.',
    };
  }
  if ((rollup.adoption_decisions.defer || 0) > 0) {
    return {
      action: 'defer-rollout',
      owner: 'maintainer',
      blocker: '',
      fix_layer: '',
      command: adoptionCommand(pilot),
      reason: 'Pilot evidence says the workflow can wait even if it is usable.',
    };
  }
  return {
    action: 'run-another-pilot',
    owner: 'maintainer',
    blocker: topCategory,
    fix_layer: rollup.next_fix_layer || '',
    command: pilotCommand(pilot),
    reason: 'Pilot evidence exists, but adoption signal is still thin.',
  };
}

function countLines(counts) {
  const entries = Object.entries(counts || {});
  if (entries.length === 0) return ['- none recorded'];
  return entries.map(([name, count]) => `- ${name}: ${count}`);
}

function publicSafeCountLines(counts) {
  return countLines(publicSafeCounts(counts));
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
    lines.push(
      '',
      'Recommended next action:',
      '',
      `- Action: ${pack.trial_evidence.next_action.action}`,
      `- Owner: ${pack.trial_evidence.next_action.owner}`,
      `- Command: \`${pack.trial_evidence.next_action.command}\``,
      `- Reason: ${pack.trial_evidence.next_action.reason}`,
    );
    if (pack.trial_evidence.next_action.blocker) lines.push(`- Blocker: ${publicSafeBlocker(pack.trial_evidence.next_action.blocker)}`);
    if (pack.trial_evidence.next_action.fix_layer) lines.push(`- Fix layer: ${pack.trial_evidence.next_action.fix_layer}`);
    lines.push('', 'Health results:', '', ...countLines(pack.trial_evidence.health_results), '', 'Support categories:', '', ...publicSafeCountLines(pack.trial_evidence.support_categories), '');
  } else {
    lines.push(
      'No pilot evidence has been recorded yet. Run the first trial, record evidence, then rerender this pack to see adoption signal.',
      '',
      'Recommended next action:',
      '',
      `- Action: ${pack.trial_evidence.next_action.action}`,
      `- Owner: ${pack.trial_evidence.next_action.owner}`,
      `- Command: \`${pack.trial_evidence.next_action.command}\``,
      `- Reason: ${pack.trial_evidence.next_action.reason}`,
      '',
    );
  }
  lines.push('## Public-Safe Summary', '');
  lines.push(
    `- Sharing level: ${pack.public_safe_summary.sharing_level}`,
    `- Evidence status: ${pack.public_safe_summary.evidence_status}`,
    `- Pilot count: ${pack.public_safe_summary.pilot_count}`,
    `- Decision: ${pack.public_safe_summary.decision}`,
    `- Recommended action: ${pack.public_safe_summary.recommended_action}`,
    `- Owner: ${pack.public_safe_summary.owner}`,
  );
  if (pack.public_safe_summary.blocker) lines.push(`- Blocker: ${pack.public_safe_summary.blocker}`);
  lines.push(
    `- Findings: ${pack.public_safe_summary.confirmed_findings} confirmed, ${pack.public_safe_summary.rejected_findings} rejected, ${pack.public_safe_summary.deferred_findings} deferred`,
    `- Review minutes: ${pack.public_safe_summary.review_minutes}`,
    `- Note: ${pack.public_safe_summary.note}`,
    '',
    '## Small-Team Handoff',
    '',
    `- Status: ${pack.small_team_handoff.status}`,
    `- Owner: ${pack.small_team_handoff.owner}`,
    `- Candidate count: ${pack.small_team_handoff.candidate_count}`,
    `- Command: \`${pack.small_team_handoff.command}\``,
    `- Next check: ${pack.small_team_handoff.next_check}`,
    '',
    'Prerequisites:',
    '',
    ...pack.small_team_handoff.prerequisites.map((item) => `- ${item}`),
    '',
  );
  lines.push('## Decision Rubric', '');
  for (const [key, value] of Object.entries(pack.decision_rubric)) {
    lines.push(`- ${key}: ${value}`);
  }
  lines.push('', '## Decision Template', '');
  for (const [key, value] of Object.entries(pack.decision_template)) {
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
  adoptionNextAction,
  adoptionDecisionFromRollup,
  buildAdoptionPack,
  publicSafeSummary,
  renderMarkdown,
  safePilotProjectDir,
  shellQuote,
  smallTeamHandoffPlan,
};
