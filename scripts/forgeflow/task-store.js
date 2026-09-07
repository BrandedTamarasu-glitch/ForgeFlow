'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { assertSafeDirectory, assertSafeDestination, safeReadTextFile, isPathInside } = require('./file-safety');

const LIMIT = 16 * 1024 * 1024;
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();
function identifier(value, label = 'id') {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(value)) throw new Error(`Invalid ${label}`);
  return value;
}
function text(value, label, max = 2000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error(`Invalid ${label}`);
  return value.trim();
}
function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: LIMIT, timeout: 15000 });
  if (result.status !== 0 || result.error) throw new Error(`Cannot inspect repository: ${result.error?.message || result.stderr.trim()}`);
  return result.stdout;
}
function assertWorkspace(root) {
  const resolved = fs.realpathSync(path.resolve(root));
  const actual = fs.realpathSync(git(resolved, ['rev-parse', '--show-toplevel']).trim());
  if (actual !== resolved) throw new Error('Task root must be the repository worktree root');
  return resolved;
}
function relativeFile(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes('\0') || path.isAbsolute(value) || value.split('/').some(x => !x || x === '..' || x === '.')) throw new Error('Expected a project-relative path without traversal');
  return value;
}
function sourceSnapshot(root, scope = []) {
  root = assertWorkspace(root);
  if (!Array.isArray(scope) || scope.length > 500) throw new Error('Invalid source scope');
  scope = [...new Set(scope.map(relativeFile))].sort();
  // Detached checkouts are valid too.
  const readIdentity = () => {
    const head = git(root, ['rev-parse', '--verify', 'HEAD']).trim();
    const branch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    return { head, branch };
  };
  const before = readIdentity();
  const names = () => [...new Set(git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean))]
    .filter(file => !file.startsWith('.forgeflow/') && file !== '.forgeflow' && !file.startsWith('.git/')
      && (!scope.length || scope.some(item => file === item || file.startsWith(`${item}/`)))).sort();
  const files = names();
  const collect = () => files.map(file => {
    relativeFile(file);
    const absolute = path.join(root, file);
    assertSafeDirectory(path.dirname(absolute));
    let stat;
    try { stat = fs.lstatSync(absolute); } catch (error) { if (error.code === 'ENOENT') return [file, 'deleted']; throw error; }
    if (stat.isSymbolicLink()) return [file, 'link', digest(fs.readlinkSync(absolute))];
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > LIMIT) throw new Error(`Cannot fingerprint nonregular, hardlinked or oversized source: ${file}`);
    const bytes = fs.readFileSync(absolute);
    const after = fs.lstatSync(absolute);
    if (stat.ino !== after.ino || stat.mtimeMs !== after.mtimeMs || stat.ctimeMs !== after.ctimeMs || stat.size !== bytes.length) throw new Error('Source changed during fingerprint capture');
    return [file, stat.mode & 0o111, digest(bytes)];
  });
  const hashes = collect();
  const after = readIdentity();
  if (JSON.stringify(before) !== JSON.stringify(after) || JSON.stringify(files) !== JSON.stringify(names()) || JSON.stringify(hashes) !== JSON.stringify(collect())) throw new Error('Repository changed during fingerprint capture');
  return { worktree_root: root, git_dir: fs.realpathSync(git(root, ['rev-parse', '--absolute-git-dir']).trim()), ...before,
    fingerprint: digest(JSON.stringify(hashes)), scope, files_count: files.length };
}
function captureArtifact(root, file) {
  root = assertWorkspace(root); file = relativeFile(file);
  const absolute = path.join(root, file);
  assertSafeDirectory(path.dirname(absolute));
  const stat = fs.lstatSync(absolute);
  if (stat.size > LIMIT) throw new Error('Evidence artifact is too large');
  safeReadTextFile(absolute, root);
  const bytes = fs.readFileSync(absolute);
  const after = fs.lstatSync(absolute);
  if (after.ino !== stat.ino || after.mtimeMs !== stat.mtimeMs || after.ctimeMs !== stat.ctimeMs || after.size !== bytes.length) throw new Error('Artifact changed during capture');
  return { path: file, sha256: digest(bytes) };
}
function inspectArtifact(root, record) {
  if (!record || typeof record.sha256 !== 'string' || typeof record.path !== 'string') return 'missing';
  try { return captureArtifact(root, record.path).sha256 === record.sha256 ? 'current' : 'stale'; }
  catch (error) { if (error.code === 'ENOENT') return 'missing'; return 'stale'; }
}
function taskDirectory(root) { return path.join(root, '.forgeflow', path.basename(root), 'tasks'); }
function taskPath(root, id) { return path.join(taskDirectory(root), `${identifier(id, 'task id')}.json`); }
function readTask(root, id) {
  root = assertWorkspace(root);
  const file = taskPath(root, id);
  assertSafeDirectory(path.dirname(file));
  if (fs.lstatSync(file).size > LIMIT) throw new Error('Task record is too large');
  const task = JSON.parse(safeReadTextFile(file, root).content);
  if (task.schema_version !== '1' || task.id !== id || task.workspace?.worktree_root !== root || !Array.isArray(task.criteria) || !Array.isArray(task.evidence) || !Array.isArray(task.history) || !Array.isArray(task.events) || !Array.isArray(task.actions)) throw new Error('Invalid task record or workspace identity');
  if (task.workspace.git_dir !== fs.realpathSync(git(root, ['rev-parse', '--absolute-git-dir']).trim())) throw new Error('Task belongs to another worktree');
  return task;
}
function atomicWrite(file, value, maxBytes = Infinity) {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (Buffer.byteLength(serialized, 'utf8') > maxBytes) throw new Error('Task record limit reached; start a follow-up task');
  assertSafeDirectory(path.dirname(file)); assertSafeDestination(file);
  const temporary = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const fd = fs.openSync(temporary, 'wx', 0o600);
  try { fs.writeFileSync(fd, serialized); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  try { assertSafeDestination(file); fs.renameSync(temporary, file); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
function recoverTaskLock(root, id) {
  root = assertWorkspace(root);
  const lock = `${taskPath(root, id)}.lock`;
  assertSafeDirectory(path.dirname(lock));
  if (!fs.existsSync(lock)) return { recovered: false };
  const read = safeReadTextFile(lock, root);
  const record = JSON.parse(read.content);
  if (!Number.isInteger(record.pid) || record.pid <= 0) throw new Error('Invalid lock owner; inspect manually');
  try { process.kill(record.pid, 0); throw new Error('Task writer is still running; lock preserved'); }
  catch (error) { if (error.code !== 'ESRCH') throw error; }
  const current = fs.lstatSync(lock);
  if (current.ino !== read.stat.ino || current.mtimeMs !== read.stat.mtimeMs) throw new Error('Task lock changed during recovery');
  // Never infer whether the interrupted command ran from an abandoned storage lock.
  fs.unlinkSync(lock);
  return { recovered: true, next_action: 'Inspect task status and reconcile pending actions before resuming.' };
}
function mutate(root, id, event, input, change, create = false, exclusive = false) {
  root = assertWorkspace(root); identifier(event, 'event id');
  const directory = taskDirectory(root), file = taskPath(root, id);
  assertSafeDirectory(directory); fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const lock = `${file}.lock`;
  let fd;
  try { fd = fs.openSync(lock, 'wx', 0o600); }
  catch (error) { if (error.code === 'EEXIST') throw new Error('Task is locked; inspect the interrupted writer before recovering its lock'); throw error; }
  try {
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, created_at: now() }));
    const task = fs.existsSync(file) ? readTask(root, id) : null;
    if (!task && !create) throw new Error('Task does not exist');
    const requestHash = digest(JSON.stringify(input));
    const prior = task?.events.find(entry => entry.id === event);
    if (prior) {
      if (prior.hash !== requestHash) throw new Error('Event id already records different input');
      if (exclusive) throw new Error('Action attempt already claimed; reconcile before retrying');
      return task;
    }
    if (create && task) throw new Error('Task already exists');
    if (task?.events.length >= 2000) throw new Error('Task event limit reached; start a follow-up task');
    const result = change(task, root);
    result.updated_at = now(); result.events.push({ id: event, hash: requestHash });
    atomicWrite(file, result, LIMIT);
    return result;
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
function createTask(root, input) {
  const id = identifier(input.id, 'task id');
  return mutate(root, id, input.event_id || `start-${id}`, input, (_, workspaceRoot) => {
    if (!Array.isArray(input.criteria) || !input.criteria.length || input.criteria.length > 100) throw new Error('One to 100 acceptance criteria required');
    const criteria = input.criteria.map(item => ({ id: identifier(item.id, 'criterion id'), description: text(item.description, 'criterion') }));
    if (new Set(criteria.map(item => item.id)).size !== criteria.length) throw new Error('Duplicate criterion id');
    const phases = (input.phases || ['implement', 'validate', 'review']).map(item => identifier(item, 'phase'));
    if (!phases.length || phases.length > 30 || new Set(phases).size !== phases.length) throw new Error('Invalid phases');
    const workspace = sourceSnapshot(workspaceRoot, input.scope || []);
    return { schema_version: '1', id, objective: text(input.objective, 'objective'), workspace, criteria, phases,
      phase: phases[0], state: 'active', created_at: now(), updated_at: now(), evidence: [], history: [], actions: [], sessions: [], events: [] };
  }, true);
}
function sameSource(a, b) { return a && b && a.worktree_root === b.worktree_root && a.git_dir === b.git_dir && a.head === b.head && a.fingerprint === b.fingerprint; }
function recordEvidence(root, id, input) {
  return mutate(root, id, input.event_id, input, (task, workspaceRoot) => {
    if (!['test', 'manual', 'review'].includes(input.kind) || !['passed', 'failed', 'waived'].includes(input.status)) throw new Error('Invalid evidence kind/status');
    if (!Array.isArray(input.criterion_ids) || !input.criterion_ids.length || input.criterion_ids.some(item => !task.criteria.some(c => c.id === item))) throw new Error('Unknown or missing criterion ids');
    if (input.status === 'waived' && input.kind !== 'manual') throw new Error('Only explicit manual evidence can waive a criterion');
    if (input.kind === 'test' && (!Array.isArray(input.command) || !input.command.length || input.command.some(x => typeof x !== 'string') || !Number.isInteger(input.exit_code))) throw new Error('Test evidence requires command argv and exit code');
    if (input.kind === 'test' && ((input.status === 'passed') !== (input.exit_code === 0))) throw new Error('Test result conflicts with exit code');
    const reason = text(input.reason, 'evidence reason');
    const artifact = input.artifact ? captureArtifact(workspaceRoot, input.artifact) : null;
    if (!artifact && input.status !== 'waived') throw new Error('Saved artifact required');
    const source = sourceSnapshot(workspaceRoot, task.workspace.scope);
    // A runner supplies the observed before-state; a changed checkout must not acquire fresh proof.
    if (input.observed_source && !sameSource(input.observed_source, source)) throw new Error('Source changed during validation; rerun the check');
    task.evidence.push({ id: input.event_id, kind: input.kind, status: input.status, criterion_ids: [...new Set(input.criterion_ids)],
      reason, artifact, source, command: input.command || null, exit_code: input.exit_code ?? null, recorded_at: now() });
    return task;
  });
}
function verificationContext(root) {
  // One coherent observation per scope/artifact within this inspection only.
  // Never retain these results between requests: source and artifacts can change.
  const sources = new Map(), artifacts = new Map();
  return {
    source(scope) {
      const key = JSON.stringify(scope);
      if (!sources.has(key)) sources.set(key, sourceSnapshot(root, scope));
      return sources.get(key);
    },
    artifact(record) {
      const key = JSON.stringify(record);
      if (!artifacts.has(key)) artifacts.set(key, inspectArtifact(root, record));
      return artifacts.get(key);
    }
  };
}
function taskView(root, task) { return inspectTask(task, verificationContext(root)); }
function inspectTask(task, verification) {
  const source = verification.source(task.workspace.scope);
  const evidence = task.evidence.map(item => {
    let freshness = sameSource(item.source, source) ? 'current' : 'stale';
    if (item.artifact) {
      const status = verification.artifact(item.artifact);
      if (status !== 'current') freshness = status;
    } else if (item.status !== 'waived') freshness = 'missing';
    return { ...item, freshness };
  });
  const criteria = task.criteria.map(item => {
    const proof = evidence.filter(entry => entry.criterion_ids.includes(item.id)).at(-1);
    const status = !proof ? 'missing' : proof.freshness !== 'current' ? proof.freshness : ({ passed: 'verified', failed: 'failed', waived: 'waived' }[proof.status] || 'missing');
    return { ...item, status, evidence_id: proof?.id || null };
  });
  const counts = { verified: 0, failed: 0, stale: 0, missing: 0, waived: 0, total: criteria.length };
  for (const item of criteria) counts[item.status]++;
  const unresolved = task.actions.filter(action => action.status === 'unknown' || action.status === 'pending');
  const ready = counts.verified + counts.waived === counts.total && !unresolved.length;
  let status = task.state === 'interrupted' ? 'interrupted' : task.state === 'complete' && ready ? 'complete' : 'active';
  if (unresolved.length || counts.stale || counts.failed || (task.state === 'complete' && !ready)) status = 'needs-attention';
  const next = unresolved.length ? `Reconcile action ${unresolved[0].id} before continuing.`
    : counts.stale ? 'Rerun checks whose evidence is stale for the current source or artifact.'
      : counts.failed ? 'Resolve the failed acceptance checks and record fresh evidence.'
        : counts.missing ? 'Validate the remaining acceptance criteria and save their evidence.'
          : status === 'complete' ? 'All criteria are accounted for; inspect the evidence before shipping.'
            : 'Continue from the saved phase and complete the task when ready.';
  return { ...task, status, ready, criteria, evidence, counts, next_action: next,
    history: task.history.map(entry => ({ ...entry, freshness: sameSource(entry.source, source) ? 'current' : 'stale' })) };
}
function checkpointTask(root, id, input) {
  return mutate(root, id, input.event_id, input, (task, workspaceRoot) => {
    if (!task.phases.includes(input.phase)) throw new Error('Unknown task phase');
    if (!['active', 'interrupted', 'complete'].includes(input.state)) throw new Error('Invalid checkpoint state');
    if (input.state === 'complete' && !taskView(workspaceRoot, task).ready) throw new Error('Cannot complete: criteria or external actions need attention');
    if (input.session) {
      if (!['claude', 'codex'].includes(input.session.host)) throw new Error('Unknown host');
      const session = { host: input.session.host, id: text(input.session.id, 'session id', 200) };
      if (!task.sessions.some(item => item.host === session.host && item.id === session.id)) task.sessions.push(session);
    }
    task.phase = input.phase; task.state = input.state;
    task.history.push({ id: input.event_id, phase: input.phase, state: input.state, note: text(input.note, 'checkpoint note'), source: sourceSnapshot(workspaceRoot, task.workspace.scope), at: now() });
    return task;
  });
}
function recordAction(root, id, input) {
  return mutate(root, id, input.event_id, input, task => {
    identifier(input.action_id, 'action id');
    if (!['pending', 'unknown', 'confirmed', 'not-performed'].includes(input.status)) throw new Error('Invalid action status');
    const existing = task.actions.find(item => item.id === input.action_id);
    if (existing && ['confirmed', 'not-performed'].includes(existing.status)) throw new Error('Action is already reconciled');
    const action = { id: input.action_id, status: input.status, description: text(input.description, 'action description'), at: now() };
    if (['confirmed', 'not-performed'].includes(input.status)) action.evidence = text(input.evidence, 'reconciliation evidence');
    if (existing) Object.assign(existing, action); else task.actions.push(action);
    return task;
  }, false, input.exclusive === true);
}
function resumeTask(root, id, input) {
  return mutate(root, id, input.event_id, input, (task, workspaceRoot) => {
    const view = taskView(workspaceRoot, task);
    if (task.actions.some(item => ['pending', 'unknown'].includes(item.status))) throw new Error(view.next_action);
    if (input.session) {
      if (!['claude', 'codex'].includes(input.session.host)) throw new Error('Unknown host');
      const session = { host: input.session.host, id: text(input.session.id, 'session id', 200) };
      if (!task.sessions.some(item => item.host === session.host && item.id === session.id)) task.sessions.push(session);
    }
    task.state = view.status === 'complete' ? 'complete' : 'active';
    task.history.push({ id: input.event_id, phase: task.phase, state: task.state, note: `Resume reconciled. ${view.next_action}`, source: sourceSnapshot(workspaceRoot, task.workspace.scope), at: now() });
    return task;
  });
}
function listTasks(root) {
  root = assertWorkspace(root);
  const directory = taskDirectory(root), result = { schema_version: '1', project_root: root, tasks: [], warnings: [] };
  assertSafeDirectory(directory);
  if (!fs.existsSync(directory)) return result;
  const files = fs.readdirSync(directory).filter(file => file.endsWith('.json'));
  if (files.length > 500) throw new Error('Task list exceeds 500 records');
  const verification = verificationContext(root);
  for (const file of files) {
    try { result.tasks.push(inspectTask(readTask(root, file.slice(0, -5)), verification)); }
    catch { result.warnings.push(`Could not inspect task ${file}`); }
  }
  result.tasks.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return result;
}
module.exports = { assertWorkspace, sourceSnapshot, captureArtifact, inspectArtifact, createTask, readTask, recordEvidence,
  taskView, checkpointTask, resumeTask, recordAction, listTasks, atomicWrite, relativeFile, taskDirectory, sameSource, recoverTaskLock };
