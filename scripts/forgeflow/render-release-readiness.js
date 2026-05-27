#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { safeReadTextFile, writeJsonSafe } = require('./file-safety');
const { RUNTIME_HELPERS, isManagedSource } = require('./install-manifest');

const MAX_OUTPUT_CHARS = 1200;

function usage() {
  console.error('Usage: render-release-readiness.js [--root <repo>] [--plan-only] [--json] [--baseline <json>] [--compare-last] [--save-current] [--post-publish] [--save-post-publish] [--compare-post-publish-last]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = {
    root: process.cwd(),
    planOnly: false,
    json: false,
    baseline: '',
    compareLast: false,
    saveCurrent: false,
    postPublish: false,
    savePostPublish: false,
    comparePostPublishLast: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--plan-only') {
      opts.planOnly = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--baseline') {
      opts.baseline = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--compare-last') {
      opts.compareLast = true;
    } else if (arg === '--save-current') {
      opts.saveCurrent = true;
    } else if (arg === '--post-publish') {
      opts.postPublish = true;
    } else if (arg === '--save-post-publish') {
      opts.postPublish = true;
      opts.savePostPublish = true;
    } else if (arg === '--compare-post-publish-last') {
      opts.postPublish = true;
      opts.comparePostPublishLast = true;
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

function lastSnapshotPath(root) {
  return path.join(defaultProjectDir(root), 'release-readiness', 'last.json');
}

function postPublishSnapshotPath(root) {
  return path.join(defaultProjectDir(root), 'release-readiness', 'post-publish-last.json');
}

function readReleaseCheck(root) {
  const file = path.join(root, 'commands', 'forgeflow-release-check.md');
  if (!fs.existsSync(file)) throw new Error(`Missing release-check source: ${file}`);
  return safeReadTextFile(file, root).content;
}

function readJsonIfPresent(root, relativePath) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(safeReadTextFile(file, root).content);
}

function changelogCandidates(version) {
  const exact = `docs/changelogs/v${version}.html`;
  const patchZero = String(version || '').endsWith('.0')
    ? `docs/changelogs/v${String(version).replace(/\.0$/, '')}.html`
    : '';
  return patchZero ? [exact, patchZero] : [exact];
}

function matchingChangelog(root, version) {
  return changelogCandidates(version).find((candidate) => fs.existsSync(path.join(root, candidate))) || '';
}

function releaseReadinessCommands(releaseCheck) {
  const text = String(releaseCheck || '');
  const fenced = [];
  let active = false;
  let language = '';
  let bucket = [];
  for (const line of text.split(/\r?\n/)) {
    const fence = line.match(/^```([A-Za-z0-9_-]*)\s*$/);
    if (fence) {
      if (active) {
        if (!language || language === 'bash' || language === 'sh') fenced.push(bucket.join('\n'));
        active = false;
        language = '';
        bucket = [];
      } else {
        active = true;
        language = (fence[1] || '').toLowerCase();
        bucket = [];
      }
      continue;
    }
    if (active) bucket.push(line);
  }
  const source = fenced.length > 0 ? fenced.join('\n') : text;
  return [...new Set(source.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^(node|git)\s+/.test(line)))];
}

function commandCategory(command) {
  if (/test-(plugin-manifest|release-version|doc-links|command-coverage|command-argument-safety)\.js/.test(command)) return 'metadata';
  if (/test-(install-template|install-manifest|runtime-helper-contract|install-smoke|update-forgeflow|health-check|forgeflow-version|render-guided-repair|installed-runtime-dogfood)\.js/.test(command)) return 'install-runtime';
  if (/test-(build-code-topology|show-code-map|build-context-pack|show-project-trends|show-project-learnings|build-project-intelligence|check-context-budget|advise-context|smoke-check)\.js/.test(command)) return 'project-context';
  if (/test-(privacy-boundary|record-|rollup-|check-project-learnings|check-implementation-notes|implementation-notes|render-adoption-pack|render-evaluation-report|render-forgeflow-report|render-release-notes|render-pilot-script|guidance-contract|failure-digest|check-agent-drift|dogfood-self-test|seed-budget-config)\.js/.test(command)) return 'quality';
  if (/smoke-check\.js --mode source/.test(command)) return 'source-smoke';
  if (command === 'git diff --check') return 'whitespace';
  return 'quality';
}

function tokenizeCommand(command) {
  return String(command || '').trim().split(/\s+/).filter(Boolean);
}

function allowedCommand(command) {
  const parts = tokenizeCommand(command);
  if (parts.length === 0) return false;
  if (parts[0] === 'git') return parts.length === 3 && parts[1] === 'diff' && parts[2] === '--check';
  if (parts[0] !== 'node') return false;
  const script = parts[1] || '';
  if (!/^scripts\/forgeflow\/[A-Za-z0-9._-]+\.js$/.test(script)) return false;
  return parts.slice(2).every((arg) => /^[A-Za-z0-9._=/:+-]+$/.test(arg));
}

function releaseCheckEnv() {
  const env = { ...process.env };
  delete env.NODE_OPTIONS;
  delete env.NODE_PATH;
  return env;
}

function runCommand(root, command, runner = spawnSync) {
  if (!allowedCommand(command)) {
    return {
      status: 'fail',
      exit_code: null,
      stdout: '',
      stderr: 'release readiness refuses to run command outside the release-check allowlist',
    };
  }
  const [bin, ...args] = tokenizeCommand(command);
  const result = runner(bin, args, { cwd: root, encoding: 'utf8', env: releaseCheckEnv() });
  if (result.error) {
    return {
      status: 'fail',
      exit_code: result.status ?? null,
      stdout: String(result.stdout || '').trim().slice(0, MAX_OUTPUT_CHARS),
      stderr: String(result.error.message || result.stderr || '').trim().slice(0, MAX_OUTPUT_CHARS),
    };
  }
  return {
    status: result.status === 0 ? 'pass' : 'fail',
    exit_code: result.status,
    stdout: String(result.stdout || '').trim().slice(0, MAX_OUTPUT_CHARS),
    stderr: String(result.stderr || result.error?.message || '').trim().slice(0, MAX_OUTPUT_CHARS),
  };
}

function blockerKind(item) {
  const output = String(item.stderr || item.stdout || '');
  if (item.command === 'release-to-install preflight') return 'release-to-install-preflight';
  if (/spawnSync\s+\S+\s+E(?:PERM|ACCES)\b/i.test(output)) return 'execution-environment';
  if (/spawnSync\s+\S+\s+ENOENT\b/i.test(output)) return 'missing-command';
  if (/release readiness refuses to run command outside the release-check allowlist/i.test(output)) return 'allowlist';
  if (item.command === 'read commands/forgeflow-release-check.md') return 'release-check-source';
  return 'command-failure';
}

function clearingAction(item) {
  const kind = blockerKind(item);
  if (kind === 'execution-environment') {
    return 'Run the listed release-check command directly in the same trusted local environment you use for release validation, or rerun release readiness where local process spawning is permitted.';
  }
  if (kind === 'missing-command') {
    return 'Install or restore the missing local command, then rerun release readiness.';
  }
  if (kind === 'allowlist') {
    return 'Keep release readiness commands in the documented local node/git allowlist, or move the command to a manual release-check step.';
  }
  if (kind === 'release-check-source') {
    return 'Restore commands/forgeflow-release-check.md and rerun release readiness.';
  }
  if (kind === 'release-to-install-preflight') {
    return 'Restore the missing or invalid runtime helper source, then rerun release readiness before tagging.';
  }
  return `Fix the failure and rerun ${item.command}`;
}

function summarizeCategory(items) {
  const failed = items.filter((item) => item.status === 'fail');
  const planned = items.filter((item) => item.status === 'planned');
  return {
    status: failed.length > 0 ? 'fail' : (planned.length > 0 ? 'planned' : 'pass'),
    total: items.length,
    failed: failed.length,
    planned: planned.length,
  };
}

function checkKey(item) {
  return `${item.category || 'unknown'}\n${item.command || ''}`;
}

function baselineProvenance(baseline, baselinePath) {
  return {
    path: baselinePath || '',
    schema_version: baseline.schema_version || '',
    generated_at: baseline.generated_at || '',
    root: baseline.root || '',
    status: baseline.status || '',
    mode: baseline.mode || '',
    command_count: baseline.command_count || 0,
  };
}

function readBaselineResult(file) {
  if (!file) return { result: null, error: '' };
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return { result: null, error: `Baseline must be a regular file: ${file}` };
    }
    return { result: JSON.parse(fs.readFileSync(file, 'utf8')), error: '' };
  } catch (err) {
    return { result: null, error: err.message };
  }
}

function compareReleaseReadiness(current, baseline, baselinePath = '', baselineError = '') {
  if (!baseline) {
    return {
      status: 'no-baseline',
      baseline: {
        path: baselinePath || '',
        reason: baselineError || (baselinePath ? 'baseline unavailable' : 'no baseline provided'),
      },
      newly_failing: [],
      cleared_blockers: [],
      category_movement: [],
    };
  }

  const baselineChecks = Array.isArray(baseline.checks) ? baseline.checks : [];
  const currentChecks = Array.isArray(current.checks) ? current.checks : [];
  const baselineFailures = new Map(baselineChecks.filter((item) => item.status === 'fail').map((item) => [checkKey(item), item]));
  const currentFailures = new Map(currentChecks.filter((item) => item.status === 'fail').map((item) => [checkKey(item), item]));
  const newlyFailing = [];
  const clearedBlockers = [];
  for (const [key, item] of currentFailures.entries()) {
    if (!baselineFailures.has(key)) {
      newlyFailing.push({
        kind: blockerKind(item),
        category: item.category,
        command: item.command,
        output: item.stderr || item.stdout || '',
      });
    }
  }
  for (const [key, item] of baselineFailures.entries()) {
    if (!currentFailures.has(key)) {
      clearedBlockers.push({
        kind: blockerKind(item),
        category: item.category,
        command: item.command,
      });
    }
  }

  const categoryMovement = [];
  const categoryNames = [...new Set([
    ...Object.keys(baseline.categories || {}),
    ...Object.keys(current.categories || {}),
  ])].sort();
  for (const name of categoryNames) {
    const before = baseline.categories && baseline.categories[name] ? baseline.categories[name] : { status: 'missing', total: 0, failed: 0, planned: 0 };
    const after = current.categories && current.categories[name] ? current.categories[name] : { status: 'missing', total: 0, failed: 0, planned: 0 };
    if (
      before.status !== after.status
      || before.failed !== after.failed
      || before.planned !== after.planned
      || before.total !== after.total
    ) {
      categoryMovement.push({
        category: name,
        from_status: before.status,
        to_status: after.status,
        failed_delta: after.failed - before.failed,
        planned_delta: after.planned - before.planned,
        total_delta: after.total - before.total,
      });
    }
  }

  return {
    status: newlyFailing.length > 0 ? 'regressed' : (clearedBlockers.length > 0 || categoryMovement.length > 0 ? 'changed' : 'unchanged'),
    baseline: baselineProvenance(baseline, baselinePath),
    newly_failing: newlyFailing,
    cleared_blockers: clearedBlockers,
    category_movement: categoryMovement,
  };
}

function releaseToInstallPreflight(root) {
  const rootReal = fs.realpathSync(root);
  const missingSources = [];
  const nonFileSources = [];
  const outOfTreeSources = [];
  const unmanagedHelpers = [];
  for (const source of RUNTIME_HELPERS) {
    if (!isManagedSource(source)) {
      unmanagedHelpers.push(source);
      continue;
    }
    const file = path.join(root, source);
    if (!fs.existsSync(file)) {
      missingSources.push(source);
      continue;
    }
    let stat = null;
    try {
      stat = fs.lstatSync(file);
    } catch (_err) {
      missingSources.push(source);
      continue;
    }
    if (!stat.isFile()) nonFileSources.push(source);
    let real = '';
    try {
      real = fs.realpathSync(file);
    } catch (_err) {
      missingSources.push(source);
      continue;
    }
    const relativeReal = path.relative(rootReal, real);
    if (relativeReal.startsWith('..') || path.isAbsolute(relativeReal)) outOfTreeSources.push(source);
  }
  const failures = [];
  if (unmanagedHelpers.length > 0) {
    failures.push({
      reason: 'runtime-helper-not-managed',
      sources: unmanagedHelpers,
    });
  }
  if (missingSources.length > 0) {
    failures.push({
      reason: 'runtime-helper-source-missing',
      sources: missingSources,
    });
  }
  if (nonFileSources.length > 0) {
    failures.push({
      reason: 'runtime-helper-source-not-file',
      sources: nonFileSources,
    });
  }
  if (outOfTreeSources.length > 0) {
    failures.push({
      reason: 'runtime-helper-source-out-of-tree',
      sources: outOfTreeSources,
    });
  }
  const invalidSources = new Set([
    ...missingSources,
    ...nonFileSources,
    ...outOfTreeSources,
  ]);
  return {
    status: failures.length > 0 ? 'fail' : 'pass',
    checked: RUNTIME_HELPERS.length,
    managed: RUNTIME_HELPERS.length - unmanagedHelpers.length,
    present: RUNTIME_HELPERS.length - invalidSources.size,
    missing: missingSources,
    non_file: nonFileSources,
    out_of_tree: outOfTreeSources,
    unmanaged: unmanagedHelpers,
    failures,
    repair: failures.length > 0 ? 'Restore the missing or invalid runtime helper source, then rerun release readiness before tagging.' : '',
  };
}

function releaseToInstallPreflightCheck(root) {
  const preflight = releaseToInstallPreflight(root);
  return {
    preflight,
    check: {
      category: 'install-runtime',
      command: 'release-to-install preflight',
      status: preflight.status === 'pass' ? 'pass' : 'fail',
      exit_code: preflight.status === 'pass' ? 0 : 1,
      stdout: preflight.status === 'pass' ? `${preflight.checked} runtime helper source(s) present and managed.` : '',
      stderr: preflight.status === 'pass' ? '' : preflight.failures.map((failure) => `${failure.reason}: ${failure.sources.slice(0, 5).join(', ')}${failure.sources.length > 5 ? `, +${failure.sources.length - 5} more` : ''}`).join('; '),
    },
  };
}

function localTagExists(root, tag) {
  if (!tag) return false;
  const result = spawnSync('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`], { cwd: root, encoding: 'utf8' });
  return result.status === 0;
}

function localHeadShort(root) {
  const result = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
}

function postPublishVerification(root, checks = []) {
  const plugin = readJsonIfPresent(root, '.claude-plugin/plugin.json') || {};
  const version = plugin.version || '';
  const tag = version ? `v${version}` : '';
  const changelog = version ? matchingChangelog(root, version) : '';
  const releaseNotesCheck = checks.find((item) => item.command === 'node scripts/forgeflow/test-render-release-notes.js') || null;
  const sourceSmokeCheck = checks.find((item) => item.command === 'node scripts/forgeflow/smoke-check.js --mode source --json') || null;
  const updateSmokeCheck = checks.find((item) => item.command === 'node scripts/forgeflow/test-update-forgeflow.js') || null;
  const installedRuntimeCheck = checks.find((item) => item.command === 'node scripts/forgeflow/test-installed-runtime-dogfood.js') || null;
  const checkStatus = (item) => (item && item.status === 'pass' ? 'pass' : 'warn');
  const evidence = [
    {
      name: 'plugin-version',
      status: version ? 'pass' : 'fail',
      value: version,
      clears: 'Set .claude-plugin/plugin.json version before publishing.',
    },
    {
      name: 'local-tag',
      status: localTagExists(root, tag) ? 'pass' : 'warn',
      value: tag,
      clears: `Create and push ${tag} after release checks pass.`,
    },
    {
      name: 'changelog',
      status: changelog ? 'pass' : 'fail',
      value: changelog,
      clears: `Add ${changelogCandidates(version)[0]} before publishing.`,
    },
    {
      name: 'release-notes-draft',
      status: checkStatus(releaseNotesCheck),
      value: releaseNotesCheck ? releaseNotesCheck.command : '',
      clears: 'Run node scripts/forgeflow/test-render-release-notes.js.',
    },
    {
      name: 'source-smoke',
      status: checkStatus(sourceSmokeCheck),
      value: sourceSmokeCheck ? sourceSmokeCheck.command : '',
      clears: 'Run node scripts/forgeflow/smoke-check.js --mode source --json.',
    },
    {
      name: 'update-smoke',
      status: checkStatus(updateSmokeCheck),
      value: updateSmokeCheck ? updateSmokeCheck.command : '',
      clears: 'Run node scripts/forgeflow/test-update-forgeflow.js.',
    },
    {
      name: 'installed-runtime-dogfood',
      status: checkStatus(installedRuntimeCheck),
      value: installedRuntimeCheck ? installedRuntimeCheck.command : '',
      clears: 'Run node scripts/forgeflow/test-installed-runtime-dogfood.js to verify installed runtime helper behavior without mutating installed files.',
    },
  ];
  const failures = evidence.filter((item) => item.status === 'fail');
  const warnings = evidence.filter((item) => item.status === 'warn');
  const passed = evidence.filter((item) => item.status === 'pass').map((item) => item.name);
  const attention = evidence.filter((item) => item.status !== 'pass').map((item) => ({
    name: item.name,
    status: item.status,
    clears: item.clears,
  }));
  return {
    status: failures.length > 0 ? 'repair-needed' : (warnings.length > 0 ? 'published-propagation-pending' : 'published-and-verified'),
    version,
    tag,
    head: localHeadShort(root),
    evidence,
    summary: {
      passed,
      attention,
      shareable: failures.length > 0
        ? `Forgeflow ${version || '(missing version)'} post-publish verification needs repair.`
        : warnings.length > 0
          ? `Forgeflow ${version || '(missing version)'} post-publish verification is pending propagation.`
          : `Forgeflow ${version || '(missing version)'} post-publish verification passed locally.`,
    },
    next_command: failures.length > 0 || warnings.length > 0 ? 'forgeflow-release-readiness --post-publish' : '/forgeflow-version && /forgeflow-health',
    boundary: 'Post-publish verification is local and advisory. It does not create tags, push, publish, call GitHub, or mutate installed files.',
  };
}

function comparePostPublishVerification(current, baseline, baselinePath = '', baselineError = '') {
  if (!baseline) {
    return {
      status: 'no-baseline',
      baseline: {
        path: baselinePath || '',
        reason: baselineError || (baselinePath ? 'baseline unavailable' : 'no baseline provided'),
      },
      changed_evidence: [],
    };
  }
  const beforeItems = Array.isArray(baseline.evidence) ? baseline.evidence : [];
  const afterItems = Array.isArray(current.evidence) ? current.evidence : [];
  const before = new Map(beforeItems.map((item) => [item.name, item]));
  const changed = [];
  for (const item of afterItems) {
    const prior = before.get(item.name) || null;
    if (!prior || prior.status !== item.status || prior.value !== item.value) {
      changed.push({
        name: item.name,
        from_status: prior ? prior.status : 'missing',
        to_status: item.status,
        from_value: prior ? prior.value || '' : '',
        to_value: item.value || '',
      });
    }
  }
  return {
    status: changed.length > 0 ? 'changed' : 'unchanged',
    baseline: {
      path: baselinePath || '',
      generated_at: baseline.generated_at || '',
      status: baseline.status || '',
      version: baseline.version || '',
      tag: baseline.tag || '',
    },
    changed_evidence: changed,
  };
}

function buildReleaseReadiness(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  let releaseCheck = '';
  let sourceError = null;
  try {
    releaseCheck = readReleaseCheck(root);
  } catch (err) {
    sourceError = err;
  }
  const commands = releaseReadinessCommands(releaseCheck);
  const runner = opts.runner || spawnSync;
  const installPreflight = releaseToInstallPreflightCheck(root);
  const sourceFailure = sourceError ? [{
    category: 'metadata',
    command: 'read commands/forgeflow-release-check.md',
    status: 'fail',
    exit_code: null,
    stdout: '',
    stderr: sourceError.message,
  }] : [];
  const checks = sourceFailure.concat([installPreflight.check], commands.map((command) => {
    const category = commandCategory(command);
    if (opts.planOnly) {
      return {
        category,
        command,
        status: 'planned',
        exit_code: null,
        stdout: '',
        stderr: '',
      };
    }
    return {
      category,
      command,
      ...runCommand(root, command, runner),
    };
  }));
  const categories = {};
  for (const category of [...new Set(checks.map((item) => item.category))].sort()) {
    categories[category] = summarizeCategory(checks.filter((item) => item.category === category));
  }
  const failures = checks.filter((item) => item.status === 'fail');
  const planned = checks.filter((item) => item.status === 'planned');
  const snapshotPath = lastSnapshotPath(root);
  const postPublishSnapshot = postPublishSnapshotPath(root);
  const wantsPostPublish = opts.postPublish || opts.savePostPublish || opts.comparePostPublishLast;
  const postPublish = wantsPostPublish ? postPublishVerification(root, checks) : null;
  if (postPublish) {
    postPublish.snapshot = {
      path: postPublishSnapshot,
      saved: false,
    };
    const baselinePath = opts.comparePostPublishLast ? postPublishSnapshot : '';
    const baselineRead = readBaselineResult(baselinePath);
    postPublish.comparison = comparePostPublishVerification(postPublish, baselineRead.result, baselinePath, baselineRead.error);
  }
  const result = {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    status: failures.length > 0 ? 'blocked' : (planned.length > 0 ? 'planned' : 'ready'),
    mode: opts.planOnly ? 'plan-only' : 'run',
    command_count: checks.length,
    install_preflight: installPreflight.preflight,
    categories,
    blockers: failures.map((item) => ({
      kind: blockerKind(item),
      category: item.category,
      command: item.command,
      exit_code: item.exit_code,
      output: item.stderr || item.stdout,
      clears: clearingAction(item),
    })),
    checks,
    snapshot: {
      path: snapshotPath,
      saved: false,
    },
    post_publish_verification: postPublish,
    boundary: opts.saveCurrent
      ? 'Release readiness is advisory and release-safe. It wrote the requested local readiness snapshot, but it never tags, pushes, publishes, or calls GitHub.'
      : 'Release readiness is advisory and non-mutating unless --save-current is passed. It never tags, pushes, publishes, or calls GitHub.',
  };
  const baselinePath = opts.compareLast && !opts.baseline ? snapshotPath : opts.baseline || '';
  const baselineRead = readBaselineResult(baselinePath);
  result.comparison = compareReleaseReadiness(result, baselineRead.result, baselinePath, baselineRead.error);
  if (opts.saveCurrent) {
    result.snapshot.saved = true;
    writeJsonSafe(snapshotPath, result);
  }
  if (opts.savePostPublish && result.post_publish_verification) {
    result.post_publish_verification.snapshot.saved = true;
    writeJsonSafe(postPublishSnapshot, result.post_publish_verification);
  }
  return result;
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Release Readiness',
    '',
    `Status: ${result.status}`,
    `Mode: ${result.mode}`,
    `Commands: ${result.command_count}`,
    `Snapshot: ${result.snapshot && result.snapshot.saved ? `saved to ${result.snapshot.path}` : (result.snapshot ? result.snapshot.path : '(none)')}`,
    '',
    result.boundary,
    '',
    '## Categories',
    '',
  ];
  for (const [name, summary] of Object.entries(result.categories)) {
    lines.push(`- ${name}: ${summary.status} (${summary.total} checks, ${summary.failed} failed, ${summary.planned} planned)`);
  }
  lines.push('', '## Baseline Comparison', '');
  if (!result.comparison || result.comparison.status === 'no-baseline') {
    const baseline = result.comparison ? result.comparison.baseline || {} : {};
    lines.push(`- No baseline compared: ${baseline.reason || 'no baseline provided'}.`);
    if (baseline.path) lines.push(`- Baseline path: ${baseline.path}`);
  } else {
    lines.push(`- Status: ${result.comparison.status}`);
    lines.push(`- Baseline: ${result.comparison.baseline.generated_at || '(unknown)'} ${result.comparison.baseline.status || '(unknown status)'} from ${result.comparison.baseline.path || '(inline)'}`);
    lines.push(`- Newly failing: ${result.comparison.newly_failing.length}`);
    for (const item of result.comparison.newly_failing) {
      lines.push(`  - ${item.category}: ${item.command} (${item.kind})`);
    }
    lines.push(`- Cleared blockers: ${result.comparison.cleared_blockers.length}`);
    for (const item of result.comparison.cleared_blockers) {
      lines.push(`  - ${item.category}: ${item.command} (${item.kind})`);
    }
    lines.push(`- Category movement: ${result.comparison.category_movement.length}`);
    for (const item of result.comparison.category_movement) {
      lines.push(`  - ${item.category}: ${item.from_status} -> ${item.to_status} (failed ${item.failed_delta >= 0 ? '+' : ''}${item.failed_delta}, planned ${item.planned_delta >= 0 ? '+' : ''}${item.planned_delta}, total ${item.total_delta >= 0 ? '+' : ''}${item.total_delta})`);
    }
  }
  lines.push('', '## Release To Install Preflight', '');
  if (result.install_preflight) {
    lines.push(`- Status: ${result.install_preflight.status}`);
    lines.push(`- Runtime helpers: ${result.install_preflight.present}/${result.install_preflight.checked} present, ${result.install_preflight.managed}/${result.install_preflight.checked} managed`);
    if (result.install_preflight.failures.length > 0) {
      for (const failure of result.install_preflight.failures) {
        lines.push(`- ${failure.reason}: ${failure.sources.slice(0, 5).join(', ')}${failure.sources.length > 5 ? `, +${failure.sources.length - 5} more` : ''}`);
      }
      lines.push(`- Clears: ${result.install_preflight.repair}`);
    }
  } else {
    lines.push('- Not available.');
  }
  if (result.post_publish_verification) {
    lines.push('', '## Post-Publish Verification', '');
    lines.push(`- Status: ${result.post_publish_verification.status}`);
    lines.push(`- Version: ${result.post_publish_verification.version || '(missing)'}`);
    lines.push(`- Tag: ${result.post_publish_verification.tag || '(missing)'}`);
    lines.push(`- HEAD: ${result.post_publish_verification.head || '(unknown)'}`);
    lines.push(`- Snapshot: ${result.post_publish_verification.snapshot && result.post_publish_verification.snapshot.saved ? `saved to ${result.post_publish_verification.snapshot.path}` : result.post_publish_verification.snapshot ? result.post_publish_verification.snapshot.path : '(none)'}`);
    if (result.post_publish_verification.summary) {
      lines.push(`- Summary: ${result.post_publish_verification.summary.shareable}`);
      lines.push(`- Passed evidence: ${result.post_publish_verification.summary.passed.join(', ') || '(none)'}`);
      lines.push(`- Attention evidence: ${result.post_publish_verification.summary.attention.map((item) => `${item.name}:${item.status}`).join(', ') || '(none)'}`);
    }
    lines.push(`- Boundary: ${result.post_publish_verification.boundary}`);
    if (result.post_publish_verification.comparison) {
      lines.push(`- Snapshot comparison: ${result.post_publish_verification.comparison.status}`);
      if (result.post_publish_verification.comparison.baseline && result.post_publish_verification.comparison.baseline.path) lines.push(`- Compared with: ${result.post_publish_verification.comparison.baseline.path}`);
    }
    for (const item of result.post_publish_verification.evidence) {
      lines.push(`- ${item.name}: ${item.status}${item.value ? ` (${item.value})` : ''}`);
      if (item.status !== 'pass') lines.push(`  - Clears: ${item.clears}`);
    }
    lines.push(`- Next: ${result.post_publish_verification.next_command}`);
  }
  lines.push('', '## Blockers', '');
  if (result.blockers.length === 0) {
    lines.push(result.status === 'planned' ? '- Not run; use without `--plan-only` to execute readiness checks.' : '- None.');
  } else {
    for (const blocker of result.blockers) {
      lines.push(`- ${blocker.command}`);
      lines.push(`  - Kind: ${blocker.kind}`);
      lines.push(`  - Category: ${blocker.category}`);
      lines.push(`  - Exit: ${blocker.exit_code}`);
      if (blocker.output) lines.push(`  - Output: ${blocker.output.replace(/\s+/g, ' ')}`);
      lines.push(`  - Clears: ${blocker.clears}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = buildReleaseReadiness(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
    if (result.status === 'blocked') process.exit(1);
  } catch (err) {
    console.error(err.message);
    usage();
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  allowedCommand,
  buildReleaseReadiness,
  changelogCandidates,
  commandCategory,
  blockerKind,
  clearingAction,
  compareReleaseReadiness,
  comparePostPublishVerification,
  postPublishVerification,
  parseArgs,
  releaseToInstallPreflight,
  releaseToInstallPreflightCheck,
  postPublishSnapshotPath,
  renderMarkdown,
  releaseCheckEnv,
  releaseReadinessCommands,
  runCommand,
};
