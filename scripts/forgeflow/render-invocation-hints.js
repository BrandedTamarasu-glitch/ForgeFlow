#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { isPathInside, safeReadTextFile, writeFileSafe, writeJsonSafe } = require('./file-safety');

function usage() {
  console.error('Usage: render-invocation-hints.js [--root <dir>] [--project-dir <dir>] [--write] [--json]');
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
  return String(value || '').replace(/\\/g, '/').replace(/^\.\/+/, '');
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
  const resolved = path.resolve(file);
  if (!isPathInside(path.resolve(projectDir), resolved)) throw new Error('Invocation output must stay inside --project-dir');
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

const SKIP_DIRS = new Set(['.git', '.forgeflow', 'node_modules', 'dist', 'build', 'coverage', '.next', '.cache', 'fixtures']);

function isTestOrFixturePath(file) {
  const rel = normalizePath(file);
  return /(^|\/)(fixtures?|__fixtures__|__tests__|test|tests|spec)\//.test(rel)
    || /\.(test|spec|fixture)\.[cm]?[jt]sx?$/.test(rel);
}

function walk(root, dir, files, limit = 6000) {
  if (files.length >= limit || !fs.existsSync(dir)) return;
  let entries = [];
  try {
    const stat = fs.lstatSync(dir);
    if (stat.isSymbolicLink() || !stat.isDirectory()) return;
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_err) {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(root, full, files, limit);
    } else if (entry.isFile()) {
      files.push(normalizePath(path.relative(root, full)));
      if (files.length >= limit) return;
    }
  }
}

function repoFiles(root) {
  const files = [];
  walk(root, root, files);
  return files.sort();
}

function readPackage(root, rel, invalid) {
  try {
    const parsed = JSON.parse(safeReadTextFile(path.join(root, rel), root).content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('expected JSON object');
    return parsed;
  } catch (err) {
    invalid.push({ label: 'package.json', path: path.join(root, rel), reason: err.message });
    return null;
  }
}

function packageHints(root, files, invalid) {
  const packages = [];
  const commands = [];
  for (const rel of files.filter((file) => file === 'package.json' || file.endsWith('/package.json'))) {
    const pkg = readPackage(root, rel, invalid);
    if (!pkg) continue;
    const dir = normalizePath(path.dirname(rel)).replace(/^\.$/, '');
    const scripts = pkg.scripts && typeof pkg.scripts === 'object' ? Object.entries(pkg.scripts) : [];
    const entryFields = ['main', 'module', 'browser', 'types']
      .filter((field) => typeof pkg[field] === 'string')
      .map((field) => ({ field, target: normalizePath(path.join(dir, pkg[field])) }));
    const bins = typeof pkg.bin === 'string'
      ? [{ name: pkg.name || 'bin', target: normalizePath(path.join(dir, pkg.bin)) }]
      : Object.entries(pkg.bin || {}).map(([name, target]) => ({ name, target: normalizePath(path.join(dir, target)) }));
    packages.push({
      path: rel,
      name: pkg.name || path.basename(dir || root),
      directory: dir || '.',
      scripts: scripts.map(([name, command]) => ({ name, command })),
      entry_fields: entryFields,
      bins,
    });
    for (const [name, command] of scripts) {
      commands.push({
        kind: 'package-script',
        package: pkg.name || path.basename(dir || root),
        path: rel,
        name,
        command,
        suggested_invocation: `${dir ? `cd ${dir} && ` : ''}npm run ${name}`,
        evidence: `${rel} scripts.${name}`,
      });
    }
  }
  return { packages, commands };
}

function configHints(files) {
  const patterns = [
    [/^next\.config\.[cm]?[jt]s$/, 'next-config', 'Next.js config'],
    [/(^|\/)vite\.config\.[cm]?[jt]s$/, 'vite-config', 'Vite config'],
    [/(^|\/)webpack\.config\.[cm]?[jt]s$/, 'webpack-config', 'Webpack config'],
    [/(^|\/)playwright\.config\.[cm]?[jt]s$/, 'playwright-config', 'Playwright config'],
    [/(^|\/)tsconfig\.json$/, 'typescript-config', 'TypeScript config'],
    [/(^|\/)docker-compose\.ya?ml$/, 'compose-config', 'Docker Compose config'],
  ];
  const result = [];
  for (const file of files) {
    const hit = patterns.find(([pattern]) => pattern.test(file));
    if (hit) result.push({ kind: hit[1], path: file, evidence: hit[2] });
  }
  return result.slice(0, 40);
}

function topologyEntryHints(topology) {
  const nodes = Array.isArray(topology.nodes) ? topology.nodes : [];
  const changed = new Set((Array.isArray(topology.changed_files) ? topology.changed_files : []).map(normalizePath));
  const hints = [];
  for (const item of nodes) {
    const file = normalizePath(item.path || item.id || item);
    if (!file) continue;
    if (isTestOrFixturePath(file)) continue;
    const base = path.basename(file);
    const isEntrypoint = /^(index|main|cli|server|app|route|routes|worker|bridge)\.[cm]?[jt]sx?$/.test(base)
      || /^commands\/.+\.md$/.test(file)
      || /^hooks\/.+\.js$/.test(file);
    if (!isEntrypoint) continue;
    hints.push({
      kind: file.startsWith('commands/') ? 'slash-command' : (file.startsWith('hooks/') ? 'hook' : 'source-entrypoint'),
      path: file,
      fan_in: Number(item.fan_in || 0),
      fan_out: Number(item.fan_out || 0),
      changed: changed.has(file),
      evidence: 'static filename and topology convention',
    });
  }
  return hints
    .sort((a, b) => Number(b.changed) - Number(a.changed) || (b.fan_out + b.fan_in) - (a.fan_out + a.fan_in) || a.path.localeCompare(b.path))
    .slice(0, 40);
}

function entryFieldCommands(packages) {
  const hints = [];
  for (const pkg of packages) {
    for (const entry of pkg.entry_fields) {
      hints.push({
        kind: 'package-entry-field',
        package: pkg.name,
        path: entry.target,
        field: entry.field,
        evidence: `${pkg.path} ${entry.field}`,
      });
    }
    for (const bin of pkg.bins) {
      hints.push({
        kind: 'package-bin',
        package: pkg.name,
        path: bin.target,
        name: bin.name,
        evidence: `${pkg.path} bin.${bin.name}`,
      });
    }
  }
  return hints;
}

function routeHints(files) {
  return files
    .filter((file) => /(^|\/)(routes?|pages|app)\/.+\.[cm]?[jt]sx?$/.test(file))
    .filter((file) => !isTestOrFixturePath(file))
    .slice(0, 40)
    .map((file) => ({ kind: 'route-like-file', path: file, evidence: 'route-like path convention' }));
}

function renderInvocationHints(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = safeProjectDir(opts.projectDir || defaultProjectDir(root));
  const invalid = [];
  const topologySource = readJsonArtifact(path.join(projectDir, 'context', 'latest', 'code-topology.json'), projectDir, 'code-topology', invalid);
  const architectureSource = readJsonArtifact(path.join(projectDir, 'context', 'architecture.json'), projectDir, 'architecture', invalid);
  const files = repoFiles(root);
  const packageInfo = packageHints(root, files, invalid);
  const topology = topologySource.value || {};
  const entrypoints = [
    ...packageInfo.commands,
    ...entryFieldCommands(packageInfo.packages),
    ...topologyEntryHints(topology),
    ...routeHints(files),
  ];
  const configs = configHints(files);
  const hasEvidence = packageInfo.packages.length > 0 || entrypoints.length > 0 || configs.length > 0 || topologySource.status === 'present' || architectureSource.status === 'present';
  const result = {
    schema_version: '1',
    generated_at: isoNow(),
    status: invalid.length > 0 ? 'attention' : (hasEvidence ? 'ready' : 'empty'),
    root,
    project_dir: projectDir,
    sources: [
      { label: 'code-topology', status: topologySource.status, path: topologySource.path },
      { label: 'architecture', status: architectureSource.status, path: architectureSource.path },
      { label: 'repo-files', status: 'present', path: root },
    ],
    summary: {
      packages: packageInfo.packages.length,
      package_scripts: packageInfo.commands.length,
      entrypoint_hints: entrypoints.length,
      config_hints: configs.length,
      files_scanned: files.length,
    },
    packages: packageInfo.packages,
    invocation_hints: entrypoints.slice(0, 80),
    config_hints: configs,
    invalid_artifacts: invalid.map((item) => ({ label: item.label, path: item.path, reason: item.reason })),
    gaps: knownGaps(topologySource, architectureSource, packageInfo, configs),
    artifacts: {
      markdown: outputPath(projectDir, 'invocation-hints.md'),
      json: outputPath(projectDir, 'invocation-hints.json'),
    },
    next: '/forgeflow-ownership --write',
    next_reason: 'Refresh ownership hints after invocation surfaces change so review routing stays current.',
    boundary: 'Invocation hints are advisory static evidence. Forgeflow does not execute package scripts, start servers, install dependencies, trace runtime behavior, infer a full call graph, commit, push, or claim review approval.',
  };
  if (opts.write) {
    writeFileSafe(result.artifacts.markdown, renderMarkdown(result));
    writeJsonSafe(result.artifacts.json, result);
  }
  return result;
}

function knownGaps(topologySource, architectureSource, packageInfo, configs) {
  const gaps = [];
  if (topologySource.status !== 'present') gaps.push({ kind: 'missing-code-topology', action: 'Run /forgeflow-code-map before relying on topology-ranked entrypoints.' });
  if (architectureSource.status !== 'present') gaps.push({ kind: 'missing-architecture', action: 'Run /forgeflow-architecture --write before broad architecture review.' });
  if (packageInfo.packages.length === 0) gaps.push({ kind: 'missing-package-metadata', action: 'No package.json files were found outside ignored directories.' });
  if (configs.length === 0) gaps.push({ kind: 'missing-config-hints', action: 'No common framework/test/build config files were found.' });
  return gaps.slice(0, 12);
}

function list(items, render) {
  if (!items || items.length === 0) return ['- None found in current evidence.'];
  return items.map(render);
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Invocation Hints',
    '',
    `Generated at: ${result.generated_at}`,
    `Status: ${result.status}`,
    '',
    result.boundary,
    '',
    '## Summary',
    '',
    `- Packages: ${result.summary.packages}`,
    `- Package scripts: ${result.summary.package_scripts}`,
    `- Entrypoint hints: ${result.summary.entrypoint_hints}`,
    `- Config hints: ${result.summary.config_hints}`,
    `- Files scanned: ${result.summary.files_scanned}`,
    '',
    '## Packages',
    '',
  ];
  lines.push(...list(result.packages, (item) => `- ${item.name} (${item.path}): ${item.scripts.length} script(s), ${item.entry_fields.length} entry field(s), ${item.bins.length} bin(s)`));
  lines.push('', '## Invocation Hints', '');
  lines.push(...list(result.invocation_hints, (item) => {
    const command = item.suggested_invocation ? `; run hint: ${item.suggested_invocation}` : '';
    return `- ${item.kind}: ${item.path || item.name || item.package}${command}; evidence: ${item.evidence}`;
  }));
  lines.push('', '## Config Hints', '');
  lines.push(...list(result.config_hints, (item) => `- ${item.kind}: ${item.path}; ${item.evidence}`));
  lines.push('', '## Gaps', '');
  lines.push(...list(result.gaps, (item) => `- ${item.kind}: ${item.action}`));
  if (result.invalid_artifacts.length > 0) {
    lines.push('', '## Invalid Artifacts', '');
    lines.push(...result.invalid_artifacts.map((item) => `- ${item.label}: ${item.reason} (${item.path})`));
  }
  lines.push('', '## Next', '', result.next, '', result.next_reason, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = renderInvocationHints(opts);
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
  configHints,
  packageHints,
  parseArgs,
  renderInvocationHints,
  renderMarkdown,
  topologyEntryHints,
};
