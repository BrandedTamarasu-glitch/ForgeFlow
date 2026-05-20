#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildCodeTopology } = require('./build-code-topology');

function usage() {
  console.error('Usage: show-code-map.js [--root <dir>] [--project-dir <dir>] [--out <markdown>] [--max-hotspots <n>] [--json]');
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

function projectCodeMapSummary(topology, artifacts, opts = {}) {
  const maxHotspots = safeLimit(opts.maxHotspots, 8);
  return {
    schema_version: '1',
    generated_at: topology.generated_at,
    root: topology.root,
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
    markdown_sections: topMarkdownSections(topology, maxHotspots),
    artifacts,
    limits: [
      'Static JS/TS import graph only.',
      'Sections are source symbol and Markdown heading hints.',
      'Not a runtime call graph, control-flow graph, data-flow graph, or dependency severity model.',
    ],
  };
}

function renderList(items, renderItem) {
  return items.length > 0 ? items.map(renderItem) : ['(none)'];
}

function renderProjectCodeMap(summary) {
  const lines = [
    '# Forgeflow Project Code Map',
    '',
    `Generated at: ${summary.generated_at}`,
    `Root: ${summary.root}`,
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
  });
  const artifacts = {
    graph: path.relative(root, result.out),
    review_focus: path.relative(root, result.markdown_out),
    telemetry: path.relative(root, result.telemetry_path),
  };
  const summary = projectCodeMapSummary(result.topology, artifacts, { maxHotspots: opts.maxHotspots });
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
  changedSectionList,
  projectCodeMapSummary,
  renderProjectCodeMap,
  showCodeMap,
  topMarkdownSections,
};
