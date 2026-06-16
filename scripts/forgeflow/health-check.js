#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { seedBudgetConfig } = require('./seed-budget-config');
const { checkProjectLearnings } = require('./check-project-learnings');
const { assertSafeDirectory, safeReadTextFile, writeFileSafe } = require('./file-safety');
const { classifyFailureDigest } = require('./failure-digest-triage');
const {
  inspectLearningGate,
  inspectProjectLearnings,
  refreshFailureDigest,
  refreshProjectTrends,
  renderRecommendationList,
  uniqueRecommendations,
} = require('./guidance-contract');
const {
  latestInsightsFreshness,
  latestInsightsReadiness: readLatestInsightsReadiness,
} = require('./latest-insights-state');
const { failureDigestFreshness, latestFailureDigest } = require('./show-project-trends');
const {
  expectedInstallSources,
  expectedRuntimeSources,
  expectedTemplateSources,
} = require('./runtime-inventory');
const {
  manifestEntry,
} = require('./install-manifest');

function usage() {
  console.error('Usage: health-check.js [--root <dir>] [--install-root <dir>] [--fix] [--verbose] [--json]');
}

function parseArgs(argv) {
  const opts = {
    root: '',
    installRoot: '',
    fix: false,
    verbose: false,
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
    } else if (arg === '--verbose') {
      opts.verbose = true;
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
  const state = gitignoreState(root);
  if (!state.safe) return false;
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .some((line) => line.trim() === '.forgeflow/');
}

function addGitignoreEntry(root) {
  const file = gitignorePath(root);
  const state = gitignoreState(root);
  if (!state.safe) {
    throw new Error(`Refusing to update unsafe .gitignore: ${state.reason}`);
  }
  const prior = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const prefix = prior && !prior.endsWith('\n') ? '\n' : '';
  writeFileSafe(file, `${prior}${prefix}.forgeflow/\n`);
}

function gitignoreState(root) {
  const file = gitignorePath(root);
  if (!fs.existsSync(file)) {
    return { path: file, exists: false, safe: true, reason: '' };
  }
  try {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) {
      return { path: file, exists: true, safe: false, reason: '.gitignore is a symlink' };
    }
    if (!stat.isFile()) {
      return { path: file, exists: true, safe: false, reason: '.gitignore is not a regular file' };
    }
  } catch (err) {
    return { path: file, exists: true, safe: false, reason: err.message };
  }
  return { path: file, exists: true, safe: true, reason: '' };
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
  assertSafeDirectory(dir);
  fs.mkdirSync(dir, { recursive: true });
}

function addInstallChecks(checks, installRoot) {
  if (!installRoot) return;
  for (const source of expectedInstallSources()) {
    const entry = manifestEntry(source, installRoot);
    if (!entry) continue;
    const exists = fs.existsSync(entry.destination);
    const stat = exists ? fs.lstatSync(entry.destination) : null;
    const regularFile = Boolean(stat && stat.isFile() && !stat.isSymbolicLink());
    const executable = entry.executable ? (regularFile && ((stat.mode & 0o111) !== 0)) : true;
    const label = entry.category === 'runtime-script'
      ? `runtime helper ${path.basename(source)}`
      : (entry.category === 'template' || entry.category === 'hook'
        ? `${entry.category} ${path.basename(source)}`
        : `${entry.category} ${source}`);
    checks.push(check(label, regularFile && executable, `run update-forgeflow to install ${source}`, {
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
    const parsed = JSON.parse(safeReadTextFile(file, ffDir).content);
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
  let content = '';
  try {
    content = safeReadTextFile(file, ffDir).content;
  } catch (_err) {
    return {
      status: 'invalid',
      path: file,
      pilot_count: 0,
      decision: '',
      next_fix_layer: '',
    };
  }
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
      command: 'forgeflow-learnings --project',
    };
  }
  let content = '';
  try {
    content = safeReadTextFile(file, ffDir).content;
  } catch (_err) {
    return {
      status: 'invalid',
      path: file,
      recurring_pitfalls: 0,
      risk_areas: 0,
      recommended_approach: '',
      command: 'forgeflow-learnings --project',
    };
  }
  return {
    status: 'present',
    path: file,
    recurring_pitfalls: countBulletsInSection(content, 'Recurring Pitfalls'),
    risk_areas: countBulletsInSection(content, 'Risk Areas'),
    recommended_approach: firstBulletInSection(content, 'Recommended Approach For Next Work'),
    validation_pattern: firstBulletInSection(content, 'Validation Patterns'),
    hot_file: firstBulletInSection(content, 'Hot Files And Modules'),
    command: 'forgeflow-learnings --project',
  };
}

function latestProjectLearningsCheck(ffDir) {
  try {
    const result = checkProjectLearnings({ projectDir: ffDir });
    const failures = result.issues.filter((item) => item.severity === 'fail').length;
    const warnings = result.issues.filter((item) => item.severity === 'warn').length;
    return {
      status: result.status,
      issues: result.issues.length,
      failures,
      warnings,
      candidates: result.candidates,
      path: result.learnings_file,
    };
  } catch (_err) {
    return {
      status: 'invalid',
      issues: 0,
      failures: 0,
      warnings: 0,
      candidates: 0,
      path: path.join(ffDir, 'project-learnings.md'),
    };
  }
}

function latestInsightsReadiness(ffDir, root = path.dirname(path.dirname(ffDir))) {
  return readLatestInsightsReadiness(ffDir, root);
}

function healthRecommendations({ latestInsights, projectLearningsCheck, failureDigest }) {
  const recommendations = [];
  const freshness = latestInsights && latestInsights.freshness ? latestInsights.freshness : null;
  if (freshness && freshness.issues && freshness.issues.length > 0) {
    recommendations.push(refreshProjectTrends());
  }
  if (latestInsights && ['blocked', 'error', 'invalid'].includes(latestInsights.status)) {
    recommendations.push(inspectLearningGate());
  }
  if (projectLearningsCheck && ['warn', 'fail', 'invalid'].includes(projectLearningsCheck.status)) {
    recommendations.push(inspectProjectLearnings());
  }
  if (failureDigest && failureDigest.status === 'invalid') {
    recommendations.push(refreshFailureDigest({ reason: failureDigest.reason }));
  } else if (failureDigest && failureDigest.freshness && failureDigest.freshness.status === 'attention') {
    recommendations.push(refreshFailureDigest());
  }
  return uniqueRecommendations(recommendations);
}

function runHealthCheck(opts = {}) {
  const requestedRoot = opts.root || process.cwd();
  const gitRepo = isGitRepo(requestedRoot);
  const root = opts.root ? path.resolve(opts.root) : repoRoot(requestedRoot);
  const ffDir = opts.projectDir ? path.resolve(opts.projectDir) : forgeflowDir(root);
  assertSafeDirectory(ffDir);
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

    const gitignore = gitignoreState(root);
    if (opts.fix && gitignore.safe && !hasGitignoreEntry(root)) {
      addGitignoreEntry(root);
      changes.push({ path: gitignorePath(root), action: 'added .forgeflow/' });
    }
    checks.push(check('gitignore .forgeflow/', hasGitignoreEntry(root), gitignore.safe ? 'add .forgeflow/ to .gitignore' : `${gitignore.reason}; replace it with a regular .gitignore before running --fix`, {
      reason: gitignore.safe ? '' : gitignore.reason,
    }));

    if (opts.fix && !fs.existsSync(budgetPath)) {
      const seeded = seedBudgetConfig({ root, out: budgetPath });
      if (seeded.written) changes.push({ path: budgetPath, action: 'seeded budget config' });
    }
    checks.push(check('budget config', fs.existsSync(budgetPath), 'run seed-budget-config.js'));
  }
  addInstallChecks(checks, opts.installRoot);

  const failures = checks.filter((item) => item.status === 'fail');
  const latestInsights = latestInsightsReadiness(ffDir, root);
  const failureDigest = latestFailureDigest(ffDir);
  failureDigest.freshness = failureDigestFreshness(failureDigest, {
    available: gitRepo,
    commit_short: gitRepo ? git(['rev-parse', '--short', 'HEAD'], root) : '',
    dirty: gitRepo ? git(['status', '--short'], root).split(/\r?\n/).filter(Boolean).length > 0 : false,
  });
  failureDigest.triage = classifyFailureDigest(failureDigest, failureDigest.freshness);
  const projectLearningsCheck = latestProjectLearningsCheck(ffDir);
  const recommendations = healthRecommendations({ latestInsights, projectLearningsCheck, failureDigest });
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
    latest_project_learnings_check: projectLearningsCheck,
    latest_insights_readiness: latestInsights,
    latest_failure_digest: failureDigest,
    recommendations,
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
    lines.push('## Latest Insights', '');
    lines.push(`- Recurring pitfalls: ${latest.recurring_pitfalls}`);
    lines.push(`- Risk areas: ${latest.risk_areas}`);
    if (latest.recommended_approach) lines.push(`- Recommended approach: ${latest.recommended_approach}`);
    if (latest.validation_pattern) lines.push(`- Validation pattern: ${latest.validation_pattern}`);
    if (latest.hot_file) lines.push(`- Hot file/module: ${latest.hot_file}`);
    lines.push(`- Refresh/view: ${latest.command}`);
    lines.push(`- Report: ${latest.path}`);
    lines.push('');
  }
  if (result.latest_project_learnings_check && result.latest_project_learnings_check.status !== 'pass') {
    const latest = result.latest_project_learnings_check;
    lines.push('## Latest Project Learnings Check', '');
    lines.push(`- Status: ${latest.status}`);
    lines.push(`- Issues: ${latest.issues} (${latest.failures} fail, ${latest.warnings} warn)`);
    lines.push(`- Candidates: ${latest.candidates}`);
    lines.push(`- Report: ${latest.path}`);
    lines.push('');
  }
  if (result.latest_insights_readiness && result.latest_insights_readiness.status !== 'missing') {
    const latest = result.latest_insights_readiness;
    lines.push('## Latest Insights Readiness', '');
    lines.push(`- Status: ${latest.status}`);
    if (latest.reason) lines.push(`- Reason: ${latest.reason}`);
    if (latest.check_status) lines.push(`- Quality gate: ${latest.check_status}`);
    if (latest.freshness) lines.push(`- Freshness: ${latest.freshness.status}`);
    lines.push(`- Issues: ${latest.issue_count}`);
    lines.push(`- Report: ${latest.path}`);
    lines.push('');
  }
  if (result.latest_failure_digest && result.latest_failure_digest.present) {
    const latest = result.latest_failure_digest;
    lines.push('## Latest Failure Digest', '');
    lines.push(`- Status: ${latest.status}`);
    if (latest.mode) lines.push(`- Mode: ${latest.mode}`);
    if (latest.generated_at) lines.push(`- Generated at: ${latest.generated_at}`);
    if (latest.freshness) lines.push(`- Freshness: ${latest.freshness.status}`);
    if (latest.triage) {
      lines.push(`- Triage state: ${latest.triage.state}`);
      lines.push(`- Usefulness: ${latest.triage.usefulness}`);
      lines.push(`- Confidence: ${latest.triage.confidence}`);
      if (latest.triage.next_action) {
        lines.push(`- Next action: ${latest.triage.next_action.command || latest.triage.next_action.action || '(none)'}`);
        if (latest.triage.next_action.reason) lines.push(`- Next action reason: ${latest.triage.next_action.reason}`);
      }
    }
    lines.push(`- Raw required: ${latest.raw_required ? 'yes' : 'no'}`);
    if (latest.reason) lines.push(`- Reason: ${latest.reason}`);
    lines.push(`- Report: ${latest.path}`);
    lines.push('');
  }
  if (result.recommendations && result.recommendations.length > 0) {
    lines.push('## Recommendations', '');
    lines.push(...renderRecommendationList(result.recommendations));
    lines.push('');
  }
  lines.push('## Checks', '');
  for (const item of result.checks) {
    const details = [];
    if (item.reason) details.push(item.reason);
    if (item.status === 'skip' && item.fix) details.push(`next: ${item.fix}`);
    const suffix = details.length > 0 ? ` (${details.join('; ')})` : '';
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
  gitignoreState,
  isGitRepo,
  renderMarkdown,
  runHealthCheck,
  expectedInstallSources,
  expectedRuntimeSources,
  expectedTemplateSources,
  latestImplementationNotesCheck,
  latestPilotRollup,
  latestProjectLearnings,
  latestProjectLearningsCheck,
  latestInsightsReadiness,
  latestInsightsFreshness,
  healthRecommendations,
};
