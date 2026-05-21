#!/usr/bin/env node
const path = require('path');
const { spawnSync } = require('child_process');

function usage() {
  console.error('Usage: render-pilot-script.js [--runtime claude-code|codex] [--project-name <name>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) {
    console.error(`Missing value for ${name}`);
    usage();
    process.exit(2);
  }
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
      console.error(`Unknown argument: ${arg}`);
      usage();
      process.exit(2);
    }
  }
  if (!['claude-code', 'codex'].includes(opts.runtime)) {
    console.error(`Invalid --runtime: ${opts.runtime}`);
    usage();
    process.exit(2);
  }
  return opts;
}

function git(args, cwd = process.cwd()) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) return '';
  return result.stdout.trimEnd();
}

function repoRoot(cwd = process.cwd()) {
  return git(['rev-parse', '--show-toplevel'], cwd) || cwd;
}

function commandFor(runtime, name) {
  if (runtime === 'claude-code') {
    return {
      review: '/review',
      ship: '/ship',
      smoke: '/forgeflow-smoke',
    }[name];
  }
  return {
    review: '$forge-review review the current changes',
    ship: '$ship prepare the branch',
    smoke: 'scripts/forgeflow/smoke-check.js --json',
  }[name];
}

function buildPilotScript(opts = {}) {
  const root = repoRoot();
  const projectName = opts.projectName || path.basename(root);
  const runtime = opts.runtime || 'codex';
  const projectDir = `.forgeflow/${projectName}`;
  const steps = [
    {
      name: 'Install verification',
      commands: runtime === 'claude-code'
        ? ['/update-forgeflow', '/forgeflow-health', '/forgeflow-version']
        : ['scripts/forgeflow/install-template.js --target codex --json', 'scripts/forgeflow/health-check.js --json', 'scripts/forgeflow/forgeflow-version.js --json'],
      evidence: 'Install/update completed, health passed or reported one manual settings fix, version is up to date or intentionally offline.',
    },
    {
      name: 'Baseline smoke',
      commands: [
        commandFor(runtime, 'smoke'),
        'scripts/forgeflow/show-project-trends.js --refresh --json',
        'scripts/forgeflow/render-forgeflow-report.js --refresh --no-drift --json',
        'scripts/forgeflow/show-code-map.js --json',
      ],
      evidence: 'Latest insights are current, report has no stale-guidance recommendation, remaining warnings name a follow-up command.',
    },
    {
      name: 'One bounded work item',
      commands: [
        runtime === 'claude-code' ? '/consult' : '$consult produce an implementation brief',
        runtime === 'claude-code' ? '/implement' : '$implement execute the brief',
        commandFor(runtime, 'review'),
      ],
      evidence: 'Capture accepted, rejected, and deferred findings after maintainer triage. Do not treat agent output as proof without current file/test evidence.',
    },
    {
      name: 'Final report and evidence',
      commands: [
        commandFor(runtime, 'ship'),
        'scripts/forgeflow/render-forgeflow-report.js --refresh --no-drift --json',
        `scripts/forgeflow/record-pilot-evidence.js --runtime ${runtime} --health-result pass --project-type other --adoption-decision repeat-pilot --json`,
        'scripts/forgeflow/rollup-pilot-evidence.js --json',
      ],
      evidence: 'Rollup decision says repeat, expand-small-team, fix-now, or defer. Public summary uses aggregate counts only.',
    },
  ];
  return {
    schema_version: '1',
    runtime,
    project_name: projectName,
    project_dir: projectDir,
    steps,
    public_safe_template: {
      project_type: '',
      runtime,
      branch_shape: '',
      health_result: 'pass | warn | fail',
      review_mode: '',
      confirmed_findings: '',
      rejected_findings: '',
      deferred_findings: '',
      review_minutes: '',
      setup_friction: '',
      support_categories: '',
      context_budget_status: '',
      adoption_decision: 'repeat-pilot | expand-small-team | stop-and-fix | defer',
      next_action: '',
    },
  };
}

function renderMarkdown(script) {
  const lines = [
    '# Forgeflow Maintainer Pilot Script',
    '',
    `Runtime: ${script.runtime}`,
    `Project: ${script.project_name}`,
    `Local evidence dir: ${script.project_dir}/pilot-evidence/`,
    '',
    'Run this on one real but bounded branch. Keep raw local artifacts private unless the project explicitly chooses to share them.',
    '',
  ];
  for (const [index, step] of script.steps.entries()) {
    lines.push(`## ${index + 1}. ${step.name}`, '', 'Commands:', '');
    for (const command of step.commands) lines.push(`- \`${command}\``);
    lines.push('', `Evidence to capture: ${step.evidence}`, '');
  }
  lines.push('## Public-Safe Result Template', '', '```yaml');
  for (const [key, value] of Object.entries(script.public_safe_template)) {
    lines.push(`${key}: ${value}`);
  }
  lines.push('```', '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const script = buildPilotScript(opts);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(script, null, 2)}\n`);
  } else {
    process.stdout.write(renderMarkdown(script));
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildPilotScript,
  renderMarkdown,
};
