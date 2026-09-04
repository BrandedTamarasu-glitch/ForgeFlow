#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { cleanText, projectLearningId } = require('./record-project-learning');

function usage() {
  console.error('Usage: project-learning-conflicts.js [--project-dir <dir>] [--input <jsonl-file>] [--json]');
}

function parseArgs(argv, options = {}) {
  const exitOnError = options.exitOnError !== false;
  const opts = { projectDir: '', input: '', json: false };
  function fail(message) {
    if (exitOnError) { console.error(message); usage(); process.exit(2); }
    const error = new Error(message);
    error.exitCode = 2;
    throw error;
  }
  function value(name, index) {
    const next = argv[index + 1] || '';
    if (!next || next.startsWith('--')) fail(`Missing value for ${name}`);
    return path.resolve(next);
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--project-dir') { opts.projectDir = value(arg, index); index += 1; }
    else if (arg === '--input') { opts.input = value(arg, index); index += 1; }
    else if (arg === '--json') opts.json = true;
    else if (arg === '--help' || arg === '-h') { usage(); if (exitOnError) process.exit(0); return opts; }
    else fail(`Unknown argument: ${arg}`);
  }
  return opts;
}

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trimEnd() : '';
}

function repoRoot(cwd = process.cwd()) { return git(['rev-parse', '--show-toplevel'], cwd) || cwd; }
function defaultProjectDir(root) { return path.join(root, '.forgeflow', path.basename(root)); }

function candidateStatus(entry) {
  const value = cleanText(entry && entry.status ? entry.status : 'active').toLowerCase();
  return ['active', 'stale', 'superseded'].includes(value) ? value : 'invalid';
}

// JSONL is append-only: an updated lifecycle record replaces an earlier record
// with the same stable learning id for all conflict decisions.
function resolvedCandidates(candidates) {
  const latest = new Map();
  for (const entry of Array.isArray(candidates) ? candidates : []) {
    if (entry && typeof entry === 'object') latest.set(projectLearningId(entry), entry);
  }
  return [...latest.values()];
}

function conflictMetadata(entry) {
  const key = cleanText(entry && entry.conflict_key).toLowerCase();
  const value = cleanText(entry && entry.conflict_value).toLowerCase();
  return key && value ? { key, value } : null;
}

// Only explicit, structured metadata can form a conflict. Similar prose is not
// inspected or inferred because that would turn a recall helper into a judge.
function findProjectLearningConflicts(candidates) {
  const byKey = new Map();
  for (const entry of resolvedCandidates(candidates)) {
    if (candidateStatus(entry) !== 'active') continue;
    const metadata = conflictMetadata(entry);
    if (!metadata) continue;
    const group = byKey.get(metadata.key) || new Map();
    const entries = group.get(metadata.value) || [];
    entries.push(entry);
    group.set(metadata.value, entries);
    byKey.set(metadata.key, group);
  }

  const conflicts = [];
  for (const [key, values] of byKey) {
    if (values.size < 2) continue;
    const ids = [...values.values()].flat().map((entry) => projectLearningId(entry)).sort();
    conflicts.push({ key, values: values.size, candidates: ids.length, ids });
  }
  return conflicts.sort((left, right) => left.key.localeCompare(right.key));
}

function conflictedLearningIds(candidates) {
  return new Set(findProjectLearningConflicts(candidates).flatMap((conflict) => conflict.ids));
}

function activeUnconflictedLearningCandidates(candidates) {
  const withheld = conflictedLearningIds(candidates);
  return resolvedCandidates(candidates).filter((entry) => candidateStatus(entry) === 'active' && !withheld.has(projectLearningId(entry)));
}

function conflictSummary(candidates) {
  const conflicts = findProjectLearningConflicts(candidates);
  return {
    conflict_groups: conflicts.length,
    conflict_candidates_withheld: conflicts.reduce((total, conflict) => total + conflict.candidates, 0),
  };
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).flatMap((line) => {
    if (!line.trim()) return [];
    try { return [JSON.parse(line)]; } catch (_err) { return []; }
  });
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const projectDir = opts.projectDir || defaultProjectDir(repoRoot());
  const input = opts.input || path.join(projectDir, 'project-learning-candidates.jsonl');
  const candidates = readJsonl(input);
  const result = { schema_version: '1', input, ...conflictSummary(candidates) };
  if (opts.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else console.log(`Project-learning conflicts: ${result.conflict_groups} group(s), ${result.conflict_candidates_withheld} candidate(s) withheld.`);
}

if (require.main === module) {
  try { main(); } catch (err) { console.error(err.message); process.exit(1); }
}

module.exports = {
  activeUnconflictedLearningCandidates,
  candidateStatus,
  conflictMetadata,
  conflictSummary,
  conflictedLearningIds,
  findProjectLearningConflicts,
  parseArgs,
  resolvedCandidates,
};
