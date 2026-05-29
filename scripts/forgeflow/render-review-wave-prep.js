#!/usr/bin/env node
const path = require('path');
const { buildContextWavePlan } = require('./render-context-wave-plan');

function usage() {
  console.error('Usage: render-review-wave-prep.js [--root <repo>] [--context-dir <dir>] [--target-tokens <n>] [--write-wave-files] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), contextDir: '', targetTokens: 16000, writeWaveFiles: false, json: false };
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

function buildReviewWavePrep(opts = {}) {
  const wavePlan = buildContextWavePlan(opts);
  const firstWave = wavePlan.waves[0] || null;
  const splitRecommended = wavePlan.status === 'split-recommended' && wavePlan.waves.length > 1;
  const incomplete = wavePlan.status === 'incomplete';
  return {
    schema_version: '1',
    status: incomplete ? 'context-incomplete' : (splitRecommended ? 'split-before-review' : 'current-packet-ok'),
    root: wavePlan.root,
    context_dir: wavePlan.context_dir,
    current_compact_tokens: wavePlan.current_compact_tokens,
    target_compact_tokens: wavePlan.target_compact_tokens,
    over_by_tokens: wavePlan.over_by_tokens,
    wave_files_written: wavePlan.wave_files_written,
    incomplete_reasons: wavePlan.incomplete_reasons || [],
    first_wave: firstWave,
    waves: wavePlan.waves,
    next: incomplete
      ? 'Rebuild the context pack before review.'
      : (splitRecommended && firstWave
      ? firstWave.command
      : 'Use the current context pack for review.'),
    next_reason: incomplete
      ? `The latest context pack is incomplete: ${(wavePlan.incomplete_reasons || []).join('; ')}.`
      : (splitRecommended
      ? 'Context is over budget; start review with the first generated or planned wave.'
      : 'Context is within budget or too small to split.'),
    boundary: 'Review wave prep is advisory. It does not rebuild packets, spawn reviewers, edit source files, commit, or push.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Review Wave Prep',
    '',
    `Status: ${result.status}`,
    `Current compact tokens: ${result.current_compact_tokens}`,
    `Target compact tokens: ${result.target_compact_tokens}`,
    `Over by: ${result.over_by_tokens}`,
    '',
    result.boundary,
    '',
    '## First Wave',
    '',
  ];
  if (!result.first_wave) {
    lines.push('- None.');
  } else {
    lines.push(`- ${result.first_wave.name}: ${result.first_wave.files.length} file(s)`);
    if (result.first_wave.wave_file) lines.push(`  - File list: ${result.first_wave.wave_file}`);
    lines.push(`  - Command: ${result.first_wave.command}`);
  }
  lines.push('', `Next: ${result.next}`, `Why: ${result.next_reason}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildReviewWavePrep(opts);
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

module.exports = { buildReviewWavePrep, parseArgs, renderMarkdown };
