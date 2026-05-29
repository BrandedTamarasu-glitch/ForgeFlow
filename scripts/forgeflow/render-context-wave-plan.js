#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { estimateTokens } = require('./context-telemetry');
const { safeReadTextFile } = require('./file-safety');

function usage() {
  console.error('Usage: render-context-wave-plan.js [--root <repo>] [--context-dir <dir>] [--target-tokens <n>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), contextDir: '', targetTokens: 16000, json: false };
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
  for (let i = 0; i < files.length; i += maxFilesPerWave) {
    const slice = files.slice(i, i + maxFilesPerWave);
    const compactTokens = estimateTokens(slice.reduce((sum, item) => sum + Number(item.size_bytes || 0), 0));
    waves.push({
      name: waveName(waves.length),
      files: slice.map((item) => item.path),
      kinds: [...new Set(slice.map((item) => item.kind || 'unknown'))],
      estimated_file_tokens: compactTokens,
      command: `build-context-pack --files <${waveName(waves.length)}-files.txt> --max-memory-chars 4000 --max-diff-chars 9000`,
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
    agent_count: synthesis.agent_packets ? Object.keys(synthesis.agent_packets).length : 0,
    file_count: files.length,
    waves,
    next: waves.length > 1 ? waves[0].command : 'Use the current context pack as-is.',
    next_reason: waves.length > 1
      ? 'The latest context pack is over budget or broad enough to benefit from staged review waves.'
      : 'The latest context pack is within the target budget or has too few files to split.',
    boundary: 'Context wave plan is read-only. It does not rebuild packets, spawn agents, edit files, commit, or push.',
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
  if (result.waves.length === 0) lines.push('- None.');
  for (const wave of result.waves) {
    lines.push(`- ${wave.name}: ${wave.files.length} file(s), kinds ${wave.kinds.join(', ') || '(none)'}`);
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
