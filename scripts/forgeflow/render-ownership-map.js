#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { isPathInside, safeReadTextFile, writeFileSafe, writeJsonSafe } = require('./file-safety');
const { helperGroupForSource } = require('./runtime-inventory');

function usage() {
  console.error('Usage: render-ownership-map.js [--root <dir>] [--project-dir <dir>] [--write] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', write: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--write') {
      opts.write = true;
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

function isoNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function normalizePath(value) {
  return String(value || '')
    .replace(/\s+\(\d+\s+signals?\)$/i, '')
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '');
}

function safeProjectDir(projectDir) {
  const resolved = path.resolve(projectDir);
  if (!fs.existsSync(resolved)) return resolved;
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) throw new Error(`Refusing symlinked project directory: ${projectDir}`);
  if (!stat.isDirectory()) throw new Error(`Project directory is not a directory: ${projectDir}`);
  return resolved;
}

function readJsonArtifact(file, projectDir, label, invalid) {
  if (!fs.existsSync(file)) return { label, status: 'missing', path: file, value: null };
  try {
    const parsed = JSON.parse(safeReadTextFile(file, projectDir).content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('expected JSON object');
    return { label, status: 'present', path: file, value: parsed };
  } catch (err) {
    invalid.push({ label, path: file, reason: err.message });
    return { label, status: 'invalid', path: file, value: null };
  }
}

function outputPath(projectDir, basename) {
  const file = path.join(projectDir, 'context', basename);
  const resolved = path.resolve(file);
  if (!isPathInside(path.resolve(projectDir), resolved)) throw new Error('Ownership output must stay inside --project-dir');
  return resolved;
}

function scoreSort(a, b) {
  return b.score - a.score || a.path.localeCompare(b.path);
}

function ownerSurface(file) {
  const rel = normalizePath(file);
  if (!rel) return 'unknown';
  if (rel.startsWith('commands/')) return 'command-wrapper';
  if (rel.startsWith('docs/') || rel === 'README.md') return 'docs';
  if (rel.startsWith('hooks/')) return 'hooks';
  if (rel.startsWith('templates/') || rel.startsWith('project-rules/') || rel.startsWith('forgeflow-patterns/')) return 'install-update-health';
  if (rel.startsWith('scripts/forgeflow/')) return helperGroupForSource(rel);
  if (rel.startsWith('.claude-plugin/') || rel.startsWith('docs/changelogs/') || rel.startsWith('docs/index.html')) return 'release-shipping';
  return 'unknown';
}

function surfaceLane(surface) {
  if (surface === 'docs') return 'Lumen';
  if (surface === 'release-shipping' || surface === 'install-update-health') return 'Compass';
  if (surface === 'agent-workflow' || surface === 'context-intelligence' || surface === 'learning-evidence') return 'Atlas';
  if (surface === 'review-auto' || surface === 'runtime-core' || surface === 'command-wrapper') return 'Smith';
  if (surface === 'hooks' || surface === 'privacy-boundary') return 'Warden';
  return 'Arbiter';
}

function surfaceReason(surface) {
  const reasons = {
    'command-wrapper': 'slash-command wrappers and argument forwarding contracts',
    'context-intelligence': 'context, topology, budget, and architecture intelligence helpers',
    docs: 'documentation and user-facing reference surfaces',
    'install-update-health': 'managed install, update, health, and runtime inventory surfaces',
    'release-shipping': 'release gates, changelog, smoke, and shipping evidence',
    'learning-evidence': 'learning rollups and project guidance evidence',
    'learning-recorders': 'local learning and outcome recording helpers',
    'user-profile': 'user and project preference guidance',
    'agent-workflow': 'agent routing, review, guidance, and workflow helpers',
    'runtime-core': 'shared low-level runtime helper behavior',
    hooks: 'Claude hook and statusline surfaces',
    unknown: 'no owner surface matched current path conventions',
  };
  return reasons[surface] || `${surface} owner surface`;
}

function codeownersCandidates(root) {
  return ['CODEOWNERS', '.github/CODEOWNERS', 'docs/CODEOWNERS']
    .map((rel) => path.join(root, rel));
}

function parseCodeowners(content) {
  const entries = [];
  const invalid = [];
  const lines = String(content || '').split(/\r?\n/);
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) {
      invalid.push({ line: index + 1, reason: 'missing-owner', text: trimmed });
      return;
    }
    entries.push({
      line: index + 1,
      pattern: parts[0],
      owners: parts.slice(1),
    });
  });
  return { entries, invalid };
}

function readCodeowners(root, invalid) {
  for (const file of codeownersCandidates(root)) {
    if (!fs.existsSync(file)) continue;
    try {
      const content = safeReadTextFile(file, root).content;
      const parsed = parseCodeowners(content);
      for (const item of parsed.invalid) invalid.push({ label: 'CODEOWNERS', path: file, reason: `line ${item.line}: ${item.reason}` });
      return {
        status: parsed.invalid.length > 0 ? 'attention' : 'present',
        path: file,
        entries: parsed.entries,
        invalid_entries: parsed.invalid,
      };
    } catch (err) {
      invalid.push({ label: 'CODEOWNERS', path: file, reason: err.message });
      return { status: 'invalid', path: file, entries: [], invalid_entries: [] };
    }
  }
  return { status: 'missing', path: '', entries: [], invalid_entries: [] };
}

function stripCodeownersPattern(pattern) {
  return normalizePath(String(pattern || '').replace(/^\//, '').replace(/\*.*$/, '').replace(/\/$/, ''));
}

function codeownersMatch(file, entry) {
  const rel = normalizePath(file);
  const pattern = normalizePath(entry.pattern || '');
  if (pattern === '*') return true;
  const stripped = stripCodeownersPattern(pattern);
  if (!stripped) return false;
  if (pattern.endsWith('/')) return rel.startsWith(stripped);
  if (pattern.includes('*')) return rel.startsWith(stripped);
  return rel === stripped || rel.startsWith(`${stripped}/`);
}

function codeownersFor(file, codeowners) {
  if (!codeowners || !Array.isArray(codeowners.entries)) return [];
  return codeowners.entries.filter((entry) => codeownersMatch(file, entry)).flatMap((entry) => entry.owners);
}

function topologyFiles(topology) {
  const files = []
    .concat(Array.isArray(topology.nodes) ? topology.nodes.map((item) => item.path || item.id || item) : [])
    .concat(Array.isArray(topology.high_fan_in) ? topology.high_fan_in.map((item) => item.path || item.file || item) : [])
    .concat(Array.isArray(topology.high_fan_out) ? topology.high_fan_out.map((item) => item.path || item.file || item) : [])
    .concat(Array.isArray(topology.changed_files) ? topology.changed_files : []);
  return [...new Set(files.map(normalizePath).filter(Boolean))];
}

function highCareFiles(model, topology) {
  const files = [];
  for (const item of model.high_care_files || []) {
    files.push({
      path: normalizePath(item.path || item.file || item),
      reason: item.reason || 'project operating model high-care file',
      score: 5,
    });
  }
  for (const item of topology.high_fan_in || []) {
    files.push({
      path: normalizePath(item.path || item.file || item),
      reason: `high fan-in ${item.fan_in || 0}`,
      score: 4,
    });
  }
  for (const item of topology.high_fan_out || []) {
    files.push({
      path: normalizePath(item.path || item.file || item),
      reason: `high fan-out ${item.fan_out || 0}`,
      score: 3,
    });
  }
  const byPath = new Map();
  for (const file of files) {
    if (!file.path) continue;
    const current = byPath.get(file.path) || { path: file.path, reasons: [], score: 0 };
    current.reasons.push(file.reason);
    current.score += file.score;
    byPath.set(file.path, current);
  }
  return [...byPath.values()].sort(scoreSort).slice(0, 20);
}

function buildSurfaces(files, highCare, codeowners) {
  const surfaces = new Map();
  for (const file of [...new Set((files || []).map(normalizePath).filter(Boolean))]) {
    const surface = ownerSurface(file);
    if (!surfaces.has(surface)) {
      surfaces.set(surface, {
        surface,
        recommended_lane: surfaceLane(surface),
        reason: surfaceReason(surface),
        file_count: 0,
        hotspot_count: 0,
        codeowners_covered: 0,
        example_files: [],
      });
    }
    const entry = surfaces.get(surface);
    entry.file_count += 1;
    if (entry.example_files.length < 6) entry.example_files.push(file);
    if (codeownersFor(file, codeowners).length > 0) entry.codeowners_covered += 1;
  }
  const highCareSet = new Set(highCare.map((item) => item.path));
  for (const file of highCareSet) {
    const surface = ownerSurface(file);
    if (!surfaces.has(surface)) {
      surfaces.set(surface, {
        surface,
        recommended_lane: surfaceLane(surface),
        reason: surfaceReason(surface),
        file_count: 0,
        hotspot_count: 0,
        codeowners_covered: 0,
        example_files: [],
      });
    }
    surfaces.get(surface).hotspot_count += 1;
  }
  return [...surfaces.values()]
    .map((item) => ({
      ...item,
      coverage_status: item.file_count === 0 ? 'unknown' : (item.codeowners_covered === item.file_count ? 'covered' : (item.codeowners_covered > 0 ? 'partial' : 'uncovered')),
    }))
    .sort((a, b) => b.hotspot_count - a.hotspot_count || b.file_count - a.file_count || a.surface.localeCompare(b.surface));
}

function renderOwnershipMap(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = safeProjectDir(opts.projectDir || defaultProjectDir(root));
  const invalid = [];
  const topologySource = readJsonArtifact(path.join(projectDir, 'context', 'latest', 'code-topology.json'), projectDir, 'code-topology', invalid);
  const modelSource = readJsonArtifact(path.join(projectDir, 'context', 'project-operating-model.json'), projectDir, 'project-operating-model', invalid);
  const architectureSource = readJsonArtifact(path.join(projectDir, 'context', 'architecture.json'), projectDir, 'architecture', invalid);
  const codeowners = readCodeowners(root, invalid);
  const topology = topologySource.value || {};
  const model = modelSource.value || {};
  const files = topologyFiles(topology);
  const highCare = highCareFiles(model, topology);
  const surfaces = buildSurfaces(files.concat(highCare.map((item) => item.path)), highCare, codeowners);
  const highCareWithOwners = highCare.map((item) => {
    const owners = codeownersFor(item.path, codeowners);
    return {
      ...item,
      owner_surface: ownerSurface(item.path),
      recommended_lane: surfaceLane(ownerSurface(item.path)),
      codeowners: owners,
      coverage_status: owners.length > 0 ? 'covered' : 'uncovered',
    };
  });
  const coverageGaps = highCareWithOwners
    .filter((item) => item.coverage_status !== 'covered')
    .slice(0, 12)
    .map((item) => ({
      path: item.path,
      owner_surface: item.owner_surface,
      recommended_lane: item.recommended_lane,
      reason: item.reasons.join('; '),
    }));
  const sources = [topologySource, modelSource, architectureSource];
  const status = invalid.length > 0 ? 'attention' : (files.length > 0 || highCare.length > 0 ? 'ready' : 'empty');
  const result = {
    schema_version: '1',
    generated_at: isoNow(),
    status,
    root,
    project_dir: projectDir,
    sources: sources.map((source) => ({ label: source.label, status: source.status, path: source.path })),
    codeowners: {
      status: codeowners.status,
      path: codeowners.path,
      entries: codeowners.entries,
      invalid_entries: codeowners.invalid_entries,
    },
    summary: {
      files_considered: files.length,
      high_care_files: highCare.length,
      owner_surfaces: surfaces.length,
      codeowners_entries: codeowners.entries.length,
      uncovered_high_care_files: coverageGaps.length,
    },
    owner_surfaces: surfaces,
    high_care_files: highCareWithOwners,
    coverage_gaps: coverageGaps,
    invalid_artifacts: invalid.map((item) => ({ label: item.label, path: item.path, reason: item.reason })),
    artifacts: {
      markdown: outputPath(projectDir, 'ownership-map.md'),
      json: outputPath(projectDir, 'ownership-map.json'),
    },
    next: '/forgeflow-architecture --write',
    next_reason: 'Refresh architecture evidence before using ownership hints for broad review routing.',
    boundary: 'Ownership map is advisory. It does not edit CODEOWNERS, call GitHub, assign reviewers, infer permissions, commit, push, or claim approval.',
  };
  if (opts.write) {
    writeFileSafe(result.artifacts.markdown, renderMarkdown(result));
    writeJsonSafe(result.artifacts.json, result);
  }
  return result;
}

function list(items, render) {
  if (!items || items.length === 0) return ['- None found in current evidence.'];
  return items.map(render);
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Ownership Map',
    '',
    `Generated at: ${result.generated_at}`,
    `Status: ${result.status}`,
    '',
    result.boundary,
    '',
    '## Summary',
    '',
    `- Files considered: ${result.summary.files_considered}`,
    `- High-care files: ${result.summary.high_care_files}`,
    `- Owner surfaces: ${result.summary.owner_surfaces}`,
    `- CODEOWNERS entries: ${result.summary.codeowners_entries}`,
    `- Uncovered high-care files: ${result.summary.uncovered_high_care_files}`,
    '',
    '## CODEOWNERS',
    '',
    `- Status: ${result.codeowners.status}`,
    `- Path: ${result.codeowners.path || 'none'}`,
    '',
    '## Owner Surfaces',
    '',
  ];
  lines.push(...list(result.owner_surfaces, (item) => `- ${item.surface}: ${item.recommended_lane}; ${item.file_count} file(s), ${item.hotspot_count} hotspot(s), ${item.coverage_status}; ${item.reason}`));
  lines.push('', '## High-Care Files', '');
  lines.push(...list(result.high_care_files, (item) => `- ${item.path}: ${item.recommended_lane}/${item.owner_surface}; ${item.coverage_status}; ${item.reasons.join('; ')}`));
  lines.push('', '## Coverage Gaps', '');
  lines.push(...list(result.coverage_gaps, (item) => `- ${item.path}: recommend ${item.recommended_lane}/${item.owner_surface}; ${item.reason}`));
  if (result.invalid_artifacts.length > 0) {
    lines.push('', '## Invalid Artifacts', '');
    lines.push(...result.invalid_artifacts.map((item) => `- ${item.label}: ${item.reason} (${item.path})`));
  }
  lines.push('', '## Next', '', result.next, '', result.next_reason, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = renderOwnershipMap(opts);
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
  codeownersFor,
  ownerSurface,
  parseArgs,
  parseCodeowners,
  renderMarkdown,
  renderOwnershipMap,
};
