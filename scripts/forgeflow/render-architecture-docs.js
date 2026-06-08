#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { isPathInside, safeReadTextFile, writeFileSafe, writeJsonSafe } = require('./file-safety');

function usage() {
  console.error('Usage: render-architecture-docs.js [--root <dir>] [--project-dir <dir>] [--write] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = {
    root: process.cwd(),
    projectDir: '',
    write: false,
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
  return String(value || '').replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function text(value) {
  if (value && typeof value === 'object') {
    return text(value.path || value.file || value.name || value.summary || value.title || value.command_or_pattern || value.reason || JSON.stringify(value));
  }
  return String(value || '').trim();
}

function uniqueTop(items, limit) {
  const seen = new Set();
  const result = [];
  for (const item of items || []) {
    const value = text(item);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
    if (result.length >= limit) break;
  }
  return result;
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

function readTextArtifact(file, projectDir, label, invalid, maxChars = 1600) {
  if (!fs.existsSync(file)) return { label, status: 'missing', path: file, value: '' };
  try {
    return { label, status: 'present', path: file, value: safeReadTextFile(file, projectDir).content.slice(0, maxChars) };
  } catch (err) {
    invalid.push({ label, path: file, reason: err.message });
    return { label, status: 'invalid', path: file, value: '' };
  }
}

function sourceSummary(source) {
  return {
    label: source.label,
    status: source.status,
    path: source.path,
  };
}

function safeProjectDir(projectDir) {
  const resolved = path.resolve(projectDir);
  if (!fs.existsSync(resolved)) return resolved;
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) throw new Error(`Refusing symlinked project directory: ${projectDir}`);
  if (!stat.isDirectory()) throw new Error(`Project directory is not a directory: ${projectDir}`);
  return resolved;
}

function outputPath(projectDir, basename) {
  const file = path.join(projectDir, 'context', basename);
  const resolvedProject = path.resolve(projectDir);
  const resolved = path.resolve(file);
  if (!isPathInside(resolvedProject, resolved)) throw new Error('Architecture output must stay inside --project-dir');
  return resolved;
}

function domainFromPath(file) {
  const parts = normalizePath(file).split('/').filter(Boolean);
  if (parts.length === 0) return 'project';
  if (parts[0] === 'apps' && parts[1]) return `apps/${parts[1]}`;
  if (parts[0] === 'packages' && parts[1]) return `packages/${parts[1]}`;
  if (parts[0] === 'services' && parts[1]) return `services/${parts[1]}`;
  if (parts[0] === 'scripts' && parts[1]) return `scripts/${parts[1]}`;
  if (parts[0] === 'commands') return 'commands';
  if (parts[0] === 'docs') return 'docs';
  return parts[0];
}

function domainsFromTopology(topology, model) {
  if (Array.isArray(model?.domains) && model.domains.length > 0) {
    return model.domains.slice(0, 8).map((item) => ({
      name: text(item.name || item),
      file_count: Number(item.file_count || 0),
      source: item.source || 'project-operating-model',
      confidence: item.confidence || 'low',
    }));
  }
  const counts = new Map();
  const files = []
    .concat(Array.isArray(topology?.nodes) ? topology.nodes.map((item) => item.path || item.id || item) : [])
    .concat(Array.isArray(topology?.changed_files) ? topology.changed_files : []);
  for (const file of files) {
    const domain = domainFromPath(file);
    counts.set(domain, (counts.get(domain) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([name, file_count]) => ({ name, file_count, source: 'code-topology', confidence: file_count > 2 ? 'medium' : 'low' }));
}

function topologyHotspots(topology, model) {
  const fanIn = Array.isArray(topology?.high_fan_in) ? topology.high_fan_in.slice(0, 8) : [];
  const fanOut = Array.isArray(topology?.high_fan_out) ? topology.high_fan_out.slice(0, 8) : [];
  const highCare = Array.isArray(model?.high_care_files) ? model.high_care_files.slice(0, 10) : [];
  return {
    high_fan_in: fanIn.map((item) => ({
      path: normalizePath(item.path || item.file || item),
      fan_in: Number(item.fan_in || 0),
      why: 'many files depend on this module',
    })),
    high_fan_out: fanOut.map((item) => ({
      path: normalizePath(item.path || item.file || item),
      fan_out: Number(item.fan_out || 0),
      why: 'module depends on many files',
    })),
    high_care_files: highCare.map((item) => ({
      path: normalizePath(item.path || item.file || item),
      reason: text(item.reason || 'project operating model high-care file'),
      confidence: item.confidence || 'medium',
    })),
  };
}

function entrypointHints(topology) {
  const paths = []
    .concat(Array.isArray(topology?.nodes) ? topology.nodes.map((item) => normalizePath(item.path || item.id || item)) : [])
    .concat(Array.isArray(topology?.markdown_sections) ? topology.markdown_sections.map((item) => normalizePath(item.path || item.file || item)) : []);
  const candidates = paths.filter((file) => (
    /(^|\/)(index|main|cli|server|app|route|routes|command|commands)\.[cm]?[jt]sx?$/.test(file)
    || /^commands\/.+\.md$/.test(file)
    || /^scripts\/forgeflow\/(render|show|build|check|run|apply|record|rollup)-/.test(file)
  ));
  return uniqueTop(candidates, 12).map((file) => ({
    path: file,
    evidence: file.startsWith('commands/') ? 'command wrapper surface' : 'static filename/module convention',
  }));
}

function validationNorms(model, intelligence) {
  const fromModel = Array.isArray(model?.validation_model) ? model.validation_model : [];
  const fromIntelligence = Array.isArray(intelligence?.validation_patterns) ? intelligence.validation_patterns : [];
  return uniqueTop([...fromModel, ...fromIntelligence], 8).map((item) => ({
    command_or_pattern: item,
    source: 'project evidence',
  }));
}

function knownGaps(sources, invalid, topology) {
  const gaps = [];
  for (const source of sources) {
    if (source.status === 'missing') gaps.push({ kind: 'missing-source', source: source.label, action: `Refresh ${source.label} before relying on this section.` });
    if (source.status === 'invalid') gaps.push({ kind: 'invalid-source', source: source.label, action: `Inspect unsafe or malformed artifact: ${source.path}` });
  }
  for (const item of invalid) gaps.push({ kind: 'invalid-artifact', source: item.label, action: item.reason });
  const unresolved = Number(topology?.summary?.unresolved_imports || (Array.isArray(topology?.unresolved) ? topology.unresolved.length : 0));
  const dynamic = Number(topology?.summary?.skipped_dynamic_imports || (Array.isArray(topology?.skipped_dynamic) ? topology.skipped_dynamic.length : 0));
  if (unresolved > 0) gaps.push({ kind: 'static-import-gap', source: 'code-topology', action: `${unresolved} unresolved import(s) remain static-analysis hints, not proof of runtime failure.` });
  if (dynamic > 0) gaps.push({ kind: 'dynamic-import-gap', source: 'code-topology', action: `${dynamic} dynamic import(s) were skipped by the static graph.` });
  return gaps.slice(0, 12);
}

function renderArchitectureDocs(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = safeProjectDir(opts.projectDir || defaultProjectDir(root));
  const contextDir = path.join(projectDir, 'context');
  const latestDir = path.join(contextDir, 'latest');
  const invalid = [];
  const topologySource = readJsonArtifact(path.join(latestDir, 'code-topology.json'), projectDir, 'code-topology', invalid);
  const modelSource = readJsonArtifact(path.join(contextDir, 'project-operating-model.json'), projectDir, 'project-operating-model', invalid);
  const intelligenceSource = readJsonArtifact(path.join(contextDir, 'project-intelligence-rollup.json'), projectDir, 'project-intelligence', invalid);
  const learningsSource = readTextArtifact(path.join(projectDir, 'project-learnings.md'), projectDir, 'project-learnings', invalid);
  const sources = [topologySource, modelSource, intelligenceSource, learningsSource];
  const topology = topologySource.value || {};
  const model = modelSource.value || {};
  const intelligence = intelligenceSource.value || {};
  const hasPresentSource = sources.some((source) => source.status === 'present');
  const report = {
    schema_version: '1',
    generated_at: isoNow(),
    status: hasPresentSource ? (invalid.length > 0 ? 'attention' : 'ready') : (invalid.length > 0 ? 'attention' : 'empty'),
    root,
    project_dir: projectDir,
    sources: sources.map(sourceSummary),
    provenance: {
      code_topology: topology.provenance || null,
      operating_model: model.provenance || null,
      intelligence: intelligence.provenance || null,
    },
    summary: {
      source_files: Number(topology.summary?.source_files || 0),
      local_edges: Number(topology.summary?.local_edges || 0),
      external_imports: Number(topology.summary?.external_imports || 0),
      unresolved_imports: Number(topology.summary?.unresolved_imports || 0),
      skipped_dynamic_imports: Number(topology.summary?.skipped_dynamic_imports || 0),
      architecture_confidence: model.confidence?.band || (topologySource.status === 'present' ? 'medium' : 'low'),
    },
    domains: domainsFromTopology(topology, model),
    entrypoints: entrypointHints(topology),
    hotspots: topologyHotspots(topology, model),
    risk_zones: (Array.isArray(model.risk_zones) ? model.risk_zones : []).slice(0, 8).map((item) => ({
      severity: item.severity || 'attention',
      summary: text(item.summary || item),
      next_action: text(item.next_action || 'verify current evidence'),
      source: item.source || 'project-operating-model',
    })),
    validation_norms: validationNorms(model, intelligence),
    learning_excerpt: learningsSource.status === 'present' ? learningsSource.value : '',
    gaps: knownGaps(sources, invalid, topology),
    artifacts: {
      markdown: outputPath(projectDir, 'architecture.md'),
      json: outputPath(projectDir, 'architecture.json'),
    },
    next: '/forgeflow-code-map && /forgeflow-project-model --refresh',
    next_reason: 'Refresh topology and the project operating model before using architecture guidance for a new broad change.',
    boundary: 'Generated architecture docs are advisory static evidence. Verify current code, tests, runtime behavior, and review artifacts before acting.',
  };
  if (opts.write) {
    writeFileSafe(report.artifacts.markdown, renderMarkdown(report));
    writeJsonSafe(report.artifacts.json, report);
  }
  return report;
}

function line(label, value) {
  return `- ${label}: ${value || 'none'}`;
}

function listItems(items, render) {
  if (!items || items.length === 0) return ['- None found in current evidence.'];
  return items.map(render);
}

function renderMarkdown(report) {
  const lines = [
    '# Forgeflow Architecture',
    '',
    `Generated at: ${report.generated_at}`,
    `Status: ${report.status}`,
    '',
    report.boundary,
    '',
    '## Evidence Sources',
    '',
  ];
  for (const source of report.sources) lines.push(line(source.label, `${source.status} (${source.path})`));
  lines.push('', '## Summary', '');
  lines.push(line('Source files', report.summary.source_files));
  lines.push(line('Local import edges', report.summary.local_edges));
  lines.push(line('External imports', report.summary.external_imports));
  lines.push(line('Unresolved imports', report.summary.unresolved_imports));
  lines.push(line('Skipped dynamic imports', report.summary.skipped_dynamic_imports));
  lines.push(line('Architecture confidence', report.summary.architecture_confidence));
  lines.push('', '## Major Domains', '');
  lines.push(...listItems(report.domains, (item) => `- ${item.name}: ${item.file_count || 'unknown'} file(s), ${item.confidence} confidence (${item.source})`));
  lines.push('', '## Entrypoint Hints', '');
  lines.push(...listItems(report.entrypoints, (item) => `- ${item.path}: ${item.evidence}`));
  lines.push('', '## Hotspots', '', '### High Fan-In', '');
  lines.push(...listItems(report.hotspots.high_fan_in, (item) => `- ${item.path}: fan-in ${item.fan_in}; ${item.why}`));
  lines.push('', '### High Fan-Out', '');
  lines.push(...listItems(report.hotspots.high_fan_out, (item) => `- ${item.path}: fan-out ${item.fan_out}; ${item.why}`));
  lines.push('', '### High-Care Files', '');
  lines.push(...listItems(report.hotspots.high_care_files, (item) => `- ${item.path}: ${item.reason} (${item.confidence})`));
  lines.push('', '## Risk Zones', '');
  lines.push(...listItems(report.risk_zones, (item) => `- ${item.severity}: ${item.summary}; next: ${item.next_action}`));
  lines.push('', '## Validation Norms', '');
  lines.push(...listItems(report.validation_norms, (item) => `- ${item.command_or_pattern}`));
  lines.push('', '## Known Gaps', '');
  lines.push(...listItems(report.gaps, (item) => `- ${item.kind} (${item.source}): ${item.action}`));
  lines.push('', '## Next', '', report.next, '', report.next_reason, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = renderArchitectureDocs(opts);
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
  parseArgs,
  renderArchitectureDocs,
  renderMarkdown,
};
