#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { seedBudgetConfig } = require('./seed-budget-config');
const {
  RUNTIME_HELPERS,
  STATIC_FILES,
  isManagedSource,
  manifestEntry,
} = require('./install-manifest');

function usage() {
  console.error('Usage: health-check.js [--root <dir>] [--install-root <dir>] [--fix] [--json]');
}

function parseArgs(argv) {
  const opts = {
    root: '',
    installRoot: '',
    fix: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(argv[++i] || '');
    } else if (arg === '--install-root') {
      opts.installRoot = path.resolve(argv[++i] || '');
    } else if (arg === '--fix') {
      opts.fix = true;
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

  return opts;
}

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) return '';
  return result.stdout.trimEnd();
}

function isGitRepo(cwd = process.cwd()) {
  return git(['rev-parse', '--is-inside-work-tree'], cwd) === 'true';
}

function repoRoot(cwd = process.cwd()) {
  return git(['rev-parse', '--show-toplevel'], cwd) || cwd;
}

function projectName(root) {
  return path.basename(root);
}

function forgeflowDir(root) {
  return path.join(root, '.forgeflow', projectName(root));
}

function gitignorePath(root) {
  return path.join(root, '.gitignore');
}

function hasGitignoreEntry(root) {
  const file = gitignorePath(root);
  if (!fs.existsSync(file)) return false;
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .some((line) => line.trim() === '.forgeflow/');
}

function addGitignoreEntry(root) {
  const file = gitignorePath(root);
  const prior = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const prefix = prior && !prior.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(file, `${prior}${prefix}.forgeflow/\n`);
}

function check(name, ok, fix, detail = {}) {
  return {
    name,
    status: ok ? 'pass' : 'fail',
    fix,
    ...detail,
  };
}

function skip(name, detail = {}) {
  return {
    name,
    status: 'skip',
    ...detail,
  };
}

function safeMkdir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function expectedRuntimeSources() {
  return RUNTIME_HELPERS.filter(isManagedSource).sort();
}

function expectedTemplateSources() {
  return Array.from(STATIC_FILES)
    .filter((source) => source.startsWith('templates/'))
    .sort();
}

function addInstallChecks(checks, installRoot) {
  if (!installRoot) return;
  for (const source of expectedTemplateSources()) {
    const entry = manifestEntry(source, installRoot);
    if (!entry) continue;
    checks.push(check(`template ${path.basename(source)}`, fs.existsSync(entry.destination), `run update-forgeflow to install ${source}`, {
      path: entry.destination,
    }));
  }
  for (const source of expectedRuntimeSources()) {
    const entry = manifestEntry(source, installRoot);
    if (!entry) continue;
    const exists = fs.existsSync(entry.destination);
    const executable = exists ? ((fs.statSync(entry.destination).mode & 0o111) !== 0) : false;
    checks.push(check(`runtime helper ${path.basename(source)}`, exists && executable, `run update-forgeflow to install ${source}`, {
      path: entry.destination,
    }));
  }
}

function latestImplementationNotesCheck(ffDir) {
  const file = path.join(ffDir, 'ship', 'implementation-notes-check.json');
  if (!fs.existsSync(file)) {
    return {
      status: 'missing',
      path: file,
      issues: 0,
      failures: 0,
      warnings: 0,
    };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    const issues = Array.isArray(parsed.issues) ? parsed.issues : [];
    return {
      status: parsed.status || 'unknown',
      path: file,
      issues: issues.length,
      failures: issues.filter((item) => item.severity === 'fail').length,
      warnings: issues.filter((item) => item.severity === 'warn').length,
    };
  } catch (_err) {
    return {
      status: 'invalid',
      path: file,
      issues: 0,
      failures: 0,
      warnings: 0,
    };
  }
}

function latestPilotRollup(ffDir) {
  const file = path.join(ffDir, 'pilot-evidence-rollup.md');
  if (!fs.existsSync(file)) {
    return {
      status: 'missing',
      path: file,
      pilot_count: 0,
      decision: '',
      next_fix_layer: '',
    };
  }
  const content = fs.readFileSync(file, 'utf8');
  const pilotCount = Number.parseInt((content.match(/^Pilot count:\s*(\d+)/m) || [])[1] || '0', 10);
  return {
    status: 'present',
    path: file,
    pilot_count: Number.isFinite(pilotCount) ? pilotCount : 0,
    decision: (content.match(/^Decision:\s*(.+)$/m) || [])[1] || '',
    next_fix_layer: (content.match(/^Next fix layer:\s*(.+)$/m) || [])[1] || '',
  };
}

function sectionLines(content, heading) {
  const lines = String(content || '').split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) return [];
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break;
    body.push(line);
  }
  return body;
}

function countBulletsInSection(content, heading) {
  return sectionLines(content, heading).filter((line) => /^-\s+/.test(line.trim())).length;
}

function firstBulletInSection(content, heading) {
  const bullet = sectionLines(content, heading).map((line) => line.trim()).find((line) => /^-\s+/.test(line));
  return bullet ? bullet.replace(/^-\s+/, '') : '';
}

function latestProjectLearnings(ffDir) {
  const file = path.join(ffDir, 'project-learnings.md');
  if (!fs.existsSync(file)) {
    return {
      status: 'missing',
      path: file,
      recurring_pitfalls: 0,
      risk_areas: 0,
      recommended_approach: '',
    };
  }
  const content = fs.readFileSync(file, 'utf8');
  return {
    status: 'present',
    path: file,
    recurring_pitfalls: countBulletsInSection(content, 'Recurring Pitfalls'),
    risk_areas: countBulletsInSection(content, 'Risk Areas'),
    recommended_approach: firstBulletInSection(content, 'Recommended Approach For Next Work'),
  };
}

function runHealthCheck(opts = {}) {
  const requestedRoot = opts.root || process.cwd();
  const gitRepo = isGitRepo(requestedRoot);
  const root = opts.root ? path.resolve(opts.root) : repoRoot(requestedRoot);
  const ffDir = forgeflowDir(root);
  const notesDir = path.join(ffDir, 'agent-notes');
  const budgetPath = path.join(root, '.forgeflow-budget.json');
  const checks = [];
  const changes = [];

  if (!gitRepo) {
    checks.push(skip('project-local .forgeflow/', {
      reason: `${requestedRoot} is not inside a git worktree`,
      fix: 'cd into a git project, then rerun health-check.js',
    }));
  } else {
    if (opts.fix && !fs.existsSync(ffDir)) {
      safeMkdir(ffDir);
      changes.push({ path: ffDir, action: 'created-dir' });
    }
    checks.push(check('project forgeflow dir', fs.existsSync(ffDir), 'create .forgeflow/<project>/'));

    if (opts.fix && !fs.existsSync(notesDir)) {
      safeMkdir(notesDir);
      changes.push({ path: notesDir, action: 'created-dir' });
    }
    checks.push(check('agent notes dir', fs.existsSync(notesDir), 'create agent-notes dir'));

    if (opts.fix && !hasGitignoreEntry(root)) {
      addGitignoreEntry(root);
      changes.push({ path: gitignorePath(root), action: 'added .forgeflow/' });
    }
    checks.push(check('gitignore .forgeflow/', hasGitignoreEntry(root), 'add .forgeflow/ to .gitignore'));

    if (opts.fix && !fs.existsSync(budgetPath)) {
      const seeded = seedBudgetConfig({ root, out: budgetPath });
      if (seeded.written) changes.push({ path: budgetPath, action: 'seeded budget config' });
    }
    checks.push(check('budget config', fs.existsSync(budgetPath), 'run seed-budget-config.js'));
  }
  addInstallChecks(checks, opts.installRoot);

  const failures = checks.filter((item) => item.status === 'fail');
  return {
    schema_version: '1',
    root,
    project: projectName(root),
    git_repo: gitRepo,
    status: failures.length === 0 ? 'pass' : 'fail',
    checks,
    changes,
    latest_notes_check: latestImplementationNotesCheck(ffDir),
    latest_pilot_rollup: latestPilotRollup(ffDir),
    latest_project_learnings: latestProjectLearnings(ffDir),
  };
}

function renderMarkdown(result) {
  const lines = [
    `# Forgeflow Health: ${result.status.toUpperCase()}`,
    '',
    `Project: ${result.project}`,
    `Root: ${result.root}`,
    '',
  ];
  const failures = result.checks.filter((item) => item.status === 'fail');
  if (failures.length > 0) {
    lines.push('## Failures', '');
    for (const item of failures) {
      lines.push(`- ${item.name}: ${item.fix}`);
    }
    lines.push('');
  }
  if (result.changes.length > 0) {
    lines.push('## Changes', '');
    for (const item of result.changes) {
      lines.push(`- ${item.action}: ${item.path}`);
    }
    lines.push('');
  }
  if (result.latest_notes_check && result.latest_notes_check.status !== 'missing') {
    const latest = result.latest_notes_check;
    lines.push('## Latest Implementation Notes Check', '');
    lines.push(`- Status: ${latest.status}`);
    lines.push(`- Issues: ${latest.issues} (${latest.failures} fail, ${latest.warnings} warn)`);
    lines.push(`- Report: ${latest.path}`);
    lines.push('');
  }
  if (result.latest_pilot_rollup && result.latest_pilot_rollup.status !== 'missing') {
    const latest = result.latest_pilot_rollup;
    lines.push('## Latest Pilot Evidence Rollup', '');
    lines.push(`- Pilot count: ${latest.pilot_count}`);
    if (latest.decision) lines.push(`- Decision: ${latest.decision}`);
    if (latest.next_fix_layer) lines.push(`- Next fix layer: ${latest.next_fix_layer}`);
    lines.push(`- Report: ${latest.path}`);
    lines.push('');
  }
  if (result.latest_project_learnings && result.latest_project_learnings.status !== 'missing') {
    const latest = result.latest_project_learnings;
    lines.push('## Latest Project Learnings', '');
    lines.push(`- Recurring pitfalls: ${latest.recurring_pitfalls}`);
    lines.push(`- Risk areas: ${latest.risk_areas}`);
    if (latest.recommended_approach) lines.push(`- Recommended approach: ${latest.recommended_approach}`);
    lines.push(`- Report: ${latest.path}`);
    lines.push('');
  }
  lines.push('## Checks', '');
  for (const item of result.checks) {
    const suffix = item.reason ? ` (${item.reason})` : '';
    lines.push(`- ${item.status.toUpperCase()}: ${item.name}${suffix}`);
  }
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = runHealthCheck(opts);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    console.log(renderMarkdown(result));
  }
  if (result.status === 'fail') process.exit(1);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = {
  hasGitignoreEntry,
  isGitRepo,
  renderMarkdown,
  runHealthCheck,
  expectedRuntimeSources,
  expectedTemplateSources,
  latestImplementationNotesCheck,
  latestPilotRollup,
  latestProjectLearnings,
};
