#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildProjectIntelligence } = require('./build-project-intelligence');
const { assertSafeDirectory, safeReadTextFile, writeFileSafe } = require('./file-safety');

function usage() {
  console.error('Usage: build-project-operating-model.js [--root <dir>] [--project-dir <dir>] [--out <path>] [--json] [--refresh]');
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
  if (!value || value.startsWith('--')) argumentError(`Missing value for ${name}`, exitOnError);
  return value;
}

function parseArgs(argv, options = {}) {
  const exitOnError = options.exitOnError !== false;
  const opts = {
    root: process.cwd(),
    projectDir: '',
    out: '',
    json: false,
    refresh: false,
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
    } else if (arg === '--refresh') {
      opts.refresh = true;
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
  return path.join(projectDir, 'context', 'project-operating-model.json');
}

function markdownOutFor(jsonOut) {
  return /\.json$/i.test(jsonOut) ? jsonOut.replace(/\.json$/i, '.md') : `${jsonOut}.md`;
}

function readJson(file, root) {
  if (!file || !fs.existsSync(file)) return null;
  try {
    return JSON.parse(safeReadTextFile(file, root).content);
  } catch (_err) {
    return null;
  }
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function trimText(value) {
  if (value && typeof value === 'object') {
    return trimText(value.summary || value.text || value.title || value.path || value.file || value.name || JSON.stringify(value));
  }
  return String(value || '').replace(/^-\s+/, '').trim();
}

function uniqueTop(items, limit = 6) {
  const seen = new Set();
  const result = [];
  for (const item of items || []) {
    const value = trimText(item);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
    if (result.length >= limit) break;
  }
  return result;
}

function fileFromHotspot(item) {
  if (!item) return '';
  if (typeof item === 'string') return normalizePath(item);
  return normalizePath(item.path || item.file || item.source || item.id || '');
}

function domainName(file) {
  const normalized = normalizePath(file);
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) return 'project';
  if (parts[0] === 'apps' && parts[1]) return `apps/${parts[1]}`;
  if (parts[0] === 'packages' && parts[1]) return `packages/${parts[1]}`;
  if (parts[0] === 'services' && parts[1]) return `services/${parts[1]}`;
  if (parts[0] === 'scripts' && parts[1]) return `scripts/${parts[1]}`;
  if (parts[0] === 'commands') return 'commands';
  if (parts[0] === 'docs') return 'docs';
  return parts[0];
}

function countDomains(files) {
  const counts = new Map();
  for (const file of files || []) {
    const name = domainName(file);
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([name, file_count]) => ({
      name,
      file_count,
      confidence: file_count >= 3 ? 'medium' : 'low',
      source: 'code-topology',
    }));
}

function topologyFiles(topology) {
  const fromEdges = []
    .concat(topology && Array.isArray(topology.local_edges) ? topology.local_edges.map((edge) => edge.source) : [])
    .concat(topology && Array.isArray(topology.edges) ? topology.edges.map((edge) => edge.source) : []);
  const fromHotspots = []
    .concat(topology && Array.isArray(topology.high_fan_in) ? topology.high_fan_in.map(fileFromHotspot) : [])
    .concat(topology && Array.isArray(topology.high_fan_out) ? topology.high_fan_out.map(fileFromHotspot) : [])
    .concat(topology && Array.isArray(topology.changed_files) ? topology.changed_files.map(fileFromHotspot) : []);
  return uniqueTop([...fromEdges, ...fromHotspots], 200);
}

function highCareFiles(intelligence, topology) {
  const hotFiles = uniqueTop(intelligence.hot_files || [], 8).map((file) => ({
    path: file,
    reason: 'project-learnings hot file',
    confidence: 'medium',
  }));
  const fanIn = uniqueTop((topology && topology.high_fan_in) || [], 8).map((file) => ({
    path: file,
    reason: 'high fan-in; many files depend on it',
    confidence: 'medium',
  }));
  const fanOut = uniqueTop((topology && topology.high_fan_out) || [], 5).map((file) => ({
    path: file,
    reason: 'high fan-out; depends on many files',
    confidence: 'low',
  }));
  const byPath = new Map();
  for (const item of [...hotFiles, ...fanIn, ...fanOut]) {
    if (!item.path || byPath.has(item.path)) continue;
    byPath.set(item.path, item);
  }
  return [...byPath.values()].slice(0, 10);
}

function validationModel(intelligence) {
  return uniqueTop([
    ...(intelligence.validation_patterns || []),
    ...((intelligence.review_prep || {}).validate_first || []),
  ], 8).map((command_or_pattern) => ({
    command_or_pattern,
    source: 'project-intelligence',
    confidence: 'medium',
  }));
}

function riskZones(intelligence) {
  return ((intelligence.top_risks || []).slice(0, 8)).map((risk) => ({
    source: risk.source || 'project-intelligence',
    severity: risk.severity || 'attention',
    summary: trimText(risk.summary || risk.why || risk.title),
    next_action: risk.next_action || '',
    confidence: risk.confidence ? risk.confidence.band || 'medium' : 'medium',
  })).filter((risk) => risk.summary);
}

function agentGuidance(intelligence) {
  const brief = intelligence.next_work_brief || {};
  const prep = intelligence.review_prep || {};
  return {
    read_first: uniqueTop([...(brief.read_first || []), ...(prep.read_first || [])], 8),
    avoid_first: uniqueTop(brief.avoid_first || [], 8),
    validate_first: uniqueTop([...(brief.validate_first || []), ...(prep.validate_first || [])], 8),
    proof_boundary: uniqueTop(brief.proof_boundary || [], 6),
  };
}

function operatingPreferences(intelligence) {
  const profile = intelligence.user_profile || {};
  return {
    status: profile.status || 'missing',
    injected: Boolean(profile.injected),
    records: Number.isInteger(profile.records) ? profile.records : 0,
    suggestion_count: Number.isInteger(profile.suggestion_count) ? profile.suggestion_count : 0,
    conflict_count: Number.isInteger(profile.conflict_count) ? profile.conflict_count : 0,
    boundary: 'User preferences are advisory. Current user instructions and current project evidence take precedence.',
  };
}

function confidenceFor(intelligence, topology) {
  if ((intelligence.readiness || {}).state === 'blocked' || intelligence.trust_state === 'blocked') {
    return { band: 'low', reason: 'Project intelligence is blocked or untrusted.' };
  }
  if (!topology) return { band: 'low', reason: 'Code topology artifact is missing.' };
  if (intelligence.trust_state === 'current' && (intelligence.readiness || {}).state === 'ready') {
    return { band: 'high', reason: 'Project intelligence is current and ready.' };
  }
  return { band: 'medium', reason: 'Project intelligence is usable with advisory attention items.' };
}

function buildProjectOperatingModel(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  assertSafeDirectory(projectDir);
  const jsonOut = path.resolve(opts.out || defaultJsonOut(projectDir));
  const markdownOut = markdownOutFor(jsonOut);
  const intelligence = opts.intelligence || buildProjectIntelligence({
    root,
    projectDir,
    refresh: Boolean(opts.refresh),
  });
  const topologyPath = (intelligence.artifacts || {}).code_topology || path.join(projectDir, 'context', 'code-topology.json');
  const topology = Object.prototype.hasOwnProperty.call(opts, 'topology')
    ? opts.topology
    : readJson(topologyPath, projectDir);
  const files = topologyFiles(topology || {});
  const guidance = agentGuidance(intelligence);
  const model = {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    project_dir: projectDir,
    status: topology ? 'ready' : 'attention',
    confidence: confidenceFor(intelligence, topology),
    project_state: {
      trust_state: intelligence.trust_state || 'unknown',
      readiness: (intelligence.readiness || {}).state || 'unknown',
      freshness: intelligence.freshness || {},
    },
    domains: countDomains(files),
    high_care_files: highCareFiles(intelligence, topology || {}),
    risk_zones: riskZones(intelligence),
    validation_model: validationModel(intelligence),
    operating_preferences: operatingPreferences(intelligence),
    agent_guidance: guidance,
    review_policy_hints: {
      auto_fix_boundary: 'Do not auto-fix high-care, security, auth, permission, migration, dependency, release, settings, secret, or broad behavior changes without explicit human approval.',
      sandbox_prerequisite: 'Review auto-fix proposals should validate in an isolated sandbox before mutating the source checkout.',
      verify_first: guidance.validate_first,
    },
    artifacts: {
      json: jsonOut,
      markdown: markdownOut,
      project_intelligence: (intelligence.artifacts || {}).json || '',
      code_topology: topologyPath,
      project_learnings: (intelligence.artifacts || {}).project_learnings || '',
      latest_insights_report: (intelligence.artifacts || {}).latest_insights_report || '',
    },
    provenance: {
      git: (intelligence.provenance || {}).git || {},
      sources: [
        'project-intelligence',
        topology ? 'code-topology' : 'code-topology-missing',
        'project-learnings',
        'review-outcomes',
        'user-profile',
      ],
    },
    boundary: 'Project operating model is advisory only. Verify every decision against current code, tests, user intent, and review artifacts before acting.',
  };
  writeFileSafe(jsonOut, `${JSON.stringify(model, null, 2)}\n`);
  writeFileSafe(markdownOut, renderMarkdown(model));
  return model;
}

function renderList(lines, items, fallback, formatter = (item) => `- ${item}`) {
  if (!items || items.length === 0) {
    lines.push(`- ${fallback}`);
    return;
  }
  for (const item of items) lines.push(formatter(item));
}

function renderMarkdown(model) {
  const lines = [
    '# Forgeflow Project Operating Model',
    '',
    `Generated at: ${model.generated_at}`,
    `Status: ${model.status}`,
    `Confidence: ${model.confidence.band} - ${model.confidence.reason}`,
    `Readiness: ${model.project_state.readiness}`,
    `Trust state: ${model.project_state.trust_state}`,
    '',
    model.boundary,
    '',
    '## Domains',
    '',
  ];
  renderList(lines, model.domains, 'No domains inferred from local topology yet.', (item) => `- ${item.name}: ${item.file_count} file signal(s), confidence ${item.confidence}`);
  lines.push('', '## High-Care Files', '');
  renderList(lines, model.high_care_files, 'No high-care files found in current artifacts.', (item) => `- ${item.path}: ${item.reason} (${item.confidence})`);
  lines.push('', '## Risk Zones', '');
  renderList(lines, model.risk_zones, 'No current risk zones found.', (item) => `- ${item.severity} ${item.source}: ${item.summary}${item.next_action ? ` Next: ${item.next_action}` : ''}`);
  lines.push('', '## Validation Model', '');
  renderList(lines, model.validation_model, 'Define focused validation before implementation.', (item) => `- ${item.command_or_pattern} (${item.confidence})`);
  lines.push('', '## Operating Preferences', '');
  lines.push(`- Status: ${model.operating_preferences.status}`);
  lines.push(`- Injected: ${model.operating_preferences.injected}`);
  lines.push(`- Records: ${model.operating_preferences.records}`);
  lines.push(`- Boundary: ${model.operating_preferences.boundary}`);
  lines.push('', '## Agent Guidance', '', '### Read First', '');
  renderList(lines, model.agent_guidance.read_first, 'Inspect current code and local project intelligence before editing.');
  lines.push('', '### Avoid First', '');
  renderList(lines, model.agent_guidance.avoid_first, 'Avoid broad refactors until current evidence supports them.');
  lines.push('', '### Validate First', '');
  renderList(lines, model.agent_guidance.validate_first, 'Run focused validation, then full validation.');
  lines.push('', '### Proof Boundary', '');
  renderList(lines, model.agent_guidance.proof_boundary, 'Orientation only; verify against current code, tests, and review output.');
  lines.push('', '## Review Policy Hints', '');
  lines.push(`- Auto-fix boundary: ${model.review_policy_hints.auto_fix_boundary}`);
  lines.push(`- Sandbox prerequisite: ${model.review_policy_hints.sandbox_prerequisite}`);
  lines.push('', '## Sources', '');
  for (const source of model.provenance.sources) lines.push(`- ${source}`);
  lines.push('', '## Artifacts', '');
  lines.push(`- JSON: ${model.artifacts.json}`);
  lines.push(`- Markdown: ${model.artifacts.markdown}`);
  lines.push(`- Project intelligence: ${model.artifacts.project_intelligence || '(missing)'}`);
  lines.push(`- Code topology: ${model.artifacts.code_topology || '(missing)'}`);
  return `${lines.join('\n')}\n`;
}

function compactProjectOperatingModel(model, maxChars = 3200) {
  if (!model) return '(none)';
  const lines = [
    `Artifact: ${model.artifacts ? model.artifacts.json : '(missing)'}`,
    `Status: ${model.status || 'unknown'}`,
    `Confidence: ${model.confidence ? `${model.confidence.band} - ${model.confidence.reason}` : 'unknown'}`,
    `Readiness: ${model.project_state ? model.project_state.readiness : 'unknown'}`,
    '',
    'High-care files:',
    ...renderCompactItems(model.high_care_files, (item) => `- ${md(item.path)}: ${md(item.reason)} (${md(item.confidence)})`),
    '',
    'Read first:',
    ...renderCompactItems(model.agent_guidance ? model.agent_guidance.read_first : [], (item) => `- ${md(item)}`),
    '',
    'Avoid first:',
    ...renderCompactItems(model.agent_guidance ? model.agent_guidance.avoid_first : [], (item) => `- ${md(item)}`),
    '',
    'Validate first:',
    ...renderCompactItems(model.agent_guidance ? model.agent_guidance.validate_first : [], (item) => `- ${md(item)}`),
    '',
    'Proof boundary:',
    ...renderCompactItems(model.agent_guidance ? model.agent_guidance.proof_boundary : [], (item) => `- ${md(item)}`),
    '',
    'Review policy:',
    `- ${md(model.review_policy_hints ? model.review_policy_hints.auto_fix_boundary : 'Do not auto-fix broad or high-risk changes without explicit human approval.')}`,
    `- ${md(model.review_policy_hints ? model.review_policy_hints.sandbox_prerequisite : 'Validate proposals in an isolated sandbox before mutating the source checkout.')}`,
    '',
    'Boundary: advisory only; verify against current code, tests, user intent, and review artifacts before acting.',
  ];
  return truncate(lines.join('\n'), maxChars);
}

function renderCompactItems(items, formatter, limit = 5) {
  const selected = (items || []).slice(0, limit);
  return selected.length > 0 ? selected.map(formatter) : ['- (none)'];
}

function md(value) {
  return String(value || '').replace(/([\\`*_{}\[\]()#+\-.!|>])/g, '\\$&');
}

function truncate(text, maxChars) {
  if (!Number.isFinite(maxChars) || maxChars <= 0 || text.length <= maxChars) return text;
  const limit = Math.max(0, maxChars - 80);
  const clipped = text.slice(0, limit);
  const lineEnd = clipped.lastIndexOf('\n');
  const boundary = lineEnd > Math.floor(limit * 0.7) ? lineEnd : limit;
  return `${clipped.slice(0, boundary).trimEnd()}\n\n[truncated to ${maxChars} chars]`;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const model = buildProjectOperatingModel(opts);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(model, null, 2)}\n`);
  } else {
    process.stdout.write(renderMarkdown(model));
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
  buildProjectOperatingModel,
  compactProjectOperatingModel,
  countDomains,
  defaultJsonOut,
  defaultProjectDir,
  domainName,
  parseArgs,
  renderMarkdown,
};
