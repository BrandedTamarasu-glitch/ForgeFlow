#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { assertSafeDirectory, writeFileSafe } = require('./file-safety');
const { showProjectLearnings } = require('./show-project-learnings');
const { showProjectTrends } = require('./show-project-trends');

function usage() {
  console.error('Usage: build-project-intelligence.js [--root <dir>] [--project-dir <dir>] [--out <path>] [--json]');
}

function argumentError(message, exitOnError) {
  if (exitOnError) {
    console.error(message);
    usage();
    process.exit(2);
  }
  const err = new Error(message);
  err.exitCode = 2;
  throw err;
}

function requireValue(argv, name, index, exitOnError = true) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) {
    argumentError(`Missing value for ${name}`, exitOnError);
  }
  return value;
}

function parseArgs(argv, options = {}) {
  const exitOnError = options.exitOnError !== false;
  const opts = {
    root: process.cwd(),
    projectDir: '',
    out: '',
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i, exitOnError));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i, exitOnError));
      i += 1;
    } else if (arg === '--out') {
      opts.out = path.resolve(requireValue(argv, arg, i, exitOnError));
      i += 1;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      if (exitOnError) process.exit(0);
      return opts;
    } else {
      argumentError(`Unknown argument: ${arg}`, exitOnError);
    }
  }
  return opts;
}

function defaultProjectDir(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function defaultJsonOut(projectDir) {
  return path.join(projectDir, 'context', 'project-intelligence-rollup.json');
}

function markdownOutFor(jsonOut) {
  return /\.json$/i.test(jsonOut) ? jsonOut.replace(/\.json$/i, '.md') : `${jsonOut}.md`;
}

function trimBullet(value) {
  if (value && typeof value === 'object') {
    return trimBullet(value.text || value.summary || value.name || value.path || JSON.stringify(value));
  }
  return String(value || '').replace(/^-\s+/, '').trim();
}

function topItems(items, limit = 5) {
  return (items || []).map(trimBullet).filter(Boolean).slice(0, limit);
}

function addIssue(out, severity, source, summary, nextAction = '') {
  if (!summary) return;
  out.push({ severity, source, summary, next_action: nextAction });
}

function freshnessIssues(trends) {
  const issues = [];
  for (const issue of (trends.freshness && trends.freshness.issues) || []) {
    addIssue(issues, issue.severity || 'attention', 'project-freshness', issue.message || issue.code, 'forgeflow-trends --refresh');
  }
  for (const issue of (trends.latest_insights && trends.latest_insights.freshness && trends.latest_insights.freshness.issues) || []) {
    addIssue(issues, issue.severity || 'attention', 'latest-insights', issue.message || issue.code, 'forgeflow-trends --refresh');
  }
  for (const issue of (trends.failure_digest && trends.failure_digest.freshness && trends.failure_digest.freshness.issues) || []) {
    addIssue(issues, issue.severity || 'attention', 'failure-digest', issue.message || issue.code, 'forgeflow-failure-digest');
  }
  return issues;
}

function riskSignals(trends, learnings) {
  const risks = [...freshnessIssues(trends)];
  const importGaps = trends.import_gaps || {};
  if (importGaps.status === 'attention') {
    addIssue(
      risks,
      'attention',
      'import-gaps',
      `${importGaps.production_total || 0} production-scope import gap(s) need review.`,
      'forgeflow-code-map'
    );
  }
  const digest = trends.failure_digest || {};
  if (digest.triage && digest.triage.state && !['usable', 'missing'].includes(digest.triage.state)) {
    addIssue(
      risks,
      digest.triage.state === 'raw-required' ? 'high' : 'attention',
      'failure-digest',
      digest.triage.reason || `Failure digest state is ${digest.triage.state}.`,
      digest.triage.next_action ? digest.triage.next_action.command || digest.triage.next_action.action : 'forgeflow-failure-digest'
    );
  }
  for (const item of (trends.advisor && trends.advisor.recommendations) || []) {
    if (item.severity === 'info') continue;
    addIssue(risks, item.severity || 'attention', 'context-advisor', item.reason, item.command);
  }
  for (const item of topItems(learnings.risk_areas, 3)) {
    addIssue(risks, 'attention', 'project-learnings', item, 'inspect project-learnings.md');
  }
  return risks.slice(0, 8);
}

function trustState(trends, learnings, risks) {
  const latest = trends.latest_insights || {};
  const freshness = trends.freshness || {};
  const learningCheck = learnings.check || {};
  const latestGate = latest.check_status || '';
  const highRisk = risks.some((item) => item.severity === 'high' || item.severity === 'fail');
  if (highRisk || learningCheck.status === 'fail' || latestGate === 'fail') return 'blocked';
  if (
    freshness.status === 'current'
    && latest.status === 'injected'
    && (!latestGate || latestGate === 'pass')
    && (!latest.freshness || latest.freshness.status === 'current')
    && learningCheck.status === 'pass'
    && risks.length === 0
  ) {
    return 'current';
  }
  return 'attention';
}

function buildProjectIntelligence(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  assertSafeDirectory(projectDir);
  const jsonOut = path.resolve(opts.out || defaultJsonOut(projectDir));
  const markdownOut = markdownOutFor(jsonOut);
  const learnings = showProjectLearnings({ root, projectDir, refreshCodeMap: false, check: true });
  const trends = showProjectTrends({ root, projectDir, refresh: Boolean(opts.refresh) });
  const risks = riskSignals(trends, learnings);
  const intelligence = {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    project_dir: projectDir,
    trust_state: trustState(trends, learnings, risks),
    freshness: {
      project: trends.freshness ? trends.freshness.status : 'missing',
      latest_insights: trends.latest_insights && trends.latest_insights.freshness ? trends.latest_insights.freshness.status : 'missing',
      failure_digest: trends.failure_digest && trends.failure_digest.freshness ? trends.failure_digest.freshness.status : 'not-applicable',
    },
    guidance: {
      latest_insights_status: trends.latest_insights ? trends.latest_insights.status : 'missing',
      latest_insights_gate: trends.latest_insights ? trends.latest_insights.check_status || '' : '',
      project_learnings_gate: learnings.check ? learnings.check.status : 'missing',
      project_learnings_present: Boolean(learnings.out && fs.existsSync(learnings.out)),
      consumed_code_map_trend: Boolean(learnings.sources && learnings.sources.code_map_trend === 'compared'),
    },
    top_risks: risks,
    hot_files: topItems(learnings.hot_files_and_modules, 8),
    recommended_next_actions: topItems(learnings.recommended_approach_for_next_work, 8),
    validation_patterns: topItems(learnings.validation_patterns, 5),
    recommendations: trends.recommendations || [],
    artifacts: {
      json: jsonOut,
      markdown: markdownOut,
      project_learnings: learnings.out || '',
      code_map_history: trends.paths ? trends.paths.code_map_history : null,
      code_topology: path.join(projectDir, 'context', 'code-topology.json'),
      failure_digest: trends.paths ? trends.paths.failure_digest : null,
      latest_insights_report: trends.paths ? trends.paths.latest_insights_report : null,
    },
  };
  fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
  writeFileSafe(jsonOut, `${JSON.stringify(intelligence, null, 2)}\n`);
  writeFileSafe(markdownOut, renderMarkdown(intelligence));
  return intelligence;
}

function renderMarkdown(intelligence) {
  const lines = [
    '# Forgeflow Project Intelligence',
    '',
    `Generated at: ${intelligence.generated_at}`,
    `Trust state: ${intelligence.trust_state}`,
    '',
    'This is a synthesis of local Forgeflow artifacts, not a source of truth. Verify decisions against the raw artifacts, current code, and current validation output.',
    '',
    '## Freshness',
    '',
    `- Project guidance: ${intelligence.freshness.project}`,
    `- Latest insights: ${intelligence.freshness.latest_insights}`,
    `- Failure digest: ${intelligence.freshness.failure_digest}`,
    '',
    '## Top Risks',
    '',
  ];
  if (intelligence.top_risks.length === 0) {
    lines.push('- (none)');
  } else {
    for (const risk of intelligence.top_risks) {
      lines.push(`- ${risk.severity}: ${risk.source} - ${risk.summary}`);
      if (risk.next_action) lines.push(`  - Next: ${risk.next_action}`);
    }
  }
  lines.push('', '## Hot Files', '', ...(intelligence.hot_files.length > 0 ? intelligence.hot_files.map((item) => `- ${item}`) : ['- (none)']));
  lines.push('', '## Recommended Next Actions', '', ...(intelligence.recommended_next_actions.length > 0 ? intelligence.recommended_next_actions.map((item) => `- ${item}`) : ['- (none)']));
  lines.push('', '## Validation Patterns', '', ...(intelligence.validation_patterns.length > 0 ? intelligence.validation_patterns.map((item) => `- ${item}`) : ['- (none)']));
  lines.push('', '## Sources', '');
  lines.push(`- Project learnings: ${intelligence.artifacts.project_learnings || '(missing)'}`);
  lines.push(`- Code map history: ${intelligence.artifacts.code_map_history || '(missing)'}`);
  lines.push(`- Code topology: ${intelligence.artifacts.code_topology || '(missing)'}`);
  lines.push(`- Latest insights report: ${intelligence.artifacts.latest_insights_report || '(missing)'}`);
  lines.push(`- Failure digest: ${intelligence.artifacts.failure_digest || '(missing)'}`);
  lines.push('', '## Artifacts', '', `- JSON: ${intelligence.artifacts.json}`, `- Markdown: ${intelligence.artifacts.markdown}`);
  return `${lines.join('\n')}\n`;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildProjectIntelligence(opts);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(renderMarkdown(result));
  }
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
  buildProjectIntelligence,
  parseArgs,
  renderMarkdown,
  riskSignals,
  trustState,
};
