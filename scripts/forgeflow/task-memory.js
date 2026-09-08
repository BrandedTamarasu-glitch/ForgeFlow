#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { appendFileSafe, safeReadTextFile } = require('./file-safety');

const FEEDBACK_OUTCOMES = Object.freeze(['used', 'ignored', 'contradicted', 'corrected']);

function captureProvenance(root, options = {}) {
  const { sourceSnapshot, captureArtifact } = require('./task-store');
  const dependencies = options.dependencies || [];
  const evidence = options.evidence || [];
  if (!Array.isArray(dependencies) || !Array.isArray(evidence) || (!dependencies.length && !evidence.length)) throw new Error('Provenance requires dependencies or evidence paths');
  if (dependencies.length > 500 || evidence.length > 500) throw new Error('Provenance supports at most 500 dependencies and evidence references');
  for (const dependency of dependencies) {
    if (!sourceSnapshot(root, [dependency]).files_count) throw new Error(`Dependency does not identify tracked or untracked source: ${dependency}`);
    if (fs.lstatSync(path.join(root, dependency)).isSymbolicLink()) throw new Error('Memory dependencies cannot be symbolic links');
  }
  return { schema_version: '1', dependencies: dependencies.length ? sourceSnapshot(root, dependencies) : null, evidence: evidence.map((file) => captureArtifact(root, file)) };
}

function inspectProvenance(root, provenance) {
  if (!provenance) return 'unknown';
  if (!root) return 'unverified';
  const { sourceSnapshot, inspectArtifact } = require('./task-store');
  try {
    if (provenance.schema_version !== '1' || !Array.isArray(provenance.evidence)) return 'invalid';
    if (!provenance.dependencies && !provenance.evidence.length) return 'invalid';
    if (provenance.dependencies) {
      const snapshot = provenance.dependencies;
      if (!Array.isArray(snapshot.scope) || !snapshot.scope.length) return 'invalid';
      const current = sourceSnapshot(root, snapshot.scope);
      if (current.worktree_root !== snapshot.worktree_root || current.git_dir !== snapshot.git_dir || current.fingerprint !== snapshot.fingerprint) return 'stale';
    }
    if (provenance.evidence.some((artifact) => inspectArtifact(root, artifact) !== 'current')) return 'stale';
    return 'current';
  } catch (error) {
    // Invalid or unreadable dependencies must never promote guidance to current.
    return 'unverified';
  }
}

function readRecords(projectDir, name) {
  const file = path.join(projectDir, name);
  if (!fs.existsSync(file)) return [];
  return safeReadTextFile(file, projectDir).content.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function currentCandidates(projectDir) {
  const { resolvedCandidates } = require('./project-learning-conflicts');
  const { projectLearningId } = require('./record-project-learning');
  const file = path.join(projectDir, 'project-learning-candidates.jsonl');
  if (!fs.existsSync(file)) return new Map();
  const candidates = safeReadTextFile(file, projectDir).content.split(/\r?\n/).filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; }
    catch (error) { return []; } // Invalid candidates remain excluded by existing lifecycle controls.
  });
  return new Map(resolvedCandidates(candidates).map((entry) => [projectLearningId(entry), entry]));
}

function contradictedLearningIds(projectDir) {
  return new Set(readRecords(projectDir, 'task-memory-feedback.jsonl')
    .filter((entry) => entry.outcome === 'contradicted' || entry.outcome === 'corrected')
    .map((entry) => entry.learning_id));
}

function applyTaskMemoryControls(records, options = {}) {
  const projectDir = options.projectDir;
  const root = options.root || (projectDir && path.basename(path.dirname(projectDir)) === '.forgeflow' ? path.dirname(path.dirname(projectDir)) : null);
  const candidates = projectDir ? currentCandidates(projectDir) : new Map();
  const contradicted = projectDir ? contradictedLearningIds(projectDir) : new Set();
  return (Array.isArray(records) ? records : []).map((record) => {
    if (!record || typeof record !== 'object') return record;
    const candidate = candidates.get(record.learning_id);
    const provenance = candidate ? candidate.provenance : record.provenance;
    const provenanceStatus = inspectProvenance(root, provenance);
    return { ...record, provenance: provenance || null, provenance_status: provenanceStatus, provenance_withheld: !['current', 'unknown'].includes(provenanceStatus), feedback_withheld: projectDir ? contradicted.has(record.learning_id) : record.feedback_withheld === true };
  });
}

function recordTaskMemoryFeedback(options) {
  const { root, projectDir, taskId, learningId, outcome, correctionId } = options;
  if (!FEEDBACK_OUTCOMES.includes(outcome)) throw new Error('Invalid memory feedback outcome');
  const { assertWorkspace, readTask, taskDirectory } = require('./task-store');
  const workspaceRoot = assertWorkspace(root);
  if (path.resolve(projectDir) !== path.dirname(taskDirectory(workspaceRoot))) throw new Error('Feedback project directory must belong to the task workspace');
  readTask(workspaceRoot, taskId);
  const candidates = currentCandidates(projectDir);
  const candidate = candidates.get(learningId);
  if (!candidate) throw new Error('Learning id was not found');
  if (outcome === 'corrected' && (!correctionId || correctionId === learningId || !candidates.has(correctionId))) throw new Error('Corrected feedback requires an existing distinct replacement learning id');
  const record = { schema_version: '1', ts: new Date().toISOString(), task_id: taskId, learning_id: learningId, outcome, correction_id: correctionId || null, causal_usefulness: null };
  appendFileSafe(path.join(projectDir, 'task-memory-feedback.jsonl'), `${JSON.stringify(record)}\n`);
  if (outcome === 'contradicted' || outcome === 'corrected') {
    const vault = require('./vault-memory').publishLearning(root, { ...candidate, id: learningId, status: 'stale', provenance: null });
    if (vault.status !== 'disabled') record.vault = vault;
  }
  return record;
}

function main(argv) {
  const [command, flag, input, ...extra] = argv;
  if (command !== 'feedback' || flag !== '--input' || !input || extra.length) throw new Error('Usage: task-memory.js feedback --input <json-file>');
  const options = JSON.parse(safeReadTextFile(path.resolve(input)).content);
  return recordTaskMemoryFeedback(options);
}

if (require.main === module) {
  try { process.stdout.write(`${JSON.stringify(main(process.argv.slice(2)), null, 2)}\n`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { FEEDBACK_OUTCOMES, captureProvenance, inspectProvenance, applyTaskMemoryControls, recordTaskMemoryFeedback };
