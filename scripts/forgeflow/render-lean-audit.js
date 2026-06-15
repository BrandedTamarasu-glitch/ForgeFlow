#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { isPathInside, safeReadTextFile, writeFileSafe, writeJsonSafe } = require('./file-safety');
const { buildLeanDebt } = require('./render-lean-debt');

const IGNORE_DIRS = new Set(['.git', '.forgeflow', 'node_modules', 'dist', 'build', 'coverage', '.next', 'out', 'vendor', '.venv', 'venv']);
const TEXT_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.rb', '.go', '.rs', '.java', '.kt', '.cs', '.php', '.sh', '.md', '.mdx', '.txt', '.json', '.yaml', '.yml', '.toml']);
const HARD_BOUNDARY_RE = /\b(auth|authorization|permission|security|secret|token|password|crypto|migration|schema|database|payment|money|invoice|ledger|a11y|accessibility|keyboard|screen reader|validation|sanitize|csrf|xss|data loss)\b/i;
const KNOWN_NATIVE_REPLACEMENTS = {
  moment: 'Intl.DateTimeFormat or Temporal when available',
  lodash: 'native Array/Object helpers for small local use',
  underscore: 'native Array/Object helpers',
  axios: 'fetch for simple HTTP calls',
  uuid: 'crypto.randomUUID when runtime support is acceptable',
};

function usage() {
  console.error('Usage: render-lean-audit.js [--root <repo>] [--project-dir <dir>] [--write] [--json]');
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
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) walkFiles(file, root, files);
    else if (entry.isFile() && isLikelyText(file)) files.push(file);
  }
  return files;
}

function readJson(file, projectDir) {
  try {
    if (!fs.existsSync(file)) return null;
    const parsed = JSON.parse(safeReadTextFile(file, projectDir).content);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (_err) {
    return null;
  }
}

function readProjectArtifacts(projectDir) {
  return {
    topology: readJson(path.join(projectDir, 'context', 'code-topology.json'), projectDir)
      || readJson(path.join(projectDir, 'context', 'latest', 'code-topology.json'), projectDir)
      || {},
    invocation: readJson(path.join(projectDir, 'context', 'invocation-hints.json'), projectDir)
      || readJson(path.join(projectDir, 'context', 'latest', 'invocation-hints.json'), projectDir)
      || {},
  };
}

function nodeByPath(topology) {
  const map = new Map();
  for (const node of Array.isArray(topology.nodes) ? topology.nodes : []) {
    const file = normalizePath(node.path || node.file || node.id || '');
    if (file) map.set(file, node);
  }
  return map;
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function lineOf(text, pattern) {
  const lines = String(text || '').split(/\r?\n/);
  const index = lines.findIndex((line) => pattern.test(line));
  return index >= 0 ? index + 1 : 1;
}

function makeFinding({ file, line = 1, cls, title, replacement, evidence, confidence = 'medium', estimatedNetLines = 1, projectEvidence = [] }) {
  return {
    id: `lean-audit-${cls}-${file.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}`,
    source: 'forgeflow-lean-audit',
    class: cls,
    file,
    line,
    title,
    replacement,
    evidence,
    confidence,
    estimated_net_lines: estimatedNetLines,
    project_evidence: projectEvidence,
  };
}

function packageFindings(root) {
  const findings = [];
  const file = path.join(root, 'package.json');
  if (!fs.existsSync(file)) return findings;
  let pkg = null;
  try {
    pkg = JSON.parse(safeReadTextFile(file, root).content);
  } catch (_err) {
    return findings;
  }
  const deps = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
  for (const [name, replacement] of Object.entries(KNOWN_NATIVE_REPLACEMENTS)) {
    if (!deps[name]) continue;
    findings.push(makeFinding({
      file: 'package.json',
      line: 1,
      cls: 'native',
      title: `Dependency ${name} may be avoidable for simple local usage.`,
      replacement,
      evidence: `package.json declares ${name}; verify call sites before removal.`,
      confidence: 'low',
      estimatedNetLines: 1,
    }));
  }
  return findings;
}

function textFindings(root, artifacts) {
  const findings = [];
  const skipped = [];
  const topology = nodeByPath(artifacts.topology || {});
  for (const file of walkFiles(root, root)) {
    const rel = normalizePath(path.relative(root, file));
    let text = '';
    try {
      text = safeReadTextFile(file, root).content;
    } catch (_err) {
      continue;
    }
    if (HARD_BOUNDARY_RE.test(`${rel}\n${text}`)) {
      skipped.push({ file: rel, reasons: ['hard-boundary-scope'] });
      continue;
    }
    if (/\.(test|spec)\.(js|jsx|ts|tsx)$/.test(rel) || /(^|\/)(__tests__|tests|e2e)\//.test(rel)) {
      skipped.push({ file: rel, reasons: ['validation-scope'] });
      continue;
    }
    const node = topology.get(rel) || {};
    const projectEvidence = Object.keys(node).length ? [`static topology: fan-in ${node.fan_in || 0}, fan-out ${node.fan_out || 0}`] : [];
    if (/\b(Abstract\w+|I[A-Z]\w+|create[A-Z]\w*Factory|StrategyFactory|PluginRegistry)\b/.test(text) && (node.fan_in || 0) <= 1) {
      findings.push(makeFinding({
        file: rel,
        line: lineOf(text, /\b(Abstract\w+|I[A-Z]\w+|create[A-Z]\w*Factory|StrategyFactory|PluginRegistry)\b/),
        cls: 'yagni',
        title: 'Abstraction appears to have no repeated static caller evidence.',
        replacement: 'Inline or keep one concrete implementation until a second caller exists.',
        evidence: 'Factory/interface/registry naming with fan-in at or below one.',
        confidence: Object.keys(node).length ? 'medium' : 'low',
        estimatedNetLines: 8,
        projectEvidence,
      }));
    }
    if (/\b(future[- ]?proof|eventually|nice to have|extensible|for later)\b/i.test(text)) {
      findings.push(makeFinding({
        file: rel,
        line: lineOf(text, /\b(future[- ]?proof|eventually|nice to have|extensible|for later)\b/i),
        cls: 'yagni',
        title: 'Future-facing structure should wait for current evidence.',
        replacement: 'Keep only the behavior needed by the current requirement.',
        evidence: 'File contains future-proofing language.',
        confidence: 'medium',
        estimatedNetLines: 5,
        projectEvidence,
      }));
    }
    if (/\bfunction\s+\w+\s*\([^)]*\)\s*\{\s*return\s+\w+\([^)]*\);?\s*\}/s.test(text)) {
      findings.push(makeFinding({
        file: rel,
        line: lineOf(text, /\bfunction\s+\w+\s*\(/),
        cls: 'delete',
        title: 'Wrapper appears to only delegate.',
        replacement: 'Call the target directly unless the wrapper owns behavior.',
        evidence: 'Function body returns one delegated call.',
        confidence: 'low',
        estimatedNetLines: 3,
        projectEvidence,
      }));
    }
  }
  return { findings, skipped };
}

function debtFindings(root, projectDir) {
  const debt = buildLeanDebt({ root, projectDir });
  return (debt.rows || [])
    .filter((row) => row.risk === 'no-trigger')
    .map((row) => makeFinding({
      file: row.file,
      line: row.line || 1,
      cls: 'marker-debt',
      title: 'Lean shortcut is missing an upgrade trigger.',
      replacement: 'Add an explicit upgrade trigger or remove the shortcut marker.',
      evidence: row.issue || 'missing upgrade trigger',
      confidence: 'high',
      estimatedNetLines: 0,
      projectEvidence: [`source: ${row.source_type}`],
    }));
}

function scoreFinding(finding) {
  const confidence = { high: 30, medium: 20, low: 10 }[finding.confidence] || 10;
  const size = Math.min(Number(finding.estimated_net_lines || 0), 30);
  const cls = finding.class === 'marker-debt' ? 8 : 0;
  return confidence + size + cls;
}

function outputPath(projectDir, basename) {
  const file = path.join(projectDir, 'context', basename);
  const resolved = path.resolve(file);
  if (!isPathInside(path.resolve(projectDir), resolved)) throw new Error('Lean audit output must stay inside --project-dir');
  return resolved;
}

function buildLeanAudit(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = safeProjectDir(opts.projectDir || defaultProjectDir(root));
  const artifacts = readProjectArtifacts(projectDir);
  const text = textFindings(root, artifacts);
  const findings = [
    ...packageFindings(root),
    ...text.findings,
    ...debtFindings(root, projectDir),
  ].map((finding) => Object.assign({}, finding, { score: scoreFinding(finding) }))
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))
    .slice(0, 50);
  const result = {
    schema_version: '1',
    generated_at: isoNow(),
    root,
    project_dir: projectDir,
    status: findings.length ? 'attention' : 'clean',
    finding_count: findings.length,
    estimated_net_lines: findings.reduce((sum, item) => sum + Number(item.estimated_net_lines || 0), 0),
    findings,
    skipped: text.skipped,
    artifacts: {
      topology: artifacts.topology && Object.keys(artifacts.topology).length ? 'present' : 'missing',
      invocation: artifacts.invocation && Object.keys(artifacts.invocation).length ? 'present' : 'missing',
    },
    next: findings.length ? 'review-lean-audit-findings' : '/forgeflow-lean-status',
    next_reason: findings.length ? 'Review ranked over-engineering candidates before changing code.' : 'No static lean audit findings were found.',
    boundary: 'Read-only repo-wide lean audit. Findings are advisory static signals only; this does not delete code, remove dependencies, apply review-auto fixes, claim runtime call-graph proof, commit, push, or call the network.',
    write_artifacts: {},
  };
  if (opts.write) {
    const markdownPath = outputPath(projectDir, 'lean-audit.md');
    const jsonPath = outputPath(projectDir, 'lean-audit.json');
    writeFileSafe(markdownPath, renderMarkdown(result));
    writeJsonSafe(jsonPath, result);
    result.write_artifacts = { markdown: markdownPath, json: jsonPath };
  }
  return result;
}

function renderFinding(finding) {
  return `- ${finding.file}:${finding.line} ${finding.class} (${finding.confidence}, score ${finding.score}): ${finding.title} Replacement: ${finding.replacement}`;
}

function renderMarkdown(result) {
  return [
    '# Forgeflow Lean Audit',
    '',
    `Status: ${result.status}`,
    `Findings: ${result.finding_count}`,
    `Estimated net-line reduction: ${result.estimated_net_lines}`,
    '',
    result.boundary,
    '',
    '## Findings',
    '',
    ...(result.findings.length ? result.findings.map(renderFinding) : ['Lean already. Ship.']),
    '',
    '## Skipped',
    '',
    ...(result.skipped.length ? result.skipped.slice(0, 20).map((item) => `- ${item.file}: ${item.reasons.join(', ')}`) : ['No hard-boundary skips.']),
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
    const result = buildLeanAudit(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
  } catch (err) {
    console.error(`lean audit failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  buildLeanAudit,
  packageFindings,
  parseArgs,
  renderMarkdown,
  textFindings,
};
