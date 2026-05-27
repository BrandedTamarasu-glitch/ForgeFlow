#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeFileSafe } = require('./file-safety');
const { getVersionStatus } = require('./forgeflow-version');
const { runHealthCheck } = require('./health-check');
const { sensitiveMatches } = require('./privacy-boundary');
const { buildReleaseReadiness } = require('./render-release-readiness');
const { showCodeMap } = require('./show-code-map');
const { smokeCheck } = require('./smoke-check');
const { showProjectTrends } = require('./show-project-trends');

function usage() {
  console.error('Usage: render-support-bundle.js [--root <dir>] [--project-dir <dir>] [--out <json>] [--home <dir>] [--json]');
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
    root: process.cwd(),
    projectDir: '',
    out: '',
    home: path.join(os.homedir(), '.claude'),
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--out') {
      opts.out = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--home') {
      opts.home = path.resolve(requireValue(argv, arg, i));
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
  return opts;
}

function defaultProjectDir(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function defaultOut(projectDir) {
  return path.join(projectDir, 'support', 'support-bundle.json');
}

function markdownOutFor(jsonOut) {
  return /\.json$/i.test(jsonOut) ? jsonOut.replace(/\.json$/i, '.md') : `${jsonOut}.md`;
}

function statusRank(status) {
  return { fail: 3, blocked: 3, warn: 2, attention: 2, planned: 1, pass: 0, ready: 0, current: 0 }[status] ?? 1;
}

function combineStatuses(statuses) {
  return statuses.reduce((worst, status) => (statusRank(status) > statusRank(worst) ? status : worst), 'pass');
}

function summarizeVersion(version) {
  return {
    status: version.status,
    bundle_status: versionBundleStatus(version.status),
    installed: version.installed ? version.installed.status : 'unknown',
    upstream: version.upstream ? version.upstream.status : 'unknown',
    runtime_helpers: version.runtime_helpers ? {
      status: version.runtime_helpers.status,
      present: version.runtime_helpers.present,
      expected: version.runtime_helpers.expected,
      missing: (version.runtime_helpers.missing || []).map((item) => item.source),
    } : null,
    action: version.action || '',
    snapshot: version.snapshot || null,
  };
}

function versionBundleStatus(status) {
  if (['repair-needed', 'corrupt-version'].includes(status)) return 'fail';
  if (['outdated', 'not-installed', 'installed-unknown-upstream'].includes(status)) return 'warn';
  return 'pass';
}

function summarizeHealth(health, projectDir) {
  return {
    status: health.status,
    project_dir: projectDir,
    failures: (health.failures || []).map((item) => item.name || item.message || item.reason).filter(Boolean),
    warnings: (health.warnings || []).map((item) => item.name || item.message || item.reason).filter(Boolean),
    recommendations: health.recommendations || [],
  };
}

function summarizeSmoke(smoke) {
  return {
    status: smoke.status,
    mode: smoke.mode,
    project_dir: smoke.project_dir,
    checks: (smoke.checks || []).map((item) => ({
      name: item.name,
      status: item.status,
      command: item.command || '',
      reason: item.reason || item.error || '',
      clears: item.clears || '',
    })),
  };
}

function summarizeReadiness(readiness) {
  return {
    status: readiness.status,
    mode: readiness.mode,
    command_count: readiness.command_count,
    post_publish_verification: readiness.post_publish_verification ? {
      status: readiness.post_publish_verification.status,
      version: readiness.post_publish_verification.version,
      tag: readiness.post_publish_verification.tag,
      next_command: readiness.post_publish_verification.next_command,
    } : null,
    blockers: (readiness.blockers || []).map((item) => ({
      kind: item.kind,
      category: item.category,
      command: item.command,
      clears: item.clears,
    })),
    comparison: readiness.comparison ? {
      status: readiness.comparison.status,
      newly_failing: (readiness.comparison.newly_failing || []).length,
      cleared_blockers: (readiness.comparison.cleared_blockers || []).length,
    } : null,
  };
}

function releaseReadinessSafe(root) {
  const sourceRoot = path.resolve(__dirname, '..', '..');
  if (path.resolve(root) !== sourceRoot) {
    return {
      schema_version: '1',
      status: 'skip',
      mode: 'source-only',
      command_count: 0,
      blockers: [],
      comparison: null,
      reason: 'release readiness runs only from the Forgeflow source checkout',
    };
  }
  return buildReleaseReadiness({ root, planOnly: true, postPublish: true });
}

function summarizeCodeMapAcceptance(codeMap) {
  const acceptance = codeMap && codeMap.summary && codeMap.summary.import_gaps
    ? codeMap.summary.import_gaps.acceptance
    : null;
  if (!acceptance) {
    return {
      status: 'missing',
      accepted_total: 0,
      stale_total: 0,
      invalid_total: 0,
      lifecycle_warning_total: 0,
      path: '',
    };
  }
  return {
    status: acceptance.status,
    accepted_total: acceptance.accepted_total || 0,
    stale_total: acceptance.stale_total || 0,
    invalid_total: acceptance.invalid_total || 0,
    lifecycle_warning_total: acceptance.lifecycle_warning_total || 0,
    path: acceptance.path || '',
  };
}

function summarizeTrends(trends) {
  return {
    status: trends.refresh ? trends.refresh.status : 'not-run',
    freshness: trends.freshness ? trends.freshness.status : 'missing',
    latest_insights: trends.latest_insights ? trends.latest_insights.status : 'missing',
    latest_insights_freshness: trends.latest_insights && trends.latest_insights.freshness ? trends.latest_insights.freshness.status : 'missing',
    failure_digest: trends.failure_digest ? trends.failure_digest.status : 'missing',
    import_gaps: trends.import_gaps ? trends.import_gaps.status : 'missing',
    advisor: trends.advisor ? trends.advisor.budget_status || 'unknown' : 'missing',
    recommendations: trends.recommendations || [],
  };
}

function summarizeDocs(docs) {
  return {
    status: docs.status,
    checked_files: docs.checked_files,
    failures: (docs.failures || []).map((item) => ({
      code: item.code,
      source: item.source,
      message: item.message,
      fix: item.fix,
    })),
  };
}

function redactionPreview(value) {
  const counts = new Map();
  let scanned = 0;
  function add(label) {
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  function scan(item) {
    if (item === null || item === undefined) return;
    if (Array.isArray(item)) {
      for (const child of item) scan(child);
      return;
    }
    if (typeof item === 'object') {
      for (const child of Object.values(item)) scan(child);
      return;
    }
    if (!['string', 'number', 'boolean'].includes(typeof item)) return;
    scanned += 1;
    const text = String(item);
    for (const label of sensitiveMatches(text)) add(label);
    if (/(^|[\s"'(])(?:(?:\/(?:home|Users|tmp|workspaces|workspace|mnt|var|private|opt)\/[^\s)]+)|(?:[A-Za-z]:\\[^\s)]+)|(?:\.{1,2}\/[^\s)]+)|(?:[A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+)|(?:[A-Za-z0-9_.-]+\.(?:md|js|ts|tsx|jsx|json|html|css|yml|yaml|toml|txt)))(?=$|[\s)"'])/i.test(text)) add('local-path');
  }
  scan(value);
  const categories = [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([category, count]) => ({ category, count }));
  const findingTotal = categories.reduce((sum, item) => sum + item.count, 0);
  return {
    status: findingTotal > 0 ? 'review-needed' : 'clear',
    scanned_fields: scanned,
    finding_total: findingTotal,
    categories,
    guidance: findingTotal > 0
      ? 'Preview only: categories and counts are shown without snippets. Create a public-safe summary before sharing this support bundle outside the trusted project/team context.'
      : 'No sensitive categories detected by the local preview. Still review before sharing outside the trusted project/team context.',
  };
}

function validateDocsSafe(root) {
  const sourceRoot = path.resolve(__dirname, '..', '..');
  if (path.resolve(root) !== sourceRoot) {
    return {
      status: 'skip',
      checked_files: 0,
      failures: [],
      reason: 'docs drift validator runs only from the Forgeflow source checkout',
    };
  }
  const validator = path.join(sourceRoot, 'scripts', 'forgeflow', 'test-doc-links.js');
  if (!fs.existsSync(validator)) {
    return {
      status: 'skip',
      checked_files: 0,
      failures: [],
      reason: 'source-tree docs drift validator not available',
    };
  }
  return require(validator).validateDocs();
}

function renderMarkdown(bundle) {
  const lines = [
    '# Forgeflow Support Bundle',
    '',
    `Generated at: ${bundle.generated_at}`,
    `Status: ${bundle.status}`,
    `Root: ${bundle.root}`,
    `Project dir: ${bundle.project_dir}`,
    '',
    bundle.privacy_boundary,
    '',
    '## Redaction Preview',
    '',
    `- Status: ${bundle.redaction_preview.status}`,
    `- Findings: ${bundle.redaction_preview.finding_total}`,
    `- Categories: ${bundle.redaction_preview.categories.length > 0 ? bundle.redaction_preview.categories.map((item) => `${item.category} (${item.count})`).join(', ') : '(none)'}`,
    `- Guidance: ${bundle.redaction_preview.guidance}`,
    '',
    '## Summary',
    '',
    `- Version: ${bundle.sections.version.status}`,
    `- Health: ${bundle.sections.health.status}`,
    `- Smoke: ${bundle.sections.smoke.status}`,
    `- Release readiness: ${bundle.sections.release_readiness.status} (${bundle.sections.release_readiness.mode})`,
    `- Post-publish verification: ${bundle.sections.release_readiness.post_publish_verification ? bundle.sections.release_readiness.post_publish_verification.status : 'not-run'}`,
    `- Code-map acceptance: ${bundle.sections.code_map_acceptance.status}`,
    `- Docs drift: ${bundle.sections.docs_drift.status}`,
    `- Trends freshness: ${bundle.sections.trends.freshness}`,
    '',
    '## Next Actions',
    '',
  ];
  if (bundle.next_actions.length === 0) {
    lines.push('- None.');
  } else {
    for (const item of bundle.next_actions) {
      lines.push(`- ${item.command}: ${item.reason}`);
    }
  }
  lines.push('', '## Artifacts', '', `- JSON: ${bundle.artifacts.json}`, `- Markdown: ${bundle.artifacts.markdown}`);
  return `${lines.join('\n')}\n`;
}

function collectNextActions(bundle) {
  const actions = [];
  function add(command, reason) {
    if (!command || actions.some((item) => item.command === command && item.reason === reason)) return;
    actions.push({ command, reason });
  }
  if (bundle.sections.version.action) add('/forgeflow-version', bundle.sections.version.action);
  for (const recommendation of bundle.sections.health.recommendations || []) {
    add(recommendation.command || recommendation.action, recommendation.reason || 'Health check recommendation.');
  }
  for (const check of bundle.sections.smoke.checks || []) {
    if (check.status === 'warn' || check.status === 'fail') add(check.command || '/forgeflow-smoke', check.clears || check.reason || 'Smoke check needs attention.');
  }
  for (const blocker of bundle.sections.release_readiness.blockers || []) {
    add(blocker.command, blocker.clears || 'Release readiness blocker.');
  }
  const postPublish = bundle.sections.release_readiness.post_publish_verification;
  if (postPublish && postPublish.status !== 'published-and-verified') {
    add('/forgeflow-release-readiness --post-publish', postPublish.next_command || 'Post-publish verification needs attention.');
  }
  const acceptance = bundle.sections.code_map_acceptance || {};
  if (acceptance.invalid_total > 0 || acceptance.stale_total > 0 || acceptance.lifecycle_warning_total > 0) {
    add('/forgeflow-code-map', 'Review local code-map acceptance invalid, stale, or lifecycle warning entries.');
  }
  for (const failure of bundle.sections.docs_drift.failures || []) {
    add(failure.source, failure.fix || failure.message);
  }
  for (const recommendation of bundle.sections.trends.recommendations || []) {
    add(recommendation.command || recommendation.action, recommendation.reason || 'Project trend recommendation.');
  }
  return actions.slice(0, 12);
}

async function buildSupportBundle(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const jsonOut = path.resolve(opts.out || defaultOut(projectDir));
  const markdownOut = markdownOutFor(jsonOut);
  const version = await getVersionStatus({ home: opts.home || path.join(os.homedir(), '.claude'), offline: true });
  const health = runHealthCheck({ root, projectDir });
  const smoke = smokeCheck({ root, projectDir, mode: 'downstream' });
  const releaseReadiness = releaseReadinessSafe(root);
  const codeMap = showCodeMap({ root, projectDir, recordHistory: false });
  const docsDrift = validateDocsSafe(root);
  const trends = showProjectTrends({ root, projectDir, refresh: false });
  const bundle = {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    project_dir: projectDir,
    status: 'pass',
    privacy_boundary: 'Local support bundle. It summarizes local Forgeflow state and may include local paths; do not publish without reviewing/redacting for the target audience.',
    sections: {
      version: summarizeVersion(version),
      health: summarizeHealth(health, projectDir),
      smoke: summarizeSmoke(smoke),
      release_readiness: summarizeReadiness(releaseReadiness),
      code_map_acceptance: summarizeCodeMapAcceptance(codeMap),
      docs_drift: summarizeDocs(docsDrift),
      trends: summarizeTrends(trends),
    },
    next_actions: [],
    artifacts: {
      json: jsonOut,
      markdown: markdownOut,
    },
  };
  bundle.redaction_preview = redactionPreview(bundle);
  bundle.status = combineStatuses([
    bundle.sections.version.bundle_status,
    bundle.sections.health.status,
    bundle.sections.smoke.status,
    bundle.sections.release_readiness.status,
    bundle.sections.code_map_acceptance.status,
    bundle.sections.docs_drift.status,
    bundle.sections.trends.freshness,
  ]);
  bundle.next_actions = collectNextActions(bundle);
  fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
  writeFileSafe(jsonOut, `${JSON.stringify(bundle, null, 2)}\n`);
  writeFileSafe(markdownOut, renderMarkdown(bundle));
  return bundle;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const bundle = await buildSupportBundle(opts);
  if (opts.json) process.stdout.write(`${JSON.stringify(bundle, null, 2)}\n`);
  else process.stdout.write(renderMarkdown(bundle));
  if (bundle.status === 'fail' || bundle.status === 'blocked') process.exit(1);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = {
  buildSupportBundle,
  collectNextActions,
  combineStatuses,
  parseArgs,
  redactionPreview,
  renderMarkdown,
};
