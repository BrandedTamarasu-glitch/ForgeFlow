#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { assertSafeDirectory, safeReadTextFile } = require('./file-safety');
const { cleanText, normalizeEntry, projectLearningId, recordProjectLearning } = require('./record-project-learning');
const { containsSensitiveContent } = require('./privacy-boundary');
const { candidateStatus, resolvedLearningCandidates } = require('./rollup-project-learnings');

function usage() {
  console.error('Usage: correct-project-learning.js [--project-dir <dir>] --id <project-learning-id> --replacement <text> [--category <category>] [--source <text>] [--evidence <text>] [--confidence low|medium|high] [--conflict-key <key> --conflict-value <value>] [--write] [--json]');
}

function parseArgs(argv, options = {}) {
  const exitOnError = options.exitOnError !== false;
  const opts = { projectDir: '', id: '', replacement: '', category: '', source: '', evidence: '', confidence: '', conflictKey: '', conflictValue: '', write: false, json: false };
  function fail(message) {
    if (exitOnError) { console.error(message); usage(); process.exit(2); }
    throw new Error(message);
  }
  function value(name, index) {
    const next = argv[index + 1] || '';
    if (!next || next.startsWith('--')) fail(`Missing value for ${name}`);
    return next;
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project-dir') { opts.projectDir = path.resolve(value(arg, i)); i += 1; }
    else if (arg === '--id') { opts.id = value(arg, i); i += 1; }
    else if (arg === '--replacement') { opts.replacement = value(arg, i); i += 1; }
    else if (arg === '--category') { opts.category = value(arg, i); i += 1; }
    else if (arg === '--source') { opts.source = value(arg, i); i += 1; }
    else if (arg === '--evidence') { opts.evidence = value(arg, i); i += 1; }
    else if (arg === '--confidence') { opts.confidence = value(arg, i); i += 1; }
    else if (arg === '--conflict-key') { opts.conflictKey = value(arg, i); i += 1; }
    else if (arg === '--conflict-value') { opts.conflictValue = value(arg, i); i += 1; }
    else if (arg === '--write') opts.write = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--help' || arg === '-h') { usage(); if (exitOnError) process.exit(0); return opts; }
    else fail(`Unknown argument: ${arg}`);
  }
  return opts;
}

function git(args, cwd) { const r = spawnSync('git', args, { cwd, encoding: 'utf8' }); return r.status === 0 ? r.stdout.trimEnd() : ''; }
function repoRoot(cwd = process.cwd()) { return git(['rev-parse', '--show-toplevel'], cwd) || cwd; }
function defaultProjectDir(root) { return path.join(root, '.forgeflow', path.basename(root)); }

function readCandidates(projectDir) {
  const file = path.join(projectDir, 'project-learning-candidates.jsonl');
  if (!fs.existsSync(file)) throw new Error('Project learning candidates file is missing');
  assertSafeDirectory(projectDir);
  const { content } = safeReadTextFile(file, projectDir);
  const values = [];
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try { values.push(JSON.parse(line)); } catch (_err) { throw new Error(`Project learning candidate line ${index + 1} is not valid JSON`); }
  }
  return { file, values };
}

function correctProjectLearning(opts = {}) {
  const id = cleanText(opts.id);
  const replacement = cleanText(opts.replacement);
  if (!/^plc_[a-f0-9]{16}$/.test(id)) throw new Error('Project learning id must be an exact stable id');
  if (!replacement) throw new Error('Project learning replacement is required');
  if (containsSensitiveContent(replacement)) throw new Error('Project learning replacement appears to contain sensitive content');
  const projectDir = opts.projectDir || defaultProjectDir(repoRoot());
  const { file, values } = readCandidates(projectDir);
  const target = resolvedLearningCandidates(values).find((entry) => projectLearningId(entry) === id);
  if (!target) throw new Error('Project learning id was not found');
  if (candidateStatus(target) !== 'active') throw new Error('Project learning id is already inactive and cannot be corrected again');
  if (replacement === cleanText(target.learning)) throw new Error('Project learning replacement must differ from the current learning');
  const category = opts.category ? cleanText(opts.category) : target.category;
  const source = opts.source ? cleanText(opts.source) : target.source;
  const evidence = opts.evidence ? cleanText(opts.evidence) : target.evidence;
  const confidence = opts.confidence ? cleanText(opts.confidence) : target.confidence;
  const conflictKey = opts.conflictKey ? cleanText(opts.conflictKey) : target.conflict_key;
  const conflictValue = opts.conflictValue ? cleanText(opts.conflictValue) : target.conflict_value;
  // Retirement must retain the original identity.  Category/source overrides
  // describe the new guidance only, otherwise the retirement would no longer
  // resolve to the target id.
  const replacementEntry = normalizeEntry({ category, learning: replacement, source, evidence, confidence, evidence_count: target.evidence_count, application_guidance: target.application_guidance, conflict_key: conflictKey, conflict_value: conflictValue, status: 'active' });
  const retired = normalizeEntry({ ...target, status: 'superseded', superseded_by: replacementEntry.id });
  const result = { status: opts.write ? 'written' : 'preview', project_dir: projectDir, candidates_file: file, target: { id, category: target.category, learning: target.learning }, retirement: retired, replacement: replacementEntry, writes: opts.write ? 2 : 0 };
  if (opts.write) recordProjectLearning({ projectDir, inputEntries: [retired, replacementEntry] });
  return result;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.id || !opts.replacement) { usage(); process.exit(2); }
  const result = correctProjectLearning(opts);
  if (opts.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else console.log(opts.write ? `Project learning corrected: ${result.target.id}` : `Preview only: project learning ${result.target.id} would be corrected. Re-run with --write to append changes.`);
}
if (require.main === module) { try { main(); } catch (err) { console.error(err.message); process.exit(1); } }
module.exports = { correctProjectLearning, parseArgs, readCandidates };
