#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildCodeTopology } = require('./build-code-topology');
const DEFAULT_HISTORY_LIMIT = 50;

function usage() {
  console.error('Usage: show-code-map.js [--root <dir>] [--project-dir <dir>] [--out <markdown>] [--max-hotspots <n>] [--history-limit <n>] [--json]');
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
    root: '',
    out: '',
    maxHotspots: 10,
    historyLimit: DEFAULT_HISTORY_LIMIT,
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
    } else if (arg === '--max-hotspots') {
      opts.maxHotspots = Number.parseInt(requireValue(argv, arg, i), 10);
      i += 1;
    } else if (arg === '--history-limit') {
      opts.historyLimit = Number.parseInt(requireValue(argv, arg, i), 10);
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

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) return '';
  return result.stdout.trimEnd();
}

function repoRoot(cwd = process.cwd()) {
  return git(['rev-parse', '--show-toplevel'], cwd) || cwd;
}

function defaultProjectDir(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function defaultOut(root, projectDir = defaultProjectDir(root)) {
  return path.join(projectDir, 'context', 'project-code-map.md');
}

function defaultHistoryPath(root, projectDir = defaultProjectDir(root)) {
  return path.join(projectDir, 'context', 'code-map-history.jsonl');
}

function historyPathForTopologyOut(topologyOut) {
  const dir = path.dirname(topologyOut);
  const contextDir = path.basename(dir) === 'latest' ? path.dirname(dir) : dir;
  return path.join(contextDir, 'code-map-history.jsonl');
}

function md(value) {
  return String(value || '').replace(/([\\`*_{}\[\]()#+\-.!|>])/g, '\\$1');
}

function safeLimit(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function topMarkdownSections(topology, limit = 8) {
  return (topology.markdown_sections || [])
    .slice()
    .sort((a, b) => b.sections.length - a.sections.length || a.path.localeCompare(b.path))
    .slice(0, limit)
    .map((item) => ({
      path: item.path,
      section_count: item.sections.length,
      sections: item.sections.slice(0, 5),
    }));
}

function changedSectionList(topology) {
  return Object.entries(topology.changed_sections || {})
    .flatMap(([file, sections]) => sections.map((section) => ({ file, ...section })))
    .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
    .slice(0, 20);
}

function unresolvedImportReason(item) {
  const specifier = String(item.specifier || '');
  if (!specifier.startsWith('.')) return 'external package import';
  const ext = path.extname(specifier);
  if (ext && !['.js', '.jsx', '.ts', '.tsx'].includes(ext)) return 'unsupported source extension';
  return 'no matching local JS/TS file or index file found';
}

function dynamicImportReason(item) {
  const expression = String(item.expression || '');
  if (/^['"][^'"]+['"]$/.test(expression)) return 'literal dynamic import; static graph skips runtime import() edges';
  return 'non-literal dynamic import; target is only known at runtime';
}

function importGapSummary(topology, limit = 8) {
  const unresolved = (topology.unresolved || []).slice(0, limit).map((item) => ({
    source: item.source,
    specifier: item.specifier,
    kind: item.kind,
    reason: unresolvedImportReason(item),
    action: 'Confirm the target file exists, add an index file, or treat it as an intentional unresolved alias.',
  }));
  const skipped_dynamic = (topology.skipped_dynamic || []).slice(0, limit).map((item) => ({
    source: item.source,
    expression: item.expression,
    reason: dynamicImportReason(item),
    action: 'Inspect runtime routing or bundler conventions when this path affects the current change.',
  }));
  return {
    unresolved,
    skipped_dynamic,
    limits: {
      unresolved: limit,
      skipped_dynamic: limit,
      unresolved_total: (topology.unresolved || []).length,
      skipped_dynamic_total: (topology.skipped_dynamic || []).length,
    },
  };
}

function projectCodeMapSummary(topology, artifacts, opts = {}) {
  const maxHotspots = safeLimit(opts.maxHotspots, 8);
  return {
    schema_version: '1',
    generated_at: topology.generated_at,
    root: topology.root,
    provenance: topology.provenance || null,
    summary: topology.summary,
    high_fan_in: topology.high_fan_in.slice(0, maxHotspots),
    high_fan_out: topology.high_fan_out.slice(0, maxHotspots),
    changed_sections: changedSectionList(topology),
    changed_file_neighbors: topology.changed_file_neighbors.slice(0, maxHotspots).map((item) => ({
      path: item.path,
      fan_in: item.fan_in,
      fan_out: item.fan_out,
      sections: item.sections.slice(0, maxHotspots),
      changed_sections: item.changed_sections.slice(0, maxHotspots),
      read_next: item.read_next.slice(0, maxHotspots),
    })),
    import_gaps: importGapSummary(topology, maxHotspots),
    markdown_sections: topMarkdownSections(topology, maxHotspots),
    artifacts,
    limits: [
      'Static JS/TS import graph only.',
      'Sections are source symbol and Markdown heading hints.',
      'Not a runtime call graph, control-flow graph, data-flow graph, or dependency severity model.',
    ],
  };
}

function readCodeMapHistory(historyPath) {
  if (!historyPath || !fs.existsSync(historyPath)) return [];
  return fs.readFileSync(historyPath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (_err) {
        return null;
      }
    })
    .filter(Boolean);
}

function codeMapHistoryRecord(summary) {
  return {
    schema_version: '1',
    generated_at: summary.generated_at,
    source: summary.provenance ? summary.provenance.source : 'unknown',
    branch: summary.provenance ? summary.provenance.branch : '',
    commit_short: summary.provenance ? summary.provenance.commit_short : '',
    dirty: summary.provenance ? Boolean(summary.provenance.dirty) : false,
    summary: {
      source_files: summary.summary.source_files,
      local_edges: summary.summary.local_edges,
      unresolved_imports: summary.summary.unresolved_imports,
      skipped_dynamic_imports: summary.summary.skipped_dynamic_imports,
      sections: summary.summary.sections || 0,
      changed_sections: summary.summary.changed_sections || 0,
      markdown_section_files: summary.summary.markdown_section_files || 0,
    },
    high_fan_in: summary.high_fan_in.slice(0, 5).map((item) => ({
      path: item.path,
      fan_in: item.fan_in,
      fan_out: item.fan_out,
    })),
    high_fan_out: summary.high_fan_out.slice(0, 5).map((item) => ({
      path: item.path,
      fan_in: item.fan_in,
      fan_out: item.fan_out,
    })),
    changed_sections: summary.changed_sections.slice(0, 20).map((item) => ({
      file: item.file,
      name: item.name,
      kind: item.kind,
    })),
  };
}

function pathSet(items) {
  return new Set((items || []).map((item) => item.path).filter(Boolean));
}

function setDelta(current, previous) {
  return [...current].filter((item) => !previous.has(item)).slice(0, 10);
}

function compareCodeMapTrend(current, history) {
  const previous = history.length > 0 ? history[history.length - 1] : null;
  if (!previous || !previous.summary) {
    return { status: 'first-run' };
  }
  const currentFanIn = pathSet(current.high_fan_in);
  const previousFanIn = pathSet(previous.high_fan_in);
  const currentFanOut = pathSet(current.high_fan_out);
  const previousFanOut = pathSet(previous.high_fan_out);
  return {
    status: 'compared',
    previous_generated_at: previous.generated_at || '',
    source_files_delta: current.summary.source_files - (previous.summary.source_files || 0),
    local_edges_delta: current.summary.local_edges - (previous.summary.local_edges || 0),
    unresolved_imports_delta: current.summary.unresolved_imports - (previous.summary.unresolved_imports || 0),
    skipped_dynamic_imports_delta: current.summary.skipped_dynamic_imports - (previous.summary.skipped_dynamic_imports || 0),
    sections_delta: current.summary.sections - (previous.summary.sections || 0),
    changed_sections_delta: current.summary.changed_sections - (previous.summary.changed_sections || 0),
    new_high_fan_in: setDelta(currentFanIn, previousFanIn),
    new_high_fan_out: setDelta(currentFanOut, previousFanOut),
    removed_high_fan_in: setDelta(previousFanIn, currentFanIn),
    removed_high_fan_out: setDelta(previousFanOut, currentFanOut),
  };
}

function compactCodeMapHistory(history, limit = DEFAULT_HISTORY_LIMIT) {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_HISTORY_LIMIT;
  if (!Array.isArray(history) || history.length <= safeLimit) return history || [];
  return history.slice(history.length - safeLimit);
}

function writeCodeMapHistory(historyPath, history) {
  fs.mkdirSync(path.dirname(historyPath), { recursive: true });
  fs.writeFileSync(historyPath, history.map((item) => JSON.stringify(item)).join('\n') + (history.length > 0 ? '\n' : ''), 'utf8');
}

function attachCodeMapHistory(root, summary, historyPath, opts = {}) {
  const history = readCodeMapHistory(historyPath);
  const record = codeMapHistoryRecord(summary);
  const trend = compareCodeMapTrend(record, history);
  summary.history = {
    path: path.relative(root, historyPath),
    previous_runs: history.length,
    recorded: false,
    trend,
  };
  if (opts.record !== false) {
    const retainedHistory = compactCodeMapHistory([...history, record], opts.limit);
    writeCodeMapHistory(historyPath, retainedHistory);
    summary.history.recorded = true;
    summary.history.retained_runs = retainedHistory.length;
    summary.history.retention_limit = Number.isFinite(opts.limit) && opts.limit > 0 ? opts.limit : DEFAULT_HISTORY_LIMIT;
  }
  return summary.history;
}

function renderList(items, renderItem) {
  return items.length > 0 ? items.map(renderItem) : ['(none)'];
}

function renderTrend(summary) {
  if (!summary.history) return ['(not recorded)'];
  const trend = summary.history.trend || {};
  if (trend.status !== 'compared') {
    return [
      `- History: ${md(summary.history.path)} (${summary.history.previous_runs} previous runs)`,
      `- Retained snapshots: ${summary.history.retained_runs || summary.history.previous_runs}`,
      '- Trend: first recorded code-map snapshot',
    ];
  }
  return [
    `- History: ${md(summary.history.path)} (${summary.history.previous_runs} previous runs)`,
    `- Retained snapshots: ${summary.history.retained_runs || summary.history.previous_runs}`,
    `- Source files delta: ${trend.source_files_delta}`,
    `- Local edges delta: ${trend.local_edges_delta}`,
    `- Unresolved imports delta: ${trend.unresolved_imports_delta}`,
    `- Changed sections delta: ${trend.changed_sections_delta}`,
    `- New high fan-in: ${trend.new_high_fan_in.length > 0 ? trend.new_high_fan_in.map(md).join(', ') : '(none)'}`,
    `- New high fan-out: ${trend.new_high_fan_out.length > 0 ? trend.new_high_fan_out.map(md).join(', ') : '(none)'}`,
  ];
}

function renderProjectCodeMap(summary) {
  const lines = [
    '# Forgeflow Project Code Map',
    '',
    `Generated at: ${summary.generated_at}`,
    `Root: ${summary.root}`,
    '',
    '## Provenance',
    '',
    ...(summary.provenance
      ? [
        `- Source: ${md(summary.provenance.source || 'unknown')}`,
        `- Branch: ${md(summary.provenance.branch || 'unknown')}`,
        `- Commit: ${md(summary.provenance.commit_short || 'unknown')}`,
        `- Worktree: ${summary.provenance.dirty ? 'dirty' : 'clean'}`,
        `- Changed files: ${summary.provenance.changed_files}`,
        `- Untracked files: ${summary.provenance.untracked_files}`,
      ]
      : ['- Git provenance unavailable']),
    '',
    '## Summary',
    '',
    `- Source files: ${summary.summary.source_files}`,
    `- Local edges: ${summary.summary.local_edges}`,
    `- External imports: ${summary.summary.external_imports}`,
    `- Unresolved imports: ${summary.summary.unresolved_imports}`,
    `- Skipped dynamic imports: ${summary.summary.skipped_dynamic_imports}`,
    `- Sections mapped: ${summary.summary.sections}`,
    `- Changed sections: ${summary.summary.changed_sections}`,
    `- Markdown section files: ${summary.summary.markdown_section_files}`,
    '',
    '## Trends',
    '',
    ...renderTrend(summary),
    '',
    '## High Fan-In',
    '',
    ...renderList(summary.high_fan_in, (item) => `- ${md(item.path)} (fan-in ${item.fan_in}, fan-out ${item.fan_out})`),
    '',
    '## High Fan-Out',
    '',
    ...renderList(summary.high_fan_out, (item) => `- ${md(item.path)} (fan-in ${item.fan_in}, fan-out ${item.fan_out})`),
    '',
    '## Changed Sections',
    '',
    ...renderList(summary.changed_sections, (item) => `- ${md(item.file)}: ${md(item.kind)} ${md(item.name)} (${item.line}-${item.end_line}; changed ${item.changed_lines.join(', ')})`),
    '',
    '## Changed File Neighborhoods',
    '',
  ];
  for (const item of summary.changed_file_neighbors) {
    lines.push(`### ${md(item.path)}`, '', `- fan-in: ${item.fan_in}`, `- fan-out: ${item.fan_out}`);
    if (item.sections.length > 0) {
      lines.push('- sections:', ...item.sections.map((section) => `  - ${md(section.kind)} ${md(section.name)} (${section.line}-${section.end_line})`));
    }
    if (item.read_next.length > 0) {
      lines.push('- read next:', ...item.read_next.map((next) => `  - ${md(next.path)} (${md(next.reason)})`));
    }
    lines.push('');
  }
  if (summary.changed_file_neighbors.length === 0) lines.push('(none)', '');
  lines.push('## Markdown Section Files', '');
  lines.push(...renderList(summary.markdown_sections, (item) => `- ${md(item.path)} (${item.section_count} headings): ${item.sections.map((section) => md(section.name)).join(', ')}`), '');
  lines.push('## Import Gaps', '');
  const gaps = summary.import_gaps || { unresolved: [], skipped_dynamic: [], limits: {} };
  lines.push(`- Unresolved imports shown: ${gaps.unresolved.length}/${gaps.limits.unresolved_total || 0}`);
  lines.push(`- Skipped dynamic imports shown: ${gaps.skipped_dynamic.length}/${gaps.limits.skipped_dynamic_total || 0}`);
  lines.push('', '### Unresolved Imports', '');
  lines.push(...renderList(gaps.unresolved, (item) => `- ${md(item.source)}: ${md(item.specifier)} (${md(item.kind)}) - ${md(item.reason)}. ${md(item.action)}`), '');
  lines.push('### Skipped Dynamic Imports', '');
  lines.push(...renderList(gaps.skipped_dynamic, (item) => `- ${md(item.source)}: import(${md(item.expression)}) - ${md(item.reason)}. ${md(item.action)}`), '');
  lines.push('## Artifacts', '');
  lines.push(`- Graph: ${summary.artifacts.graph}`);
  lines.push(`- Review focus: ${summary.artifacts.review_focus}`);
  lines.push(`- Telemetry: ${summary.artifacts.telemetry}`);
  lines.push('', '## Limits', '', ...summary.limits.map((item) => `- ${item}`));
  return `${lines.join('\n')}\n`;
}

function showCodeMap(opts = {}) {
  const root = opts.root || repoRoot();
  const projectDir = opts.projectDir || defaultProjectDir(root);
  const topologyOut = path.join(projectDir, 'context', 'code-topology.json');
  const reviewFocusOut = path.join(projectDir, 'context', 'code-topology-review-focus.md');
  const telemetryOut = path.join(projectDir, 'context', 'code-topology-telemetry.json');
  const result = buildCodeTopology({
    root,
    out: topologyOut,
    markdownOut: reviewFocusOut,
    telemetryOut,
    maxHotspots: opts.maxHotspots,
    compact: true,
    source: 'show-code-map',
  });
  const artifacts = {
    graph: path.relative(root, result.out),
    review_focus: path.relative(root, result.markdown_out),
    telemetry: path.relative(root, result.telemetry_path),
  };
  const summary = projectCodeMapSummary(result.topology, artifacts, { maxHotspots: opts.maxHotspots });
  attachCodeMapHistory(root, summary, opts.history || defaultHistoryPath(root, projectDir), { record: opts.recordHistory, limit: opts.historyLimit });
  const markdown = renderProjectCodeMap(summary);
  const out = opts.out || defaultOut(root, projectDir);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, markdown);
  return {
    out,
    summary,
    markdown,
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = showCodeMap(opts);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify({ out: result.out, ...result.summary }, null, 2)}\n`);
  } else {
    process.stdout.write(result.markdown);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.stack || err.message);
    process.exit(1);
  }
}

module.exports = {
  attachCodeMapHistory,
  changedSectionList,
  codeMapHistoryRecord,
  compactCodeMapHistory,
  compareCodeMapTrend,
  DEFAULT_HISTORY_LIMIT,
  defaultHistoryPath,
  historyPathForTopologyOut,
  importGapSummary,
  projectCodeMapSummary,
  readCodeMapHistory,
  renderProjectCodeMap,
  showCodeMap,
  topMarkdownSections,
};
