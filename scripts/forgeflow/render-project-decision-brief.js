#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { safeReadTextFile } = require('./file-safety');
const { buildProjectHealthTimeline } = require('./show-project-health-timeline');

function usage() {
  console.error('Usage: render-project-decision-brief.js [--root <repo>] [--project-dir <dir>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
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

function readJson(file, root) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(safeReadTextFile(file, root).content);
}

function readText(file, root) {
  if (!fs.existsSync(file)) return '';
  return safeReadTextFile(file, root).content;
}

function firstMarkdownBullets(markdown, heading, limit = 3) {
  const lines = String(markdown || '').split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim().toLowerCase() === `## ${heading}`.toLowerCase());
  if (start === -1) return [];
  const bullets = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^##\s+/.test(line)) break;
    if (/^\s*-\s+/.test(line)) bullets.push(line.replace(/^\s*-\s+/, '').trim());
    if (bullets.length >= limit) break;
  }
  return bullets;
}

function topologySummary(topology) {
  if (!topology) return { status: 'missing', summary: 'No code topology artifact found.', hot_files: [] };
  const summary = topology.summary || {};
  const central = []
    .concat(topology.high_fan_in || [])
    .concat(topology.high_fan_out || [])
    .concat(topology.central_files || [])
    .concat(topology.hot_files || [])
    .filter(Boolean)
    .slice(0, 3)
    .map((item) => (typeof item === 'string' ? item : item.file || item.path || item.source || item.id || ''));
  return {
    status: 'present',
    summary: `${topology.source_files || summary.source_files || topology.file_count || 0} source files, ${topology.local_edges || summary.local_edges || topology.edge_count || 0} local edges.`,
    hot_files: central.filter(Boolean),
  };
}

function healthTimelineChanges(healthTimeline, limit = 3) {
  if (!healthTimeline || !Array.isArray(healthTimeline.events)) return [];
  return healthTimeline.events
    .slice(-limit)
    .reverse()
    .map((event) => {
      const status = event.status || event.health_status || event.result || 'observed';
      const label = event.command || event.source || event.name || event.type || 'health event';
      return `${status}: ${label}`;
    });
}

function topologyChanges(topology, limit = 3) {
  if (!topology) return [];
  const sectionEntries = topology.changed_sections && !Array.isArray(topology.changed_sections)
    ? Object.entries(topology.changed_sections)
      .flatMap(([file, sections]) => (Array.isArray(sections) ? sections : []).map((section) => ({
        file,
        name: section.name,
        line: section.line,
      })))
    : [];
  const changed = []
    .concat(sectionEntries)
    .concat(Array.isArray(topology.changed_sections) ? topology.changed_sections : [])
    .concat(Array.isArray(topology.changed_files) ? topology.changed_files : [])
    .concat(Array.isArray(topology.changed_work) ? topology.changed_work : []);
  return changed.slice(0, limit).map((item) => (
    typeof item === 'string' ? item : item.file || item.path || item.section || item.name || ''
  )).filter(Boolean);
}

function projectGuidance({ decisions, riskAreas, validationPatterns, topologyInfo, healthTimeline, topology }) {
  const recentChanges = healthTimelineChanges(healthTimeline);
  if (recentChanges.length === 0) {
    const topologyRecent = topologyChanges(topology);
    for (const item of topologyRecent) recentChanges.push(`changed: ${item}`);
  }
  return {
    read_first: decisions.length > 0
      ? decisions.slice(0, 3)
      : ['Read project learnings and latest insights before choosing the next change.'],
    avoid_first: riskAreas.length > 0
      ? riskAreas.slice(0, 3)
      : ['Avoid broad refactors until current project risks are refreshed.'],
    validate_first: validationPatterns.length > 0
      ? validationPatterns.slice(0, 3)
      : ['Define the focused validation command before implementation starts.'],
    care_files: topologyInfo.hot_files.length > 0
      ? topologyInfo.hot_files.slice(0, 3)
      : ['Run /forgeflow-code-map before touching shared modules.'],
    recent_changes: recentChanges.length > 0
      ? recentChanges
      : ['No recent health or topology changes found in local artifacts.'],
  };
}

function buildProjectDecisionBrief(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const learningsText = opts.learningsText ?? readText(path.join(projectDir, 'project-learnings.md'), projectDir);
  const latestInsights = opts.latestInsights || readJson(path.join(projectDir, 'context', 'latest', 'latest-insights-report.json'), projectDir);
  const topology = opts.topology || readJson(path.join(projectDir, 'context', 'code-topology.json'), projectDir);
  const healthTimeline = Object.prototype.hasOwnProperty.call(opts, 'healthTimeline')
    ? opts.healthTimeline
    : buildProjectHealthTimeline({ root, projectDir });
  const riskAreas = firstMarkdownBullets(learningsText, 'Risk Areas');
  const decisions = firstMarkdownBullets(learningsText, 'Stable Decisions');
  const validationPatterns = firstMarkdownBullets(learningsText, 'Validation Patterns');
  const topologyInfo = topologySummary(topology);
  const warnings = [];
  if (!learningsText) warnings.push('project-learnings-missing');
  if (!latestInsights) warnings.push('latest-insights-missing');
  if (!topology) warnings.push('code-topology-missing');
  if (!healthTimeline) warnings.push('health-timeline-missing');
  const guidance = projectGuidance({ decisions, riskAreas, validationPatterns, topologyInfo, healthTimeline, topology });
  const recommendations = [
    riskAreas[0] ? `Avoid repeating risk area: ${riskAreas[0]}` : 'Refresh project learnings before major planning.',
    validationPatterns[0] ? `Reuse validation pattern: ${validationPatterns[0]}` : 'Define validation before implementation starts.',
    topologyInfo.hot_files[0] ? `Treat ${topologyInfo.hot_files[0]} as a high-care module.` : 'Run /forgeflow-code-map before broad refactors.',
  ];
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    project_dir: projectDir,
    status: warnings.length > 0 ? 'attention' : 'ready',
    warnings,
    latest_insights_status: latestInsights ? (latestInsights.status || latestInsights.quality_status || 'present') : 'missing',
    topology: topologyInfo,
    health_timeline_status: healthTimeline ? (healthTimeline.status || 'present') : 'missing',
    health_timeline_events: healthTimeline && Array.isArray(healthTimeline.events) ? healthTimeline.events.length : 0,
    decisions,
    risk_areas: riskAreas,
    validation_patterns: validationPatterns,
    decision_brief: guidance,
    recent_changes: guidance.recent_changes,
    avoid_first: guidance.avoid_first,
    validate_first: guidance.validate_first,
    care_files: guidance.care_files,
    recommendations,
    next_command: warnings.length > 0 ? '/forgeflow-trends --refresh' : '/plan',
    next_reason: warnings.length > 0
      ? 'Refresh project intelligence before relying on this brief.'
      : 'Project intelligence is ready to shape the next work item.',
    boundary: 'Project decision brief is read-only. It summarizes existing local artifacts and does not refresh, write, promote, approve, commit, push, or call the network.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Project Decision Brief',
    '',
    `Status: ${result.status}`,
    `Latest insights: ${result.latest_insights_status}`,
    `Health timeline: ${result.health_timeline_status}`,
    `Topology: ${result.topology.status}`,
    '',
    result.boundary,
    '',
    '## Decisions',
    '',
  ];
  for (const item of result.decisions.length ? result.decisions : ['No stable decisions found.']) lines.push(`- ${item}`);
  lines.push('', '## Recent Changes', '');
  for (const item of result.recent_changes) lines.push(`- ${item}`);
  lines.push('', '## Risks', '');
  for (const item of result.risk_areas.length ? result.risk_areas : ['No risk areas found.']) lines.push(`- ${item}`);
  lines.push('', '## Avoid First', '');
  for (const item of result.avoid_first) lines.push(`- ${item}`);
  lines.push('', '## Validate First', '');
  for (const item of result.validate_first) lines.push(`- ${item}`);
  lines.push('', '## Care Files', '');
  for (const item of result.care_files) lines.push(`- ${item}`);
  lines.push('', '## Recommended Next Approach', '');
  for (const item of result.recommendations) lines.push(`- ${item}`);
  if (result.warnings.length > 0) {
    lines.push('', '## Warnings', '');
    for (const warning of result.warnings) lines.push(`- ${warning}`);
  }
  lines.push('', `Next: ${result.next_command}`, `Why: ${result.next_reason}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildProjectDecisionBrief(opts);
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

module.exports = {
  buildProjectDecisionBrief,
  firstMarkdownBullets,
  healthTimelineChanges,
  parseArgs,
  projectGuidance,
  renderMarkdown,
  topologyChanges,
  topologySummary,
};
