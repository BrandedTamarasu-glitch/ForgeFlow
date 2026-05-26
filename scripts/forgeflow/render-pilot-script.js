#!/usr/bin/env node
const path = require('path');
const { spawnSync } = require('child_process');

function usage() {
  console.error('Usage: render-pilot-script.js [--runtime claude-code|codex] [--project-name <name>] [--path maintainer|new-user] [--json]');
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
    path: 'maintainer',
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
      if (!['maintainer', 'new-user'].includes(opts.path)) {
        console.error('Invalid --path');
        usage();
        process.exit(2);
      }
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
    console.error('Invalid --runtime');
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

function projectDirSegment(projectName, fallbackName = '') {
  const cleaned = String(projectName || fallbackName || 'project')
    .replace(/[\\/]+/g, '-')
    .replace(/\.\.+/g, '.')
    .replace(/[\x00-\x1f\x7f]/g, '-')
    .trim();
  return (cleaned.replace(/^\.+$/, '') || 'project').slice(0, 120);
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

function installCommands(runtime) {
  return runtime === 'claude-code'
    ? ['/update-forgeflow', '/forgeflow-health', '/forgeflow-version']
    : ['scripts/forgeflow/install-template.js --target codex --json', 'scripts/forgeflow/health-check.js --json', 'scripts/forgeflow/forgeflow-version.js --json'];
}

function evidenceCommand(runtime) {
  return [
    `scripts/forgeflow/record-pilot-evidence.js --runtime ${runtime} --health-result pass --project-type other --adoption-decision repeat-pilot --json`,
  ];
}

function buildMaintainerSteps(runtime) {
  return [
    {
      name: 'Install verification',
      commands: installCommands(runtime),
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
        ...evidenceCommand(runtime),
        'scripts/forgeflow/rollup-pilot-evidence.js --json',
      ],
      evidence: 'Before recording evidence, choose repeat-pilot, expand-small-team, stop-and-fix, or defer. The command shows repeat-pilot as an example only. Public summary uses aggregate counts only.',
    },
  ];
}

function buildNewUserSteps(runtime) {
  return [
    {
      name: 'First-run repair and readiness',
      commands: [
        ...installCommands(runtime),
        'scripts/forgeflow/render-guided-repair.js --json',
        'scripts/forgeflow/render-release-readiness.js --plan-only --json',
        commandFor(runtime, 'smoke'),
      ],
      evidence: 'Forgeflow is installed, visible after restart, guided repair has no unresolved blocker or names the first manual fix, release readiness is only planned/not publishing, and smoke either passes or names the first command to run next.',
    },
    {
      name: 'Project orientation',
      commands: [
        'scripts/forgeflow/show-project-trends.js --refresh --json',
        'scripts/forgeflow/show-code-map.js --json',
        'scripts/forgeflow/show-project-learnings.js --check --json',
        'scripts/forgeflow/build-project-intelligence.js --json',
        'scripts/forgeflow/rollup-agent-feedback.js --json',
      ],
      evidence: 'The user can identify guidance freshness, living project-map categories, topology hotspots, project-intelligence readiness, agent-feedback staleness/correction themes, and whether latest insights are safe to inject into agents.',
    },
    {
      name: 'First real work item',
      commands: [
        runtime === 'claude-code' ? '/discuss' : '$discuss frame the first bounded Forgeflow work item',
        runtime === 'claude-code' ? '/plan' : '$plan produce a phased plan for the first bounded work item',
        runtime === 'claude-code' ? '/implement' : '$implement execute the approved plan',
        commandFor(runtime, 'review'),
      ],
      evidence: 'The first task has a plan, implementation evidence, focused validation, and an approved or explicitly revised review state.',
    },
    {
      name: 'Decide whether to keep using Forgeflow',
      commands: [
        'scripts/forgeflow/render-forgeflow-report.js --refresh --no-drift --json',
        'scripts/forgeflow/build-project-intelligence.js --json',
        ...evidenceCommand(runtime),
        'scripts/forgeflow/rollup-pilot-evidence.js --json',
      ],
      evidence: 'Before recording evidence, choose repeat-pilot, expand-small-team, stop-and-fix, or defer based on setup friction, review usefulness, false positives, validation confidence, project-intelligence readiness, living project-map status, agent-feedback signal, and whether the next task starts with better project guidance.',
    },
  ];
}

function buildPilotScript(opts = {}) {
  const root = repoRoot();
  const projectName = opts.projectName || path.basename(root);
  const runtime = opts.runtime || 'codex';
  const scriptPath = opts.path || 'maintainer';
  const projectDir = `.forgeflow/${projectDirSegment(projectName, path.basename(root))}`;
  const steps = scriptPath === 'new-user'
    ? buildNewUserSteps(runtime)
    : buildMaintainerSteps(runtime);
  return {
    schema_version: '1',
    runtime,
    path: scriptPath,
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
      project_intelligence_readiness: '',
      living_project_map_status: '',
      agent_feedback_signal: '',
      support_categories: '',
      context_budget_status: '',
      adoption_decision: 'repeat-pilot | expand-small-team | stop-and-fix | defer',
      next_action: '',
    },
  };
}

function renderMarkdown(script) {
  const title = script.path === 'new-user'
    ? 'Forgeflow New-User Trial Script'
    : 'Forgeflow Maintainer Pilot Script';
  const lines = [
    `# ${title}`,
    '',
    `Runtime: ${script.runtime}`,
    `Path: ${script.path || 'maintainer'}`,
    `Project: ${script.project_name}`,
    `Local evidence dir: ${script.project_dir}/pilot-evidence/`,
    '',
    script.path === 'new-user'
      ? 'Run this for the first real Forgeflow task. Keep the task small enough that the user can judge setup, guidance, review quality, and whether the next task starts smarter.'
      : 'Run this on one real but bounded branch. Keep raw local artifacts private unless the project explicitly chooses to share them.',
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
  parseArgs,
  projectDirSegment,
  renderMarkdown,
};
