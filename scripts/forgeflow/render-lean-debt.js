#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { isPathInside, safeReadTextFile, writeFileSafe, writeJsonSafe } = require('./file-safety');
const { parseLeanMarkersFromLines, summarizeLeanMarkers } = require('./lean-markers');

const IGNORE_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next', 'out', 'vendor', '.venv', 'venv']);
const TEXT_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.rb', '.go', '.rs', '.java', '.kt', '.cs', '.php',
  '.sh', '.bash', '.zsh', '.ps1', '.md', '.mdx', '.txt', '.html', '.css', '.scss', '.json', '.yaml', '.yml',
  '.toml', '.sql',
]);
const MARKERS_NEEDING_TRIGGER = new Set(['lean', 'no-new-deps', 'stdlib-first', 'native-first', 'reuse-first']);

function usage() {
  console.error('Usage: render-lean-debt.js [--root <repo>] [--project-dir <dir>] [--write] [--json]');
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

function safeProjectDir(projectDir) {
  const resolved = path.resolve(projectDir);
  if (!fs.existsSync(resolved)) return resolved;
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) throw new Error(`Refusing symlinked project directory: ${projectDir}`);
  if (!stat.isDirectory()) throw new Error(`Project directory is not a directory: ${projectDir}`);
  return resolved;
}

function isLikelyText(file) {
  return TEXT_EXTENSIONS.has(path.extname(file).toLowerCase());
}

function walkFiles(dir, root, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const file = path.join(dir, entry.name);
    const relative = path.relative(root, file).replace(/\\/g, '/');
    if (relative === '.forgeflow' || relative.startsWith('.forgeflow/')) continue;
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      walkFiles(file, root, files);
    } else if (entry.isFile() && isLikelyText(file)) {
      files.push(file);
    }
  }
  return files;
}

function linesWithNumbers(text) {
  return String(text || '').split(/\r?\n/).map((line, index) => ({ line: index + 1, text: line }));
}

function hasUpgradeLanguage(text) {
  return /\b(upgrade|upgrade when|trigger|when|if|until|ceiling|revisit|expand)\b/i.test(String(text || ''));
}

function markerRows(markers) {
  return markers.map((marker) => ({
    source_type: 'marker',
    file: marker.source,
    line: marker.line,
    kind: marker.kind,
    detail: marker.detail,
    ceiling: marker.kind === 'upgrade when' ? '' : marker.detail,
    upgrade_trigger: marker.kind === 'upgrade when' ? marker.detail : (hasUpgradeLanguage(marker.detail) ? marker.detail : ''),
    risk: marker.valid && (!MARKERS_NEEDING_TRIGGER.has(marker.kind) || hasUpgradeLanguage(marker.detail)) ? 'tracked' : 'no-trigger',
    issue: marker.issue || (MARKERS_NEEDING_TRIGGER.has(marker.kind) && !hasUpgradeLanguage(marker.detail) ? 'missing-upgrade-trigger' : ''),
  }));
}

function scanMarkers(root) {
  const markers = [];
  const errors = [];
  for (const file of walkFiles(root, root)) {
    const relative = path.relative(root, file).replace(/\\/g, '/');
    try {
      const text = safeReadTextFile(file, root).content;
      markers.push(...parseLeanMarkersFromLines(linesWithNumbers(text), relative));
    } catch (err) {
      errors.push({ file: relative, reason: err.message });
    }
  }
  return { markers, errors };
}

function readJson(file, projectDir) {
  if (!fs.existsSync(file)) return null;
  const value = JSON.parse(safeReadTextFile(file, projectDir).content);
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function leanDecisionRows(projectDir) {
  const file = path.join(projectDir, 'context', 'lean-decision.json');
  let value = null;
  try {
    value = readJson(file, projectDir);
  } catch (_err) {
    return [];
  }
  if (!value) return [];
  const candidate = value.implementation_note_candidate || {};
  const ceiling = value.decision?.ceiling?.known_ceiling || value.known_ceiling || candidate.note || '';
  const upgrade = value.decision?.ceiling?.upgrade_trigger || value.upgrade_trigger || candidate.why || '';
  if (!ceiling && !upgrade) return [];
  return [{
    source_type: 'lean-decision',
    file: path.relative(projectDir, file).replace(/\\/g, '/'),
    line: 0,
    kind: 'lean-decision',
    detail: ceiling || upgrade,
    ceiling,
    upgrade_trigger: upgrade,
    risk: upgrade ? 'tracked' : 'no-trigger',
    issue: upgrade ? '' : 'missing-upgrade-trigger',
  }];
}

function implementationNoteRows(projectDir) {
  const file = path.join(projectDir, 'implementation-notes.md');
  if (!fs.existsSync(file)) return [];
  let text = '';
  try {
    text = safeReadTextFile(file, projectDir).content;
  } catch (_err) {
    return [];
  }
  const rows = [];
  const lines = linesWithNumbers(text);
  for (const current of lines) {
    if (!/\b(Lean path selected|Known ceiling|Upgrade trigger|upgrade when)\b/i.test(current.text)) continue;
    const ceiling = (current.text.match(/Known ceiling[: ]+([^.|]+)/i) || [])[1] || '';
    const upgrade = (current.text.match(/Upgrade trigger[: ]+([^.|]+)/i) || current.text.match(/upgrade when[: ]+([^.|]+)/i) || [])[1] || '';
    rows.push({
      source_type: 'implementation-notes',
      file: path.relative(projectDir, file).replace(/\\/g, '/'),
      line: current.line,
      kind: 'implementation-note',
      detail: current.text.trim(),
      ceiling: ceiling.trim(),
      upgrade_trigger: upgrade.trim(),
      risk: upgrade || hasUpgradeLanguage(current.text) ? 'tracked' : 'no-trigger',
      issue: upgrade || hasUpgradeLanguage(current.text) ? '' : 'missing-upgrade-trigger',
    });
  }
  return rows;
}

function outputPath(projectDir, basename) {
  const file = path.join(projectDir, 'context', basename);
  const resolved = path.resolve(file);
  if (!isPathInside(path.resolve(projectDir), resolved)) throw new Error('Lean debt output must stay inside --project-dir');
  return resolved;
}

function buildLeanDebt(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = safeProjectDir(opts.projectDir || defaultProjectDir(root));
  const markerScan = scanMarkers(root);
  const rows = [
    ...markerRows(markerScan.markers),
    ...leanDecisionRows(projectDir),
    ...implementationNoteRows(projectDir),
  ];
  const noTrigger = rows.filter((row) => row.risk === 'no-trigger');
  const byKind = {};
  const bySourceType = {};
  for (const row of rows) {
    byKind[row.kind] = (byKind[row.kind] || 0) + 1;
    bySourceType[row.source_type] = (bySourceType[row.source_type] || 0) + 1;
  }
  const result = {
    schema_version: '1',
    generated_at: isoNow(),
    root,
    project_dir: projectDir,
    status: noTrigger.length ? 'attention' : (rows.length ? 'ready' : 'clean'),
    markers: summarizeLeanMarkers(markerScan.markers),
    debt_count: rows.length,
    no_trigger_count: noTrigger.length,
    by_kind: byKind,
    by_source_type: bySourceType,
    rows,
    scan_errors: markerScan.errors,
    next: noTrigger.length ? 'add-upgrade-triggers' : '/forgeflow-lean-status',
    next_reason: noTrigger.length ? 'Some lean shortcuts do not name when to revisit or expand them.' : 'Lean shortcuts have visible upgrade triggers or no lean debt was found.',
    boundary: 'Read-only lean debt ledger by default. It scans local files and Forgeflow artifacts only; it does not edit code, delete markers, infer global policy, commit, push, or call the network.',
    artifacts: {},
  };
  if (opts.write) {
    const markdownPath = outputPath(projectDir, 'lean-debt.md');
    const jsonPath = outputPath(projectDir, 'lean-debt.json');
    writeFileSafe(markdownPath, renderMarkdown(result));
    writeJsonSafe(jsonPath, result);
    result.artifacts = { markdown: markdownPath, json: jsonPath };
  }
  return result;
}

function renderRow(row) {
  const loc = row.line ? `${row.file}:${row.line}` : row.file;
  const trigger = row.upgrade_trigger ? ` upgrade: ${row.upgrade_trigger}` : ' upgrade: missing';
  return `- ${loc} - ${row.kind}: ${row.detail || '(no detail)'} ceiling: ${row.ceiling || 'unspecified'}${trigger}${row.issue ? ` [${row.issue}]` : ''}`;
}

function renderMarkdown(result) {
  return [
    '# Forgeflow Lean Debt',
    '',
    `Status: ${result.status}`,
    `Debt rows: ${result.debt_count}`,
    `Missing upgrade trigger: ${result.no_trigger_count}`,
    '',
    result.boundary,
    '',
    '## Ledger',
    '',
    ...(result.rows.length ? result.rows.map(renderRow) : ['No lean debt markers found.']),
    '',
    '## Next',
    '',
    `${result.next} - ${result.next_reason}`,
    '',
  ].join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = buildLeanDebt(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
  } catch (err) {
    console.error(`lean debt failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  buildLeanDebt,
  hasUpgradeLanguage,
  markerRows,
  parseArgs,
  renderMarkdown,
};
