#!/usr/bin/env node
const path = require('path');
const { showProjectTrends } = require('./show-project-trends');

function usage() {
  console.error('Usage: render-stale-artifact-plan.js [--root <repo>] [--project-dir <dir>] [--json]');
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') opts.root = path.resolve(argv[++i] || '');
    else if (arg === '--project-dir') opts.projectDir = path.resolve(argv[++i] || '');
    else if (arg === '--json') opts.json = true;
    else if (arg === '--help' || arg === '-h') {
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

function buildStaleArtifactPlan(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const trends = showProjectTrends({ root, projectDir });
  const issues = [
    ...((trends.freshness && trends.freshness.issues) || []),
    ...((trends.latest_insights && trends.latest_insights.freshness && trends.latest_insights.freshness.issues) || []),
    ...((trends.failure_digest && trends.failure_digest.freshness && trends.failure_digest.freshness.issues) || []),
  ];
  const commands = [];
  if (issues.some((issue) => /code-map|latest-insights|project-guidance/i.test(issue.code || issue.message || ''))) commands.push('forgeflow-trends --refresh');
  if (trends.failure_digest && trends.failure_digest.status === 'missing') commands.push('forgeflow-failure-digest');
  if (trends.advisor && trends.advisor.recommendation_actions && trends.advisor.recommendation_actions.includes('trim-budget-violation')) commands.push('forgeflow-context-wave-plan');
  return {
    schema_version: '1',
    status: issues.length ? 'refresh-needed' : 'current',
    root,
    project_dir: projectDir,
    issues,
    commands: [...new Set(commands)],
    next: commands[0] || 'No refresh needed.',
    next_reason: issues.length ? 'One or more local guidance artifacts are stale, missing, or over budget.' : 'Local guidance artifacts are current.',
    boundary: 'Stale artifact plan is read-only. It reports minimal refresh commands but does not refresh, delete, archive, commit, or push.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Stale Artifact Plan',
    '',
    `Status: ${result.status}`,
    '',
    result.boundary,
    '',
    '## Issues',
    '',
    ...(result.issues.length ? result.issues.map((issue) => `- ${issue.code || 'issue'}: ${issue.message || issue.severity || ''}`) : ['- None.']),
    '',
    '## Minimal Commands',
    '',
    ...(result.commands.length ? result.commands.map((cmd) => `- ${cmd}`) : ['- None.']),
    '',
    `Next: ${result.next}`,
    `Why: ${result.next_reason}`,
    '',
  ];
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildStaleArtifactPlan(opts);
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

module.exports = { buildStaleArtifactPlan, parseArgs, renderMarkdown };
