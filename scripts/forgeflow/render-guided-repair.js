#!/usr/bin/env node
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { runHealthCheck } = require('./health-check');
const { getVersionStatus } = require('./forgeflow-version');
const { RUNTIME_HELPERS, manifestEntry } = require('./install-manifest');
const { assertSafeDirectory } = require('./file-safety');
const { buildRollup, readRecords } = require('./rollup-first-run-results');

function usage() {
  console.error('Usage: render-guided-repair.js [--root <dir>] [--install-root <dir>] [--home <dir>] [--no-live-install] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = {
    root: process.cwd(),
    installRoot: '',
    home: '',
    liveInstall: true,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--install-root') {
      opts.installRoot = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--home') {
      opts.home = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--no-live-install') {
      opts.liveInstall = false;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function addStep(steps, severity, title, command, reason, clears, actionType = 'command') {
  if (!title) return;
  if (steps.some((step) => step.title === title && step.command === command)) return;
  steps.push({ severity, title, action_type: actionType, command, reason, clears });
}

function mergeStepReason(steps, command, reason) {
  const step = steps.find((item) => item.command === command && item.severity === 'fail');
  if (!step || !reason) return false;
  if (!String(step.reason || '').includes(reason)) {
    step.reason = `${step.reason || 'Repair required.'} ${reason}`;
  }
  return true;
}

function severityRank(value) {
  return { ok: 0, info: 0, warn: 1, fail: 2 }[value] ?? 1;
}

function summarizeStatus(version, health) {
  if (version.status === 'corrupt-version' || health.status === 'fail') return 'fail';
  if (['repair-needed', 'outdated', 'not-installed', 'installed-unknown-upstream'].includes(version.status) || health.recommendations.length > 0) return 'warn';
  return 'pass';
}

function syntaxCheckEnv() {
  const env = { ...process.env };
  delete env.NODE_OPTIONS;
  delete env.NODE_PATH;
  return env;
}

function verifyInstalledRuntime(installRoot) {
  const helperRoot = path.join(installRoot, 'forgeflow', 'scripts', 'forgeflow');
  try {
    assertSafeDirectory(helperRoot);
  } catch (err) {
    return {
      status: 'fail',
      helper_root: helperRoot,
      checked: 0,
      failures: [{
        name: 'helper-root',
        source: 'scripts/forgeflow/',
        status: 'fail',
        path: helperRoot,
        reason: err.message,
      }],
      checks: [],
    };
  }
  const cleanEnv = syntaxCheckEnv();
  const checks = RUNTIME_HELPERS.map((source) => {
    const entry = manifestEntry(source, installRoot);
    const helper = path.basename(source);
    const file = entry ? entry.destination : path.join(helperRoot, helper);
    if (!fs.existsSync(file)) {
      return {
        name: helper,
        source,
        status: 'fail',
        path: file,
        reason: 'installed helper is missing',
      };
    }
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return {
        name: helper,
        source,
        status: 'fail',
        path: file,
        reason: 'installed helper is not a regular file',
      };
    }
    const result = source.endsWith('.sh')
      ? spawnSync('bash', ['-n', file], { encoding: 'utf8', env: cleanEnv })
      : spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', env: cleanEnv });
    if (result.status !== 0) {
      return {
        name: helper,
        source,
        status: 'fail',
        path: file,
        reason: (result.stderr || result.stdout || 'installed helper failed syntax check').trim(),
      };
    }
    return {
      name: helper,
      source,
      status: 'pass',
      path: file,
      reason: '',
    };
  });
  const failed = checks.filter((check) => check.status === 'fail');
  return {
    status: failed.length > 0 ? 'fail' : 'pass',
    helper_root: helperRoot,
    checked: checks.length,
    failures: failed,
    checks,
  };
}

function summarizeOverallStatus(version, health, installedRuntime) {
  if (installedRuntime && installedRuntime.status === 'fail') return 'fail';
  return summarizeStatus(version, health);
}

function firstRunRepairState(root) {
  const projectDir = path.join(root, '.forgeflow', path.basename(root));
  const rollup = buildRollup(readRecords(projectDir));
  return {
    status: rollup.records > 0 ? 'present' : 'missing',
    project_dir: projectDir,
    records: rollup.records,
    invalid_records: rollup.invalid_records,
    recommendation: rollup.recommendation,
  };
}

async function buildGuidedRepair(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const home = path.resolve(opts.home || path.join(os.homedir(), '.claude'));
  const installRoot = path.resolve(opts.installRoot || home);
  const version = await getVersionStatus({
    home,
    offline: true,
  });
  const health = runHealthCheck({
    root,
    installRoot,
  });
  const installedRuntime = opts.liveInstall === false ? {
    status: 'skipped',
    helper_root: path.join(installRoot, 'forgeflow', 'scripts', 'forgeflow'),
    checked: 0,
    failures: [],
    checks: [],
  } : verifyInstalledRuntime(installRoot);
  const firstRun = firstRunRepairState(root);
  const steps = [];

  if (version.status === 'repair-needed') {
    addStep(steps, 'fail', 'Repair missing managed files', '/update-forgeflow --repair', version.help || version.action, 'All managed commands, agents, hooks, templates, and runtime helpers are present.');
  } else if (version.status === 'outdated') {
    addStep(steps, 'warn', 'Update Forgeflow', '/update-forgeflow', 'Installed version does not match upstream main.', 'Installed version matches upstream main.');
  } else if (version.status === 'not-installed') {
    addStep(steps, 'fail', 'Install Forgeflow', '/update-forgeflow', 'Forgeflow version file is missing.', 'Forgeflow is installed and versioned.');
  } else if (version.status === 'corrupt-version') {
    addStep(steps, 'fail', 'Repair corrupt version file', version.action, 'The installed version file is not a valid SHA.', 'Version status is present or installed-offline.');
  } else if (version.status === 'installed-unknown-upstream') {
    addStep(steps, 'warn', 'Check version online', '/forgeflow-version', 'Offline repair planner could not compare upstream.', 'Version helper can compare upstream status.');
  }

  const healthFailures = (health.checks || []).filter((check) => check.status === 'fail');
  const installFailures = healthFailures.filter((check) => check.fix && check.fix.includes('update-forgeflow'));
  const localFailures = healthFailures.filter((check) => !(check.fix && check.fix.includes('update-forgeflow')));
  if (installFailures.length > 0) {
    addStep(
      steps,
      'fail',
      'Repair missing managed files',
      '/update-forgeflow --repair',
      `${installFailures.length} managed install check(s) failed.`,
      'Rerun /forgeflow-health and confirm installed managed files pass.',
    );
  }
  for (const check of localFailures) {
    addStep(steps, 'fail', `Fix health check: ${check.name}`, '/forgeflow-health --fix', check.reason || check.fix || 'Health check failed.', 'Rerun /forgeflow-health and confirm this check passes.');
  }
  for (const rec of health.recommendations || []) {
    addStep(steps, rec.severity === 'fail' ? 'fail' : 'warn', rec.action || 'Health recommendation', rec.command || '/forgeflow-health', rec.reason || rec.evidence || 'Health recommendation is active.', rec.clears || 'Rerun /forgeflow-health.');
  }

  if (installedRuntime.status === 'fail') {
    const reason = `${installedRuntime.failures.length} installed runtime helper check(s) failed.`;
    if (!mergeStepReason(steps, '/update-forgeflow --repair', reason)) {
      addStep(
        steps,
        'fail',
        'Repair installed runtime helpers',
        '/update-forgeflow --repair',
        reason,
        'Installed runtime helpers exist and pass syntax verification.',
      );
    }
  }

  if (firstRun.records > 0 && firstRun.recommendation !== 'continue-bounded-trials') {
    const command = firstRun.recommendation === 'fix-failing-first-run-checks'
      ? '/forgeflow-health && /forgeflow-smoke'
      : '/forgeflow-first-run-rollup';
    addStep(
      steps,
      'warn',
      'Resolve first-run friction',
      command,
      `First-run evidence recommends ${firstRun.recommendation}.`,
      'Record a follow-up first-run result after the repair and confirm the rollup recommendation improves.',
    );
  }

  addStep(steps, 'info', 'Run downstream smoke after repairs', '/forgeflow-smoke', 'Smoke can refresh project-local readiness artifacts, so guided repair leaves it as an explicit follow-up.', 'Downstream smoke passes.');
  addStep(steps, 'info', 'Verify health after repairs', '/forgeflow-health', 'Confirm installed files, hooks, project-local state, and settings wiring after applying repair steps.', 'Health passes without failures.');
  addStep(
    steps,
    'info',
    'Manual settings check',
    'Open ~/.claude/settings.json and set statusLine.command to node "$HOME/.claude/hooks/forgeflow-statusline.js" if /forgeflow-health reports statusline wiring issues. Apply hook wiring changes only when /forgeflow-health reports them.',
    'Forgeflow never auto-edits settings.json.',
    'Health no longer reports manual settings issues.',
    'manual',
  );
  addStep(
    steps,
    'info',
    'Restart the client session',
    'Restart Claude Code or start a new Codex session after update, repair, or settings changes so commands and hooks reload.',
    'Command and hook changes may not load in the current session until the client restarts.',
    'The next session sees the repaired commands and hooks.',
    'manual',
  );

  steps.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    home,
    install_root: installRoot,
    status: summarizeOverallStatus(version, health, installedRuntime),
    version_status: version.status,
    health_status: health.status,
    installed_runtime_status: installedRuntime.status,
    installed_runtime: installedRuntime,
    first_run_status: firstRun.status,
    first_run: firstRun,
    smoke_status: 'not-run',
    steps,
    boundary: 'Guided repair is advisory and non-mutating. Run commands explicitly; settings.json changes remain manual.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Guided Repair',
    '',
    `Status: ${result.status}`,
    `Version: ${result.version_status}`,
    `Health: ${result.health_status}`,
    `Installed runtime: ${result.installed_runtime_status}`,
    `First-run evidence: ${result.first_run_status}`,
    `Smoke: ${result.smoke_status}`,
    '',
    result.boundary,
    '',
    '## Repair Plan',
    '',
  ];
  for (const [index, step] of result.steps.entries()) {
    lines.push(`${index + 1}. ${step.title}`);
    lines.push(`   - Severity: ${step.severity}`);
    if (step.command) lines.push(`   - ${step.action_type === 'manual' ? 'Action' : 'Command'}: ${step.command}`);
    if (step.reason) lines.push(`   - Reason: ${step.reason}`);
    if (step.clears) lines.push(`   - Clears: ${step.clears}`);
  }
  if (result.steps.length === 0) lines.push('- No repair steps needed.');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = await buildGuidedRepair(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
  } catch (err) {
    console.error(err.message);
    usage();
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  buildGuidedRepair,
  parseArgs,
  renderMarkdown,
};
