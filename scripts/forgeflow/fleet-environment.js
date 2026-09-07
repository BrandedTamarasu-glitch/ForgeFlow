#!/usr/bin/env node
// Read-only fleet contract and actual-change validation. Commands are data, never executed.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { assertSafeDirectory, safeReadTextFile } = require('./file-safety');

function relativePath(value, label) {
  if (typeof value !== 'string' || !value || value.includes('\\') || /[\x00-\x1f*?\[\]]/.test(value)
    || path.posix.isAbsolute(value) || value.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error(`${label} must be a literal relative path without traversal or glob patterns`);
  }
  return value;
}

function overlaps(left, right) {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function validateContract(input) {
  if (!input || input.schema_version !== '1' || input.cleanup !== 'preserve-on-failure'
    || !Array.isArray(input.shards) || !input.shards.length || input.shards.length > 10) {
    throw new Error('Expected schema_version "1", cleanup "preserve-on-failure", and 1–10 shards');
  }
  const ids = new Set();
  const ports = new Set();
  const resources = new Set();
  const ownership = [];
  const worktrees = [];
  const shards = input.shards.map(shard => {
    if (!shard || typeof shard.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(shard.id) || ids.has(shard.id)) {
      throw new Error('Shard ids must be unique short identifiers');
    }
    ids.add(shard.id);
    const worktree = relativePath(shard.worktree, `${shard.id} worktree`);
    if (worktrees.some(previous => overlaps(previous, worktree))) throw new Error(`Overlapping worktree: ${worktree}`);
    worktrees.push(worktree);
    if (!Array.isArray(shard.files) || !shard.files.length) throw new Error(`${shard.id} requires owned files or directories`);
    const files = shard.files.map(file => relativePath(file, `${shard.id} file`));
    for (const file of files) {
      const conflict = ownership.find(previous => overlaps(previous.file, file));
      if (conflict) throw new Error(`Ownership overlap: ${shard.id}:${file} conflicts with ${conflict.id}:${conflict.file}`);
      ownership.push({ id: shard.id, file });
    }
    if (!Array.isArray(shard.ports) || !Array.isArray(shard.resources)) throw new Error(`${shard.id} requires ports and resources arrays`);
    for (const port of shard.ports) {
      if (!Number.isInteger(port) || port < 1 || port > 65535 || ports.has(port)) throw new Error(`Invalid or duplicate port: ${port}`);
      ports.add(port);
    }
    for (const resource of shard.resources) {
      if (typeof resource !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(resource) || resources.has(resource)) {
        throw new Error(`Invalid or duplicate resource: ${resource}`);
      }
      resources.add(resource);
    }
    for (const name of ['setup', 'validation']) {
      if (!Array.isArray(shard[name]) || (name === 'validation' && !shard[name].length)) throw new Error(`${shard.id} requires ${name} command arrays`);
      for (const argv of shard[name]) {
        if (!Array.isArray(argv) || !argv.length || argv.some(arg => typeof arg !== 'string' || arg.includes('\0')) || !argv[0].trim()) {
          throw new Error(`${shard.id} ${name} commands must be nonempty argv arrays without NUL bytes`);
        }
      }
    }
    const base = shard.base;
    if (typeof base !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(base)) {
      throw new Error(`${shard.id} requires a pinned full starting commit SHA; missing bases and moving refs cannot prove ownership`);
    }
    return { id: shard.id, worktree, files, ports: shard.ports, resources: shard.resources, setup: shard.setup, validation: shard.validation, base };
  });
  return { schema_version: '1', cleanup: input.cleanup, shards };
}

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 10000, maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(`Cannot inspect git workspace: ${result.error ? result.error.message : result.stderr.trim()}`);
  return result.stdout;
}

function inspectFleet(input, root = process.cwd()) {
  const contract = validateContract(input);
  root = fs.realpathSync(root);
  const common = fs.realpathSync(git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim());
  const shards = contract.shards.map(shard => {
    const directory = path.join(root, shard.worktree);
    assertSafeDirectory(directory);
    if (fs.realpathSync(directory) !== directory) throw new Error(`Unsafe worktree path: ${shard.worktree}`);
    if (fs.realpathSync(git(directory, ['rev-parse', '--show-toplevel']).trim()) !== directory) throw new Error(`${shard.id} must identify an actual worktree root`);
    if (fs.realpathSync(git(directory, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim()) !== common) throw new Error(`${shard.id} belongs to a different repository`);
    const base = git(directory, ['rev-parse', '--verify', `${shard.base}^{commit}`]).trim();
    if (base !== shard.base) throw new Error(`${shard.id} base must identify the starting commit itself`);
    // Inspect each Git layer separately: later edits can cancel earlier bytes
    // without removing the committed or staged change that will be accepted.
    const diffArgs = ['diff', '--no-ext-diff', '--no-textconv', '--name-only', '--no-renames', '-z'];
    const changed = [...new Set([
      ...git(directory, [...diffArgs, base, 'HEAD', '--']).split('\0'),
      ...git(directory, [...diffArgs, '--cached', 'HEAD', '--']).split('\0'),
      ...git(directory, [...diffArgs, '--']).split('\0'),
      ...git(directory, ['ls-files', '--others', '--exclude-standard', '-z']).split('\0'),
    ].filter(Boolean))].sort();
    const unowned = changed.filter(file => !shard.files.some(owned => file === owned || file.startsWith(`${owned}/`)));
    return { id: shard.id, worktree: shard.worktree, base, changed, unowned, status: unowned.length ? 'attention' : 'ready' };
  });
  return {
    schema_version: '1', status: shards.some(shard => shard.unowned.length) ? 'attention' : 'ready', shards,
    boundary: 'Read-only contract and ownership check. Ports and resource names are declarations, not reservations. No commands, services, setup, merges, or cleanup were executed.',
  };
}

function main(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!['--contract', '--root'].includes(argv[i]) || !argv[i + 1]) throw new Error('Usage: fleet-environment.js --contract <json-file> [--root <repository>]');
    options[argv[i]] = argv[i + 1];
  }
  if (!options['--contract']) throw new Error('A --contract JSON file is required');
  const file = path.resolve(options['--contract']);
  const input = JSON.parse(safeReadTextFile(file).content);
  const result = inspectFleet(input, options['--root']);
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'ready') process.exitCode = 1;
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { validateContract, inspectFleet, overlaps };
