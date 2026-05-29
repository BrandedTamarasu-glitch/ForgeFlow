#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildContextPack, jsonSummary } = require('./build-context-pack');
const { buildContextWavePlan } = require('./render-context-wave-plan');
const { assertSafeDirectory, isPathInside } = require('./file-safety');

function usage() {
  console.error([
    'Usage: build-context-wave.js [--root <repo>] [--context-dir <dir>] [--target-tokens <n>]',
    '       [--wave <name>] [--max-memory-chars <n>] [--max-diff-chars <n>] [--json]',
  ].join('\n'));
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = {
    root: process.cwd(),
    contextDir: '',
    targetTokens: 16000,
    wave: '',
    maxMemoryChars: 4000,
    maxDiffChars: 9000,
    json: false,
  };
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
    } else if (arg === '--wave') {
      opts.wave = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--max-memory-chars') {
      opts.maxMemoryChars = Math.max(1000, Number.parseInt(requireValue(argv, arg, i), 10) || 4000);
      i += 1;
    } else if (arg === '--max-diff-chars') {
      opts.maxDiffChars = Math.max(1000, Number.parseInt(requireValue(argv, arg, i), 10) || 9000);
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

function waveOutputDir(root, contextDir, waveName) {
  const dir = path.join(contextDir, 'waves', waveName, 'context-pack');
  if (!isPathInside(root, dir)) {
    throw new Error(`Refusing to write context wave outside repo root: ${dir}`);
  }
  assertSafeDirectory(path.dirname(dir));
  return dir;
}

function selectWave(plan, requestedName) {
  if (!requestedName) return plan.waves[0] || null;
  return (plan.waves || []).find((wave) => wave.name === requestedName) || null;
}

function buildContextWave(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const contextDir = path.resolve(opts.contextDir || defaultContextDir(root));
  const readOnlyPlan = buildContextWavePlan({
    root,
    contextDir,
    targetTokens: opts.targetTokens || 16000,
    writeWaveFiles: false,
  });
  if (readOnlyPlan.status === 'incomplete') {
    return {
      schema_version: '1',
      status: 'context-incomplete',
      root,
      context_dir: contextDir,
      requested_wave: opts.wave || '',
      built_wave: null,
      wave_plan: readOnlyPlan,
      next: 'Rebuild the latest context pack before building a review wave.',
      next_reason: readOnlyPlan.next_reason,
      boundary: 'Context wave build stopped before rebuilding packets because the latest context pack is incomplete.',
    };
  }
  if (readOnlyPlan.status !== 'split-recommended' || readOnlyPlan.waves.length <= 1) {
    return {
      schema_version: '1',
      status: 'current-packet-ok',
      root,
      context_dir: contextDir,
      requested_wave: opts.wave || '',
      built_wave: null,
      wave_plan: readOnlyPlan,
      next: 'Use the current context pack for review.',
      next_reason: readOnlyPlan.next_reason,
      boundary: 'Context wave build did not rebuild packets because the current pack does not need a split.',
    };
  }
  const plannedWave = selectWave(readOnlyPlan, opts.wave || '');
  if (!plannedWave) {
    return {
      schema_version: '1',
      status: 'wave-not-found',
      root,
      context_dir: contextDir,
      requested_wave: opts.wave || '',
      built_wave: null,
      wave_plan: readOnlyPlan,
      next: `Choose one of: ${readOnlyPlan.waves.map((item) => item.name).join(', ')}`,
      next_reason: `Requested wave was not found: ${opts.wave || '(none)'}.`,
      boundary: 'Context wave build did not rebuild packets because the requested wave was not available.',
    };
  }
  const plan = buildContextWavePlan({
    root,
    contextDir,
    targetTokens: opts.targetTokens || 16000,
    writeWaveFiles: true,
  });
  const wave = selectWave(plan, opts.wave || '');
  const waveFile = path.join(root, wave.wave_file);
  if (!wave.wave_file || !fs.existsSync(waveFile)) {
    throw new Error(`Wave file was not written: ${wave.wave_file || '(missing)'}`);
  }
  const outDir = waveOutputDir(root, contextDir, wave.name);
  const pack = buildContextPack({
    root,
    out: outDir,
    filesPath: waveFile,
    maxMemoryChars: opts.maxMemoryChars || 4000,
    maxDiffChars: opts.maxDiffChars || 9000,
    task: `Review context wave: ${wave.name}`,
  });
  const packSummary = jsonSummary(pack);
  return {
    schema_version: '1',
    status: 'built',
    root,
    context_dir: contextDir,
    requested_wave: opts.wave || '',
    built_wave: {
      name: wave.name,
      files: wave.files,
      file_list: wave.wave_file,
      out_dir: path.relative(root, outDir),
      packet_count: packSummary.packet_count,
      agents: packSummary.agents,
      estimated_compact_tokens: pack.telemetry.estimated_compact_tokens,
      budget_status: pack.budget.status,
    },
    wave_plan: plan,
    next: `Use ${path.relative(root, outDir)} as the focused context pack for the first review wave.`,
    next_reason: 'The broad context pack was split and the selected wave packet was rebuilt from an explicit file list.',
    boundary: 'Context wave build writes wave file lists and one focused context pack only. It does not spawn reviewers, edit source files, commit, or push.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Context Wave Build',
    '',
    `Status: ${result.status}`,
    '',
    result.boundary,
    '',
  ];
  if (result.built_wave) {
    lines.push('## Built Wave', '');
    lines.push(`- Name: ${result.built_wave.name}`);
    lines.push(`- Files: ${result.built_wave.files.length}`);
    lines.push(`- File list: ${result.built_wave.file_list}`);
    lines.push(`- Context pack: ${result.built_wave.out_dir}`);
    lines.push(`- Agents: ${result.built_wave.agents.join(', ') || '(none)'}`);
    lines.push(`- Budget: ${result.built_wave.budget_status}`);
    lines.push('');
  }
  if (result.wave_plan && result.wave_plan.incomplete_reasons && result.wave_plan.incomplete_reasons.length > 0) {
    lines.push(`Incomplete because: ${result.wave_plan.incomplete_reasons.join('; ')}`, '');
  }
  lines.push(`Next: ${result.next}`, `Why: ${result.next_reason}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildContextWave(opts);
  process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.stack || err.message);
    usage();
    process.exit(1);
  }
}

module.exports = { buildContextWave, parseArgs, renderMarkdown };
