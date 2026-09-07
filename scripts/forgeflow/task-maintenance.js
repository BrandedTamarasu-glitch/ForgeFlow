#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('./task-store');
const { runCheck } = require('./task');
const { buildFailureDigest } = require('./build-failure-digest');
const { applyReviewAutofixProposal } = require('./apply-review-autofix-proposal');
const { assertSafeDirectory, safeReadTextFile, writeFileSafe } = require('./file-safety');

const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const MAX_VALIDATION_ATTEMPTS = 3;
const USAGE = 'task-maintenance.js ingest|repair|validate|reconcile|recover-lock|prepare|status --root <repo> [--task <id>] [--input <json>]';
const projectDirectory = (root) => path.dirname(store.taskDirectory(root));
const maintenanceDirectory = (root) => path.join(projectDirectory(root), 'maintenance');

function statePath(root, id) {
  if (!/^ci-[a-f0-9]{24}$/.test(id || '')) throw new Error('Invalid maintenance task id');
  return path.join(maintenanceDirectory(root), `${id}.json`);
}

function withLock(root, id, action) {
  const directory = maintenanceDirectory(root);
  assertSafeDirectory(directory);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = statePath(root, id);
  const lock = `${file}.lock`;
  const descriptor = fs.openSync(lock, 'wx', 0o600);
  try {
    fs.writeFileSync(descriptor, JSON.stringify({ pid: process.pid, created_at: new Date().toISOString() }));
    return action(file);
  } finally { fs.closeSync(descriptor); fs.unlinkSync(lock); }
}

function normalizeEvent(root, event) {
  if (store.assertWorkspace(event.repository_root) !== root) throw new Error('CI event belongs to another repository');
  if (typeof event.run_id !== 'string' || !/^[a-zA-Z0-9._-]{1,100}$/.test(event.run_id)) throw new Error('Invalid CI run id');
  if (!Number.isSafeInteger(event.attempt) || event.attempt < 1) throw new Error('Invalid CI attempt');
  const maxAttempts = event.max_attempts ?? 2;
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5 || event.attempt > maxAttempts) throw new Error('Retry exhaustion or invalid max_attempts (1..5)');
  if (!Array.isArray(event.command) || !event.command.length || event.command.some((arg) => typeof arg !== 'string' || !arg || arg.includes('\0'))) throw new Error('CI command must be an explicit argv array');
  const log = store.captureArtifact(root, event.log_file);
  return { repository_root: root, run_id: event.run_id, attempt: event.attempt, max_attempts: maxAttempts, command: event.command, log };
}

function ingestFailure(root, event) {
  root = store.assertWorkspace(root);
  const normalized = normalizeEvent(root, event);
  const source = store.sourceSnapshot(root);
  const id = `ci-${hash([source.git_dir, normalized.run_id, normalized.attempt]).slice(0, 24)}`;
  return withLock(root, id, (file) => {
    if (fs.existsSync(file)) {
      const state = readState(root, id);
      if (state.event_hash !== hash(normalized)) throw new Error('Duplicate CI event has conflicting input');
      return { ...state, deduplicated: true };
    }
    const task = store.createTask(root, { id, objective: `Repair caller-reported CI failure ${normalized.run_id}, attempt ${normalized.attempt}`, criteria: [{ id: 'ci-check', description: 'The recorded CI command passes against the current source.' }], phases: ['classify', 'repair', 'validate', 'prepare'] });
    const log = safeReadTextFile(path.join(root, normalized.log.path), root).content;
    if (store.inspectArtifact(root, normalized.log) !== 'current') throw new Error('CI log changed during ingestion');
    const digest = buildFailureDigest(log, { root, mode: 'test', command: normalized.command.join(' ') });
    const digestFile = path.join(maintenanceDirectory(root), `${id}-failure.md`);
    writeFileSafe(digestFile, digest.markdown, { mode: 0o600 });
    const state = { schema_version: '1', task_id: id, event: normalized, event_hash: hash(normalized), source: task.workspace, digest: store.captureArtifact(root, path.relative(root, digestFile)), attempts: [], status: 'classified', created_at: new Date().toISOString() };
    store.atomicWrite(file, state);
    return state;
  });
}

function readState(root, id) {
  const state = JSON.parse(safeReadTextFile(statePath(root, id), root).content);
  if (state.schema_version !== '1' || state.task_id !== id || state.event.repository_root !== root || !Array.isArray(state.attempts)) throw new Error('Invalid maintenance state');
  store.readTask(root, id);
  return state;
}

function assertReadyForRepair(root, state) {
  const task = store.readTask(root, state.task_id);
  if (state.attempts.some((attempt) => ['pending', 'unknown'].includes(attempt.status)) || task.actions.some((action) => ['pending', 'unknown'].includes(action.status))) throw new Error('Interrupted repair requires explicit action reconciliation');
  if (state.attempts.length >= state.event.max_attempts) throw new Error('Repair retry limit exhausted');
  if (!store.sameSource(state.source, store.sourceSnapshot(root))) throw new Error('Source changed since classification or the last repair; ingest a new CI attempt');
}

function readRepairProposal(root, proposalFile) {
  const relative = store.relativeFile(proposalFile);
  const reference = store.captureArtifact(root, relative);
  const artifact = JSON.parse(safeReadTextFile(path.join(root, relative), root).content);
  if (store.inspectArtifact(root, reference) !== 'current') throw new Error('Proposal changed during inspection');
  if (artifact.root && path.resolve(artifact.root) !== root) throw new Error('Proposal belongs to another repository');
  if (artifact.status !== 'proposed' || !artifact.finding?.policy?.proposal_allowed || !Array.isArray(artifact.operations) || artifact.operations.length !== 1) throw new Error('Expected one approved deterministic replace proposal');
  const operation = artifact.operations[0];
  if ((operation.op || operation.type) !== 'replace') throw new Error('Only deterministic replace proposals are supported');
  const target = store.relativeFile(operation.file || operation.path || operation.target_file);
  if (target === '.git' || target.startsWith('.git/') || target === '.forgeflow' || target.startsWith('.forgeflow/')) throw new Error('Repair must target project source');
  if (artifact.validations_requested?.length) throw new Error('Embedded validations are not supported; the explicit CI command is the validation authority');
  return { artifact, reference };
}

function saveUnknownRepair(root, file, state, attempt, error) {
  attempt.status = 'unknown';
  attempt.error = error.message;
  state.status = 'needs-reconciliation';
  store.atomicWrite(file, state);
  store.recordAction(root, state.task_id, { event_id: `${attempt.id}-unknown`, action_id: attempt.id, status: 'unknown', description: `Local repair interrupted: ${error.message}` });
}

function applyRepair(root, state, attempt, proposal) {
  const snapshotFile = path.join(maintenanceDirectory(root), `${attempt.id}-proposal.json`);
  store.atomicWrite(snapshotFile, proposal.artifact);
  if (!store.sameSource(state.source, store.sourceSnapshot(root))) throw new Error('Source changed before applying repair');
  const result = applyReviewAutofixProposal({ root, projectDir: projectDirectory(root), proposal: snapshotFile, allowDirty: true });
  if (result.status !== 'applied') throw new Error(`Repair was not applied: ${result.status}`);
  attempt.changed_files = result.changed_files;
  attempt.apply_artifact = store.captureArtifact(root, path.relative(root, result.artifacts.json));
  store.recordAction(root, state.task_id, { event_id: `${attempt.id}-confirmed`, action_id: attempt.id, status: 'confirmed', description: 'Local deterministic repair applied', evidence: attempt.apply_artifact.path });
  return result;
}

function validateRepair(root, state, attempt) {
  const checkId = attempt.validation_events.at(-1);
  const view = runCheck(root, state.task_id, { event_id: checkId, criterion_ids: ['ci-check'], command: state.event.command });
  const proof = view.evidence.find((entry) => entry.id === checkId);
  attempt.status = proof.status === 'passed' && proof.freshness === 'current' ? 'passed' : 'failed';
  attempt.evidence_id = proof.id;
  state.status = attempt.status === 'passed' ? 'validated' : 'validation-failed';
  state.source = store.sourceSnapshot(root);
  return view;
}

function repairFailure(root, id, options) {
  root = store.assertWorkspace(root);
  return withLock(root, id, (file) => {
    const state = readState(root, id);
    assertReadyForRepair(root, state);
    const proposal = readRepairProposal(root, options.proposal_file);
    if (state.attempts.some((attempt) => attempt.proposal.sha256 === proposal.reference.sha256)) throw new Error('Proposal was already attempted; provide a new explicit proposal');
    const attempt = { id: `${id}-repair-${state.attempts.length + 1}`, status: 'pending', proposal: proposal.reference, started_at: new Date().toISOString() };
    attempt.validation_events = [`${attempt.id}-check`];
    state.attempts.push(attempt);
    state.status = 'repairing';
    store.atomicWrite(file, state);
    store.recordAction(root, id, { event_id: `${attempt.id}-pending`, action_id: attempt.id, status: 'pending', description: 'Explicit local deterministic repair' });
    try {
      applyRepair(root, state, attempt, proposal);
      validateRepair(root, state, attempt);
    } catch (error) {
      // A confirmed apply can still have an interrupted check. Preserve the record
      // without changing a reconciled action back to unknown.
      const action = store.readTask(root, id).actions.find((entry) => entry.id === attempt.id);
      if (action.status !== 'confirmed') saveUnknownRepair(root, file, state, attempt, error);
      else { attempt.status = 'unknown'; attempt.error = error.message; state.status = 'needs-reconciliation'; store.atomicWrite(file, state); }
      throw error;
    }
    store.atomicWrite(file, state);
    store.checkpointTask(root, id, { event_id: `${attempt.id}-checkpoint`, phase: 'validate', state: 'active', note: `Repair validation ${attempt.status}` });
    return state;
  });
}

function reconcileRepair(root, id, input) {
  root = store.assertWorkspace(root);
  return withLock(root, id, (file) => {
    const state = readState(root, id);
    const attempt = state.attempts.at(-1);
    if (!attempt || !['pending', 'unknown'].includes(attempt.status)) throw new Error('No interrupted repair to reconcile');
    if (!['confirmed', 'not-performed'].includes(input.status) || typeof input.evidence !== 'string' || !input.evidence.trim()) throw new Error('Explicit reconciliation status and evidence required');
    const action = store.readTask(root, id).actions.find((entry) => entry.id === attempt.id);
    if (!action || action.status !== 'confirmed') store.recordAction(root, id, { event_id: `${attempt.id}-reconciled`, action_id: attempt.id, status: input.status, description: 'Operator reconciled interrupted local repair', evidence: input.evidence });
    if (action?.status === 'confirmed' && input.status !== 'confirmed') throw new Error('Already confirmed repair cannot be marked not performed');
    const checkAction = store.readTask(root, id).actions.find((entry) => entry.id === `check-${attempt.validation_events.at(-1)}`);
    if (checkAction && ['pending', 'unknown'].includes(checkAction.status)) {
      if (!['confirmed', 'not-performed'].includes(input.check_status) || !input.check_evidence) throw new Error('Interrupted validation requires explicit check_status and check_evidence');
      store.recordAction(root, id, { event_id: `${attempt.validation_events.at(-1)}-reconciled`, action_id: checkAction.id, status: input.check_status, description: 'Operator reconciled interrupted validation', evidence: input.check_evidence });
    }
    attempt.status = 'reconciled';
    attempt.reconciliation = { status: input.status, evidence: input.evidence };
    state.source = store.sourceSnapshot(root);
    state.status = 'reconciled';
    store.atomicWrite(file, state);
    return state;
  });
}

function revalidateFailure(root, id) {
  root = store.assertWorkspace(root);
  return withLock(root, id, (file) => {
    const state = readState(root, id);
    const attempt = state.attempts.at(-1);
    if (!attempt || state.status !== 'reconciled' || attempt.reconciliation.status !== 'confirmed') throw new Error('Revalidation requires a reconciled, confirmed repair');
    if (!store.sameSource(state.source, store.sourceSnapshot(root))) throw new Error('Source changed after reconciliation');
    const task = store.readTask(root, id);
    if (task.actions.some((action) => ['pending', 'unknown'].includes(action.status))) throw new Error('Resolve pending actions before revalidation');
    const checkId = attempt.validation_events.at(-1);
    const proof = store.taskView(root, task).evidence.find((entry) => entry.id === checkId);
    const hasUnrecordedCheck = task.actions.some((action) => action.id === `check-${checkId}`) && !proof;
    if (proof?.freshness !== 'current' && (proof || hasUnrecordedCheck)) {
      if (attempt.validation_events.length >= MAX_VALIDATION_ATTEMPTS) throw new Error('Validation retry limit exhausted');
      attempt.validation_events.push(`${attempt.id}-check-${attempt.validation_events.length + 1}`);
    }
    attempt.status = 'pending';
    state.status = 'validating';
    store.atomicWrite(file, state);
    try { validateRepair(root, state, attempt); }
    catch (error) {
      attempt.status = 'unknown'; attempt.error = error.message; state.status = 'needs-reconciliation';
      store.atomicWrite(file, state);
      throw error;
    }
    store.atomicWrite(file, state);
    return state;
  });
}

function recoverMaintenanceLock(root, id) {
  root = store.assertWorkspace(root);
  const lock = `${statePath(root, id)}.lock`;
  assertSafeDirectory(path.dirname(lock));
  const read = safeReadTextFile(lock, root);
  const owner = JSON.parse(read.content);
  if (!Number.isSafeInteger(owner.pid) || owner.pid < 1) throw new Error('Invalid maintenance lock owner');
  try { process.kill(owner.pid, 0); throw new Error('Maintenance lock owner is still running'); }
  catch (error) { if (error.code !== 'ESRCH') throw error; }
  const current = fs.lstatSync(lock);
  if (current.ino !== read.stat.ino || current.mtimeMs !== read.stat.mtimeMs) throw new Error('Maintenance lock changed during recovery');
  fs.unlinkSync(lock);
  return { task_id: id, status: 'lock-recovered', next_action: 'Inspect pending actions and explicitly reconcile before retrying a repair.' };
}

function prepareDraft(root, id) {
  root = store.assertWorkspace(root);
  return withLock(root, id, (file) => {
    const state = readState(root, id);
    const view = store.taskView(root, store.readTask(root, id));
    if (state.status !== 'validated' && state.status !== 'prepared') throw new Error('A completed passing repair is required before preparing a draft');
    if (!view.ready || !store.sameSource(state.source, store.sourceSnapshot(root))) throw new Error('Current passing validation is required; source or evidence is stale');
    const proof = view.evidence.at(-1);
    if (proof?.kind !== 'test' || proof.status !== 'passed' || proof.freshness !== 'current') throw new Error('Current behavioral test evidence is required');
    const changedFiles = [...new Set(state.attempts.flatMap((attempt) => attempt.changed_files || []))];
    const body = `Repair CI run ${state.event.run_id}, attempt ${state.event.attempt}.\n\nChanged files: ${changedFiles.join(', ')}.\n\nValidation passed: ${state.event.command.join(' ')}\nEvidence: ${proof.artifact.path}\nSource: ${proof.source.head} / ${proof.source.fingerprint}\n\nThis is a local draft. No pull request has been created.\n`;
    const draft = { schema_version: '1', task_id: id, title: `Fix CI failure ${state.event.run_id}`, body, draft: true, remote_written: false, source: proof.source, evidence: proof.artifact, changed_files: changedFiles };
    const draftFile = path.join(maintenanceDirectory(root), `${id}-draft.json`);
    store.atomicWrite(draftFile, draft);
    writeFileSafe(path.join(maintenanceDirectory(root), `${id}-draft.md`), body, { mode: 0o600 });
    state.status = 'prepared';
    state.draft = store.captureArtifact(root, path.relative(root, draftFile));
    store.atomicWrite(file, state);
    store.checkpointTask(root, id, { event_id: `${id}-prepared`, phase: 'prepare', state: 'complete', note: 'Local draft prepared from current passing behavioral evidence.' });
    return draft;
  });
}

function main(argv) {
  const command = argv[0];
  if (!command || command === '--help' || command === '-h') return { usage: USAGE, boundary: 'Explicit local repair only; no remote writes. At most 3 validation attempts per repair; current saved proof is reused during recovery.' };
  const options = {};
  for (let index = 1; index < argv.length; index += 2) {
    if (!['--root', '--task', '--input'].includes(argv[index]) || !argv[index + 1]) throw new Error(`Usage: ${USAGE}`);
    options[argv[index].slice(2)] = argv[index + 1];
  }
  const root = store.assertWorkspace(options.root || process.cwd());
  const input = options.input ? JSON.parse(safeReadTextFile(path.resolve(options.input)).content) : {};
  if (command === 'ingest') return ingestFailure(root, input);
  if (command === 'repair') return repairFailure(root, options.task, input);
  if (command === 'validate') return revalidateFailure(root, options.task);
  if (command === 'reconcile') return reconcileRepair(root, options.task, input);
  if (command === 'recover-lock') return recoverMaintenanceLock(root, options.task);
  if (command === 'prepare') return prepareDraft(root, options.task);
  if (command === 'status') return { ...readState(root, options.task), task: store.taskView(root, store.readTask(root, options.task)) };
  throw new Error('Unknown maintenance action');
}

if (require.main === module) {
  try { const result = main(process.argv.slice(2)); console.log(JSON.stringify(result, null, 2)); if (result.status === 'validation-failed') process.exitCode = 1; }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { ingestFailure, repairFailure, revalidateFailure, reconcileRepair, recoverMaintenanceLock, prepareDraft, readState, main };
