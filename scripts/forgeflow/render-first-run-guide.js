#!/usr/bin/env node
const path = require('path');

function usage() {
  console.error('Usage: render-first-run-guide.js [--runtime claude-code|codex] [--project-name <name>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = {
    runtime: 'codex',
    projectName: '',
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
  return opts;
}

function buildFirstRunGuide(opts = {}) {
  const runtime = opts.runtime || 'codex';
  const projectRoot = opts.root || process.cwd();
  const projectName = opts.projectName || path.basename(projectRoot);
  const commandPrefix = runtime === 'claude-code' ? '/' : 'scripts/forgeflow/';
  return {
    schema_version: '1',
    runtime,
    project_name: projectName,
    objective: 'Verify Forgeflow is installed, inspect project guidance, record user preferences, then run one bounded work item.',
    steps: [
      {
        name: 'Verify install health',
        commands: runtime === 'claude-code'
          ? ['/forgeflow-health', '/forgeflow-smoke']
          : ['scripts/forgeflow/health-check.js --json', 'scripts/forgeflow/smoke-check.js --json'],
        success: 'Health and smoke produce pass or actionable warn/fail output with a clearing command.',
      },
      {
        name: 'Orient to the project',
        commands: [
          `${commandPrefix}${runtime === 'claude-code' ? 'forgeflow-trends --refresh' : 'show-project-trends.js --refresh'}`,
          `${commandPrefix}${runtime === 'claude-code' ? 'forgeflow-code-map' : 'show-code-map.js'}`,
          `${commandPrefix}${runtime === 'claude-code' ? 'forgeflow-health-timeline' : 'show-project-health-timeline.js'}`,
          `${commandPrefix}${runtime === 'claude-code' ? 'forgeflow-profile --check' : 'check-user-profile.js'}`,
        ],
        success: 'The user can see freshness, hotspots, project-map evolution, profile readiness, and any warnings before work starts.',
      },
      {
        name: 'Inspect agent insight injection',
        commands: [
          `${commandPrefix}${runtime === 'claude-code' ? 'forgeflow-insight-injection' : 'render-insight-injection.js'}`,
          `${commandPrefix}${runtime === 'claude-code' ? 'forgeflow-context-contract' : 'check-context-contract.js'}`,
        ],
        success: 'The user can see which insight blocks will be included, metadata-only, or skipped before agent-heavy work.',
      },
      {
        name: 'Record preferences intentionally',
        commands: [
          `${commandPrefix}${runtime === 'claude-code' ? 'forgeflow-profile' : 'show-user-profile.js'}`,
          `${commandPrefix}${runtime === 'claude-code' ? 'forgeflow-profile --record --scope global --category communication --preference "Keep progress updates concise and include validation status."' : 'record-user-profile.js --scope global --category communication --preference "Keep progress updates concise and include validation status."'}`,
        ],
        success: 'Any profile update is explicit, local, advisory, uses real user wording, and does not contain secrets or project-private details in the global profile.',
      },
      {
        name: 'Run one bounded work item',
        commands: runtime === 'claude-code'
          ? ['/discuss', '/plan', '/implement', '/review']
          : ['$discuss', '$plan', '$implement', '$forge-review'],
        success: 'The work item finishes with tests, review outcome, implementation notes, and a clear next action.',
      },
      {
        name: 'Capture the first failed validation if one happens',
        commands: runtime === 'claude-code'
          ? ['/forgeflow-validation-failure-capture --command "<failed validation command>"']
          : ['scripts/forgeflow/render-validation-failure-capture.js --command "<failed validation command>"'],
        success: 'The helper returns one capture-ready failure-digest action, or says exact raw output is required for correctness-critical commands.',
      },
    ],
    stop_conditions: [
      'Health or smoke reports a fail without a safe clearing action.',
      'A failed command produces raw-required output such as a diff, patch, hash, or exact file list that should not be compacted.',
      'Profile guidance conflicts with security, accessibility, validation evidence, or current instructions.',
      'The first work item is too broad to validate in one safe slice.',
    ],
  };
}

function renderMarkdown(guide) {
  const lines = [
    '# Forgeflow First-Run Guide',
    '',
    `Runtime: ${guide.runtime}`,
    `Project: ${guide.project_name}`,
    '',
    guide.objective,
    '',
  ];
  for (const [index, step] of guide.steps.entries()) {
    lines.push(`## ${index + 1}. ${step.name}`, '', 'Commands:', '');
    for (const command of step.commands) lines.push(`- \`${command}\``);
    lines.push('', `Success: ${step.success}`, '');
  }
  lines.push('## Stop Conditions', '');
  for (const condition of guide.stop_conditions) lines.push(`- ${condition}`);
  lines.push('');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const guide = buildFirstRunGuide(opts);
  process.stdout.write(opts.json ? `${JSON.stringify(guide, null, 2)}\n` : renderMarkdown(guide));
}

if (require.main === module) {
  main();
}

module.exports = {
  buildFirstRunGuide,
  parseArgs,
  renderMarkdown,
};
