#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  contextTelemetry,
  fileChars,
  sum,
  textChars,
  writeTelemetry,
} = require('./context-telemetry');

const SOURCE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'];
const DEFAULT_MAX_HOTSPOTS = 10;

function usage() {
  console.error([
    'Usage: build-code-topology.js [--root <dir>] [--files <path>] [--out <path>]',
    '       [--markdown-out <path>] [--telemetry-out <path>] [--max-hotspots <n>] [--json]',
  ].join('\n'));
}

function parseArgs(argv) {
  const opts = {
    root: '',
    filesPath: '',
    out: '',
    markdownOut: '',
    telemetryOut: '',
    maxHotspots: DEFAULT_MAX_HOTSPOTS,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(argv[++i] || '');
    } else if (arg === '--files') {
      opts.filesPath = path.resolve(argv[++i] || '');
    } else if (arg === '--out') {
      opts.out = path.resolve(argv[++i] || '');
    } else if (arg === '--markdown-out') {
      opts.markdownOut = path.resolve(argv[++i] || '');
    } else if (arg === '--telemetry-out') {
      opts.telemetryOut = path.resolve(argv[++i] || '');
    } else if (arg === '--max-hotspots') {
      opts.maxHotspots = Number.parseInt(argv[++i] || `${DEFAULT_MAX_HOTSPOTS}`, 10);
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

function defaultOut(root) {
  return path.join(defaultProjectDir(root), 'context', 'code-topology.json');
}

function defaultMarkdownOut(root) {
  return path.join(defaultProjectDir(root), 'context', 'code-topology-review-focus.md');
}

function defaultTelemetryOut(root) {
  return path.join(defaultProjectDir(root), 'context', 'code-topology-telemetry.json');
}

function normalize(file) {
  return String(file || '').replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function deniedPath(file) {
  const lower = normalize(file).toLowerCase();
  const base = path.basename(lower);
  if (!file || path.isAbsolute(file)) return 'absolute paths are not accepted';
  if (lower.split('/').includes('..')) return 'parent path segment is not accepted';
  if (/(^|\/)(\.git|\.forgeflow|node_modules|dist|build|coverage|\.next|\.turbo|vendor)\//.test(lower)) return 'generated or dependency path';
  if (/(^|\/)\.env($|[._-])/.test(lower)) return 'environment file';
  if (/\.(pem|key|p12|cert|log|sqlite|db)$/i.test(base)) return 'local or sensitive artifact';
  if (/(password|secret|token)/i.test(base)) return 'sensitive filename';
  return '';
}

function isSourceFile(file) {
  return SOURCE_EXTENSIONS.includes(path.extname(file));
}

function readTrackedFiles(root) {
  const gitRoot = git(['rev-parse', '--show-toplevel'], root);
  if (!gitRoot || path.resolve(gitRoot) !== path.resolve(root)) return [];
  const tracked = git(['ls-files'], root).split(/\r?\n/).filter(Boolean);
  const changed = git(['diff', '--name-only', 'HEAD'], root).split(/\r?\n/).filter(Boolean);
  const untracked = git(['ls-files', '--others', '--exclude-standard'], root).split(/\r?\n/).filter(Boolean);
  return [...new Set([...tracked, ...changed, ...untracked])];
}

function walkFiles(root) {
  const found = [];
  const denied = [];
  function visit(dir) {
    for (const name of fs.readdirSync(dir).sort()) {
      const abs = path.join(dir, name);
      const rel = normalize(path.relative(root, abs));
      const stat = fs.lstatSync(abs);
      if (stat.isSymbolicLink()) {
        denied.push({ path: rel, reason: 'symbolic links are not accepted' });
        continue;
      }
      if (stat.isDirectory()) {
        const reason = deniedPath(`${rel}/`);
        if (reason) {
          denied.push({ path: `${rel}/`, reason });
          continue;
        }
        visit(abs);
      } else {
        found.push(rel);
      }
    }
  }
  visit(root);
  return { found, denied };
}

function readFiles(root) {
  const tracked = readTrackedFiles(root);
  const walked = tracked.length > 0 ? { found: tracked, denied: [] } : walkFiles(root);
  const files = walked.found;
  const denied = [];
  const sourceFiles = [];
  for (const file of files.map(normalize).sort()) {
    const reason = deniedPath(file);
    if (reason) {
      denied.push({ path: file, reason });
      continue;
    }
    const abs = path.join(root, file);
    let stat = null;
    try {
      stat = fs.lstatSync(abs);
    } catch (_err) {
      if (isSourceFile(file)) denied.push({ path: file, reason: 'missing source path' });
      continue;
    }
    if (stat.isSymbolicLink()) {
      denied.push({ path: file, reason: 'symbolic links are not accepted' });
      continue;
    }
    if (isSourceFile(file)) sourceFiles.push(file);
  }
  return { sourceFiles: [...new Set(sourceFiles)].sort(), denied: [...walked.denied, ...denied].sort((a, b) => a.path.localeCompare(b.path)) };
}

function readChangedFiles(root, filesPath) {
  if (filesPath) {
    return fs.readFileSync(filesPath, 'utf8').split(/\r?\n/).map((line) => normalize(line.trim())).filter(Boolean);
  }
  const changed = git(['diff', '--name-only', 'HEAD'], root).split(/\r?\n/).map(normalize).filter(Boolean);
  const untracked = git(['ls-files', '--others', '--exclude-standard'], root).split(/\r?\n/).map(normalize).filter(Boolean);
  return [...new Set([...changed, ...untracked])];
}

function stripComments(content) {
  return String(content || '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function extractImports(content) {
  const text = stripComments(content);
  const imports = [];
  const importRegex = /\bimport\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  const exportRegex = /\bexport\s+(?:type\s+)?(?:\*|\{[\s\S]*?\})\s+from\s+['"]([^'"]+)['"]/g;
  const requireRegex = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  const dynamicRegex = /\bimport\s*\(\s*([^)]*)\)/g;
  let match;
  while ((match = importRegex.exec(text))) imports.push({ specifier: match[1], kind: 'import' });
  while ((match = exportRegex.exec(text))) imports.push({ specifier: match[1], kind: 'export-from' });
  while ((match = requireRegex.exec(text))) imports.push({ specifier: match[1], kind: 'require' });
  const skippedDynamic = [];
  while ((match = dynamicRegex.exec(text))) {
    skippedDynamic.push({ expression: match[1].trim().slice(0, 120) });
  }
  return { imports, skippedDynamic };
}

function candidatePaths(fromFile, specifier) {
  const base = normalize(path.join(path.dirname(fromFile), specifier));
  const ext = path.extname(base);
  const candidates = [];
  if (ext) {
    candidates.push(base);
    const withoutExt = base.slice(0, -ext.length);
    if (ext === '.js') candidates.push(`${withoutExt}.ts`, `${withoutExt}.tsx`, `${withoutExt}.jsx`);
    if (ext === '.jsx') candidates.push(`${withoutExt}.tsx`);
  } else {
    for (const sourceExt of SOURCE_EXTENSIONS) candidates.push(`${base}${sourceExt}`);
    for (const sourceExt of SOURCE_EXTENSIONS) candidates.push(`${base}/index${sourceExt}`);
  }
  return candidates;
}

function resolveLocalImport(fromFile, specifier, sourceSet) {
  if (!specifier.startsWith('.')) return { target: '', status: 'external' };
  for (const candidate of candidatePaths(fromFile, specifier)) {
    if (sourceSet.has(candidate)) return { target: candidate, status: 'resolved' };
  }
  return { target: '', status: 'unresolved' };
}

function buildGraph(root, sourceFiles) {
  const sourceSet = new Set(sourceFiles);
  const nodes = Object.fromEntries(sourceFiles.map((file) => [file, {
    path: file,
    imports: [],
    imported_by: [],
    fan_in: 0,
    fan_out: 0,
  }]));
  const edges = [];
  const unresolved = [];
  const external = [];
  const skipped_dynamic = [];

  for (const file of sourceFiles) {
    const abs = path.join(root, file);
    const content = fs.readFileSync(abs, 'utf8');
    const parsed = extractImports(content);
    for (const skipped of parsed.skippedDynamic) {
      skipped_dynamic.push({ source: file, ...skipped });
    }
    for (const item of parsed.imports) {
      const resolved = resolveLocalImport(file, item.specifier, sourceSet);
      if (resolved.status === 'resolved') {
        edges.push({ source: file, target: resolved.target, specifier: item.specifier, kind: item.kind });
        nodes[file].imports.push(resolved.target);
        nodes[resolved.target].imported_by.push(file);
      } else if (resolved.status === 'external') {
        external.push({ source: file, specifier: item.specifier, kind: item.kind });
      } else {
        unresolved.push({ source: file, specifier: item.specifier, kind: item.kind });
      }
    }
  }

  for (const node of Object.values(nodes)) {
    node.imports = [...new Set(node.imports)].sort();
    node.imported_by = [...new Set(node.imported_by)].sort();
    node.fan_out = node.imports.length;
    node.fan_in = node.imported_by.length;
  }

  return {
    nodes: Object.values(nodes).sort((a, b) => a.path.localeCompare(b.path)),
    edges: edges.sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target) || a.specifier.localeCompare(b.specifier)),
    unresolved: unresolved.sort((a, b) => a.source.localeCompare(b.source) || a.specifier.localeCompare(b.specifier)),
    external: external.sort((a, b) => a.source.localeCompare(b.source) || a.specifier.localeCompare(b.specifier)),
    skipped_dynamic: skipped_dynamic.sort((a, b) => a.source.localeCompare(b.source) || a.expression.localeCompare(b.expression)),
  };
}

function rank(nodes, key, maxHotspots) {
  return nodes
    .filter((node) => node[key] > 0)
    .sort((a, b) => b[key] - a[key] || b.fan_in - a.fan_in || b.fan_out - a.fan_out || a.path.localeCompare(b.path))
    .slice(0, maxHotspots)
    .map((node) => ({ path: node.path, fan_in: node.fan_in, fan_out: node.fan_out }));
}

function md(value) {
  return String(value || '').replace(/([\\`*_{}\[\]()#+\-.!|>])/g, '\\$1');
}

function changedNeighbors(nodes, changedFiles) {
  const nodeMap = new Map(nodes.map((node) => [node.path, node]));
  const changes = [];
  for (const file of changedFiles.filter((item) => nodeMap.has(item)).sort()) {
    const node = nodeMap.get(file);
    const dependencies = node.imports.map((target) => ({
      path: target,
      reason: `${file} imports this file`,
      direction: 'dependency',
    }));
    const dependents = node.imported_by.map((target) => ({
      path: target,
      reason: `imports ${file}`,
      direction: 'dependent',
    }));
    changes.push({
      path: file,
      fan_in: node.fan_in,
      fan_out: node.fan_out,
      dependencies,
      dependents,
      read_next: [...dependencies, ...dependents]
        .sort((a, b) => a.path.localeCompare(b.path))
        .slice(0, 20),
    });
  }
  return changes;
}

function renderMarkdown(topology) {
  const lines = [
    '# Forgeflow Code Topology',
    '',
    `Generated at: ${topology.generated_at}`,
    `Root: ${topology.root}`,
    '',
    '## Summary',
    '',
    `- Source files: ${topology.summary.source_files}`,
    `- Local edges: ${topology.summary.local_edges}`,
    `- External imports: ${topology.summary.external_imports}`,
    `- Unresolved imports: ${topology.summary.unresolved_imports}`,
    `- Skipped dynamic imports: ${topology.summary.skipped_dynamic_imports}`,
    '',
    '## High Fan-In',
    '',
    ...(topology.high_fan_in.length > 0 ? topology.high_fan_in.map((item) => `- ${md(item.path)} (fan-in ${item.fan_in}, fan-out ${item.fan_out})`) : ['(none)']),
    '',
    '## High Fan-Out',
    '',
    ...(topology.high_fan_out.length > 0 ? topology.high_fan_out.map((item) => `- ${md(item.path)} (fan-in ${item.fan_in}, fan-out ${item.fan_out})`) : ['(none)']),
    '',
    '## Changed File Neighbors',
    '',
  ];
  if (topology.changed_file_neighbors.length === 0) {
    lines.push('(none)', '');
  } else {
    for (const item of topology.changed_file_neighbors) {
      lines.push(`### ${md(item.path)}`, '', `- fan-in: ${item.fan_in}`, `- fan-out: ${item.fan_out}`);
      if (item.read_next.length === 0) {
        lines.push('- read next: (none)');
      } else {
        for (const next of item.read_next) lines.push(`- read next: ${md(next.path)} (${md(next.reason)})`);
      }
      lines.push('');
    }
  }
  lines.push('## Unresolved Imports', '');
  lines.push(...(topology.unresolved.length > 0 ? topology.unresolved.slice(0, 20).map((item) => `- ${md(item.source)}: ${md(item.specifier)} (${md(item.kind)})`) : ['(none)']), '');
  lines.push('## Skipped Dynamic Imports', '');
  lines.push(...(topology.skipped_dynamic.length > 0 ? topology.skipped_dynamic.slice(0, 20).map((item) => `- ${md(item.source)}: import(${md(item.expression)})`) : ['(none)']), '');
  lines.push('## Limits', '');
  lines.push('- Static JS/TS module graph only.');
  lines.push('- Does not represent runtime call graph, control flow, data flow, or dependency severity.');
  lines.push('- Dynamic imports are reported as skipped unless they also appear as static imports.');
  return `${lines.join('\n')}\n`;
}

function buildCodeTopology(opts = {}) {
  const root = opts.root || repoRoot();
  const out = opts.out || defaultOut(root);
  const markdownOut = opts.markdownOut || defaultMarkdownOut(root);
  const telemetryOut = opts.telemetryOut || defaultTelemetryOut(root);
  const maxHotspots = Number.isFinite(opts.maxHotspots) && opts.maxHotspots > 0 ? opts.maxHotspots : DEFAULT_MAX_HOTSPOTS;
  const { sourceFiles, denied } = readFiles(root);
  const graph = buildGraph(root, sourceFiles);
  const changedFiles = readChangedFiles(root, opts.filesPath || '').filter(isSourceFile);
  const topology = {
    schema_version: '1',
    generated_at: new Date().toISOString(),
    root,
    source_extensions: SOURCE_EXTENSIONS,
    summary: {
      source_files: sourceFiles.length,
      local_edges: graph.edges.length,
      external_imports: graph.external.length,
      unresolved_imports: graph.unresolved.length,
      skipped_dynamic_imports: graph.skipped_dynamic.length,
      denied_files: denied.length,
    },
    nodes: graph.nodes,
    edges: graph.edges,
    high_fan_in: rank(graph.nodes, 'fan_in', maxHotspots),
    high_fan_out: rank(graph.nodes, 'fan_out', maxHotspots),
    changed_files: changedFiles,
    changed_file_neighbors: changedNeighbors(graph.nodes, changedFiles),
    unresolved: graph.unresolved,
    external: graph.external,
    skipped_dynamic: graph.skipped_dynamic,
    denied,
  };
  const markdown = renderMarkdown(topology);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(topology, null, 2)}\n`);
  fs.mkdirSync(path.dirname(markdownOut), { recursive: true });
  fs.writeFileSync(markdownOut, markdown);
  const telemetry = contextTelemetry('code-topology', {
    baseline_chars: sum(sourceFiles.map((file) => fileChars(path.join(root, file)))),
    compact_chars: textChars(JSON.stringify(topology, null, 2)) + textChars(markdown),
    detail: topology.summary,
  });
  writeTelemetry(telemetryOut, telemetry);
  return { out, markdown_out: markdownOut, telemetry_path: telemetryOut, topology, markdown, telemetry };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildCodeTopology(opts);
  if (opts.json) {
    console.log(JSON.stringify({
      out: result.out,
      markdown_out: result.markdown_out,
      telemetry_path: result.telemetry_path,
      summary: result.topology.summary,
      high_fan_in: result.topology.high_fan_in,
      high_fan_out: result.topology.high_fan_out,
    }, null, 2));
  } else {
    console.log(`Code topology: ${result.out}`);
    console.log(`Review focus: ${result.markdown_out}`);
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
  buildCodeTopology,
  deniedPath,
  extractImports,
  renderMarkdown,
  resolveLocalImport,
};
