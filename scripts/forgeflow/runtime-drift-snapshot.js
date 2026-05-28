#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { RUNTIME_HELPERS, manifestEntry } = require('./install-manifest');

function usage() {
  console.error('Usage: runtime-drift-snapshot.js [--root <dir>] [--install-root <dir>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), installRoot: path.join(os.homedir(), '.claude'), json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--install-root') {
      opts.installRoot = path.resolve(requireValue(argv, arg, i));
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

function syntaxStatus(file) {
  if (!fs.existsSync(file) || !fs.lstatSync(file).isFile()) return 'missing';
  const result = file.endsWith('.sh')
    ? spawnSync('bash', ['-n', file], { encoding: 'utf8' })
    : spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  return result.status === 0 ? 'pass' : 'fail';
}

function fileMode(file) {
  if (!fs.existsSync(file)) return '';
  return (fs.statSync(file).mode & 0o777).toString(8);
}

function compareHelper(root, installRoot, source) {
  const sourcePath = path.join(root, source);
  const entry = manifestEntry(source, installRoot);
  const installedPath = entry ? entry.destination : '';
  const sourceExists = fs.existsSync(sourcePath);
  const installedExists = installedPath && fs.existsSync(installedPath);
  const sourceText = sourceExists ? fs.readFileSync(sourcePath, 'utf8') : '';
  const installedText = installedExists ? fs.readFileSync(installedPath, 'utf8') : '';
  const modeDrift = sourceExists && installedExists && fileMode(sourcePath) !== fileMode(installedPath);
  const contentDrift = sourceExists && installedExists && sourceText !== installedText;
  const syntax = installedExists ? syntaxStatus(installedPath) : 'missing';
  const status = !sourceExists || !installedExists || modeDrift || contentDrift || syntax === 'fail' ? 'drift' : 'match';
  return {
    source,
    source_path: sourcePath,
    installed_path: installedPath,
    status,
    source_exists: sourceExists,
    installed_exists: Boolean(installedExists),
    source_mode: sourceExists ? fileMode(sourcePath) : '',
    installed_mode: installedExists ? fileMode(installedPath) : '',
    content: contentDrift ? 'drift' : sourceExists && installedExists ? 'match' : 'missing',
    mode: modeDrift ? 'drift' : sourceExists && installedExists ? 'match' : 'missing',
    syntax,
  };
}

function buildRuntimeDriftSnapshot(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const installRoot = path.resolve(opts.installRoot || path.join(os.homedir(), '.claude'));
  const helpers = RUNTIME_HELPERS.map((source) => compareHelper(root, installRoot, source));
  const drift = helpers.filter((helper) => helper.status === 'drift');
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    install_root: installRoot,
    status: drift.length > 0 ? 'attention' : 'pass',
    checked: helpers.length,
    drift_count: drift.length,
    missing_installed: drift.filter((helper) => !helper.installed_exists).length,
    content_drift: drift.filter((helper) => helper.content === 'drift').length,
    mode_drift: drift.filter((helper) => helper.mode === 'drift').length,
    syntax_failures: drift.filter((helper) => helper.syntax === 'fail').length,
    helpers,
    recommendations: drift.length > 0 ? [{ action: '/update-forgeflow --repair', reason: 'Installed runtime helpers differ from source checkout.' }] : [],
    boundary: 'Runtime drift snapshot is read-only. It compares managed helper files and never repairs, updates, or deletes installed files.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Runtime Drift',
    '',
    `Status: ${result.status}`,
    `Checked: ${result.checked}`,
    `Drift: ${result.drift_count}`,
    '',
    result.boundary,
    '',
    '## Summary',
    '',
    `- Missing installed: ${result.missing_installed}`,
    `- Content drift: ${result.content_drift}`,
    `- Mode drift: ${result.mode_drift}`,
    `- Syntax failures: ${result.syntax_failures}`,
    '',
    '## Drifted Helpers',
    '',
  ];
  const drifted = result.helpers.filter((helper) => helper.status === 'drift');
  if (drifted.length === 0) lines.push('- None.');
  else for (const helper of drifted.slice(0, 30)) {
    lines.push(`- ${helper.source}: content ${helper.content}, mode ${helper.mode}, syntax ${helper.syntax}`);
  }
  if (drifted.length > 30) lines.push(`- ... ${drifted.length - 30} more`);
  lines.push('', '## Recommendations', '');
  if (result.recommendations.length === 0) lines.push('- None.');
  else for (const rec of result.recommendations) lines.push(`- ${rec.action}: ${rec.reason}`);
  lines.push('');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildRuntimeDriftSnapshot(opts);
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

module.exports = { buildRuntimeDriftSnapshot, compareHelper, parseArgs, renderMarkdown };
