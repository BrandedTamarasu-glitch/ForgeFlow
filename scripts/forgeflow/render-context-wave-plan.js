#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { estimateTokens } = require('./context-telemetry');
const { assertSafeDirectory, isPathInside, safeReadTextFile, writeFileSafe } = require('./file-safety');

function usage() {
  console.error('Usage: render-context-wave-plan.js [--root <repo>] [--context-dir <dir>] [--target-tokens <n>] [--write-wave-files] [--wave-dir <dir>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), contextDir: '', targetTokens: 16000, writeWaveFiles: false, waveDir: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--context-dir') {
      opts.contextDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--target-tokens') {
      opts.targetTokens = Math.max(1000, Number.parseInt(requireValue(argv, arg, i), 10) || 16000);
      i += 1;
    } else if (arg === '--write-wave-files') {
      opts.writeWaveFiles = true;
    } else if (arg === '--wave-dir') {
      opts.waveDir = path.resolve(requireValue(argv, arg, i));
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

function defaultContextDir(root) {
  return path.join(root, '.forgeflow', path.basename(root), 'context', 'latest');
}

function readJson(file, root) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(safeReadTextFile(file, root).content);
}

function riskRank(kind) {
  return {
    security: 0,
    data: 1,
    service: 2,
    code: 3,
    frontend: 4,
    test: 5,
    docs: 6,
  }[kind] ?? 7;
}

function waveName(index) {
  return ['risk-core', 'product-surface', 'tests-and-docs', 'remaining'][index] || `wave-${index + 1}`;
}

function safeWaveDir(root, contextDir, waveDir) {
  const dir = path.resolve(waveDir || path.join(contextDir, 'waves'));
  if (!isPathInside(root, dir)) {
    throw new Error(`Refusing to write wave files outside repo root: ${dir}`);
  }
  assertSafeDirectory(dir);
  return dir;
}

function waveCommand(root, name, file) {
  const placeholder = `<${name}-files.txt>`;
  if (!file) return `build-context-pack --files ${placeholder} --max-memory-chars 4000 --max-diff-chars 9000`;
  return `build-context-pack --files ${path.relative(root, file)} --max-memory-chars 4000 --max-diff-chars 9000`;
}

function writeWaveFile(file, files) {
  writeFileSafe(file, `${files.join('\n')}${files.length > 0 ? '\n' : ''}`);
}

function buildContextWavePlan(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const contextDir = path.resolve(opts.contextDir || defaultContextDir(root));
  const manifest = readJson(path.join(contextDir, 'file-manifest.json'), contextDir) || { files: [] };
  const telemetry = readJson(path.join(contextDir, 'context-telemetry.json'), contextDir) || {};
  const synthesis = readJson(path.join(contextDir, 'synthesis-input.json'), contextDir) || {};
  const targetTokens = Math.max(1000, Number(opts.targetTokens || 16000));
  const currentTokens = Number(telemetry.estimated_compact_tokens || 0);
  const files = (manifest.files || []).slice().sort((a, b) => riskRank(a.kind) - riskRank(b.kind) || String(a.path).localeCompare(String(b.path)));
  const estimatedPerFile = files.length > 0 ? Math.max(100, Math.ceil((currentTokens || targetTokens) / Math.max(files.length, 1))) : 0;
  const maxFilesPerWave = estimatedPerFile > 0 ? Math.max(1, Math.floor(targetTokens / estimatedPerFile)) : files.length || 1;
  const waves = [];
  const waveDir = opts.writeWaveFiles ? safeWaveDir(root, contextDir, opts.waveDir) : '';
  for (let i = 0; i < files.length; i += maxFilesPerWave) {
    const slice = files.slice(i, i + maxFilesPerWave);
    const name = waveName(waves.length);
    const fileList = slice.map((item) => item.path);
    const waveFile = waveDir ? path.join(waveDir, `${name}-files.txt`) : '';
    if (waveFile) writeWaveFile(waveFile, fileList);
    const compactTokens = estimateTokens(slice.reduce((sum, item) => sum + Number(item.size_bytes || 0), 0));
    waves.push({
      name,
      files: fileList,
      kinds: [...new Set(slice.map((item) => item.kind || 'unknown'))],
      estimated_file_tokens: compactTokens,
      wave_file: waveFile ? path.relative(root, waveFile) : '',
      command: waveCommand(root, name, waveFile),
    });
  }
  const overBy = Math.max(0, currentTokens - targetTokens);
  return {
    schema_version: '1',
    status: currentTokens > targetTokens ? 'split-recommended' : 'within-budget',
    root,
    context_dir: contextDir,
    current_compact_tokens: currentTokens,
    target_compact_tokens: targetTokens,
    over_by_tokens: overBy,
    wave_files_written: Boolean(waveDir),
    wave_dir: waveDir ? path.relative(root, waveDir) : '',
    agent_count: synthesis.agent_packets ? Object.keys(synthesis.agent_packets).length : 0,
    file_count: files.length,
    waves,
    next: waves.length > 1 ? waves[0].command : 'Use the current context pack as-is.',
    next_reason: waves.length > 1
      ? 'The latest context pack is over budget or broad enough to benefit from staged review waves.'
      : 'The latest context pack is within the target budget or has too few files to split.',
    boundary: waveDir
      ? 'Context wave plan wrote explicit wave file lists only. It did not rebuild packets, spawn agents, commit, or push.'
      : 'Context wave plan is read-only. It does not rebuild packets, spawn agents, edit files, commit, or push.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Context Wave Plan',
    '',
    `Status: ${result.status}`,
    `Current compact tokens: ${result.current_compact_tokens}`,
    `Target compact tokens: ${result.target_compact_tokens}`,
    `Over by: ${result.over_by_tokens}`,
    '',
    result.boundary,
    '',
    '## Waves',
    '',
  ];
  if (result.wave_files_written) lines.push(`Wave files: ${result.wave_dir}`, '');
  if (result.waves.length === 0) lines.push('- None.');
  for (const wave of result.waves) {
    lines.push(`- ${wave.name}: ${wave.files.length} file(s), kinds ${wave.kinds.join(', ') || '(none)'}`);
    if (wave.wave_file) lines.push(`  - File list: ${wave.wave_file}`);
    lines.push(`  - Command: ${wave.command}`);
  }
  lines.push('', `Next: ${result.next}`, `Why: ${result.next_reason}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildContextWavePlan(opts);
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

module.exports = { buildContextWavePlan, parseArgs, renderMarkdown };
