#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { firstUsePathForRuntime } = require('./render-first-useful-win');
const { smokeCheck } = require('./smoke-check');

function usage() {
  console.error('Usage: render-first-run-simulator.js [--root <repo>] [--project-dir <dir>] [--runtime claude-code|codex] [--skip-smoke] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', runtime: 'claude-code', skipSmoke: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--runtime') {
      opts.runtime = requireValue(argv, arg, i);
      if (!['claude-code', 'codex'].includes(opts.runtime)) throw new Error('Invalid --runtime. Expected claude-code or codex.');
      i += 1;
    } else if (arg === '--skip-smoke') {
      opts.skipSmoke = true;
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

function defaultProjectDir(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function pluginVersion(root) {
  const pluginPaths = [
    path.join(root, '.claude-plugin', 'plugin.json'),
    path.join(root, '.codex-plugin', 'plugin.json'),
  ];
  for (const pluginPath of pluginPaths) {
    if (!fs.existsSync(pluginPath)) continue;
    try {
      const plugin = JSON.parse(fs.readFileSync(pluginPath, 'utf8'));
      if (plugin.version) return String(plugin.version);
    } catch (_err) {
      // Keep looking for another supported plugin manifest.
    }
  }
  return '';
}

function semverLike(version) {
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version);
}

function checkStatusRank(status) {
  return { pass: 0, info: 0, skip: 0, warn: 1, attention: 1, fail: 2 }[status] ?? 2;
}

function overallStatus(checks) {
  const max = checks.reduce((value, item) => Math.max(value, checkStatusRank(item.status)), 0);
  if (max >= 2) return 'attention';
  if (max >= 1) return 'attention';
  return 'ready';
}

function buildTrialPlan(runtime, firstUsePath) {
  return {
    status: 'ready',
    runtime,
    steps: firstUsePath.steps.map((step, index) => ({
      order: index + 1,
      name: step.name,
      command: step.command,
    })),
    record_after: {
      command_template: '/forgeflow-first-run-result --runtime <claude-code|codex> --health <pass|warn|fail> --smoke <pass|warn|fail> --decision <continue|fix-first|stop-and-fix|defer>',
      prompt: 'After the trial, replace placeholders with real observed statuses. Do not infer or guess pass/warn/fail values.',
    },
    summarize_after: runtime === 'codex'
      ? 'node scripts/forgeflow/render-first-useful-win.js --runtime codex'
      : '/forgeflow-first-useful-win',
  };
}

function buildFollowUp(checks, runtime, firstUsePath) {
  const attention = checks.find((item) => item.status !== 'pass' && item.status !== 'info');
  if (attention) {
    return {
      status: 'blocked',
      next: attention.next,
      reason: attention.summary,
      record_result: false,
      trial_plan: buildTrialPlan(runtime, firstUsePath),
    };
  }
  return {
    status: 'ready-to-trial',
    next: firstUsePath.steps[0].command,
    reason: 'Run the first-use path, then record the actual first-run outcome.',
    record_result: true,
    trial_plan: buildTrialPlan(runtime, firstUsePath),
  };
}

function buildFirstRunSimulator(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const runtime = ['claude-code', 'codex'].includes(opts.runtime) ? opts.runtime : 'claude-code';
  const firstUsePath = firstUsePathForRuntime(runtime);
  const version = pluginVersion(root);
  const smoke = opts.smoke || (opts.skipSmoke
    ? { status: 'skip', checks: [], mode: 'source' }
    : smokeCheck({ root, projectDir, mode: 'source' }));
  const checks = [
    {
      name: 'release-version',
      status: semverLike(version) ? 'pass' : 'attention',
      summary: version ? `Plugin version ${version} is available.` : 'Plugin version is missing.',
      next: version ? '' : '/forgeflow-release-readiness',
    },
    {
      name: 'first-use-path',
      status: firstUsePath.steps.length > 0 ? 'pass' : 'attention',
      summary: `${runtime} first-use path has ${firstUsePath.steps.length} step(s).`,
      next: firstUsePath.steps[0] ? firstUsePath.steps[0].command : '/forgeflow-first-run',
    },
    {
      name: 'source-smoke',
      status: smoke.status === 'pass' ? 'pass' : (smoke.status === 'skip' ? 'info' : 'attention'),
      summary: opts.skipSmoke ? 'Source smoke check skipped by request.' : `Source smoke status is ${smoke.status}.`,
      next: smoke.status === 'pass' || smoke.status === 'skip' ? '' : '/forgeflow-smoke --mode source',
    },
  ];
  const attention = checks.find((item) => item.status !== 'pass' && item.status !== 'info');
  const followUp = buildFollowUp(checks, runtime, firstUsePath);
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    project_dir: projectDir,
    runtime,
    status: overallStatus(checks),
    version,
    checks,
    smoke_summary: {
      status: smoke.status,
      mode: smoke.mode || 'source',
      checks: Array.isArray(smoke.checks) ? smoke.checks.length : 0,
    },
    first_use_path: firstUsePath,
    follow_up: followUp,
    trial_plan: followUp.trial_plan,
    next: attention ? attention.next : firstUsePath.steps[0].command,
    next_reason: attention ? attention.summary : 'First-run simulator is ready; start the runtime-specific first-use path.',
    boundary: 'First-run simulator is local and read-only. It checks source readiness and first-use guidance without installing, updating, repairing, committing, pushing, or exporting evidence.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow First-Run Simulator',
    '',
    `Status: ${result.status}`,
    `Runtime: ${result.runtime}`,
    `Version: ${result.version || '(missing)'}`,
    '',
    result.boundary,
    '',
    '## Checks',
    '',
  ];
  for (const item of result.checks) {
    lines.push(`- ${item.name}: ${item.status}`);
    lines.push(`  - Summary: ${item.summary}`);
    if (item.next) lines.push(`  - Next: ${item.next}`);
  }
  lines.push('', '## First-Use Path', '');
  for (const step of result.first_use_path.steps) {
    lines.push(`- ${step.name}: ${step.command}`);
  }
  lines.push('', '## Follow-Up', '');
  lines.push(`- Status: ${result.follow_up.status}`);
  lines.push(`- Record result: ${result.follow_up.record_result ? 'yes' : 'no'}`);
  lines.push(`- Record template: ${result.follow_up.trial_plan.record_after.command_template}`);
  lines.push(`- Prompt: ${result.follow_up.trial_plan.record_after.prompt}`);
  lines.push(`- Stop rule: ${result.first_use_path.stop_rule}`, '', `Next: ${result.next}`, `Why: ${result.next_reason}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildFirstRunSimulator(opts);
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

module.exports = { buildFirstRunSimulator, buildFollowUp, buildTrialPlan, parseArgs, pluginVersion, renderMarkdown, semverLike };
