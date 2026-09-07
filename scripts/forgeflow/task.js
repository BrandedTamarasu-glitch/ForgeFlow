#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const store = require('./task-store');
const { safeReadTextFile, writeFileSafe } = require('./file-safety');

function runCheck(root, id, input) {
  const task = store.readTask(root, id);
  const existing = task.evidence.find(entry => entry.id === input.event_id);
  if (existing) {
    if (JSON.stringify(existing.command) !== JSON.stringify(input.command) || JSON.stringify(existing.criterion_ids) !== JSON.stringify(input.criterion_ids)) throw new Error('Check event already records different input');
    return store.taskView(root, task);
  }
  if (!Array.isArray(input.command) || !input.command.length || !input.command[0] || input.command.some(arg => typeof arg !== 'string' || arg.includes('\0'))) throw new Error('Check requires command argv');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(input.event_id || '')) throw new Error('Invalid event id');
  if (!Array.isArray(input.criterion_ids) || !input.criterion_ids.length || input.criterion_ids.some(id => !task.criteria.some(item => item.id === id))) throw new Error('Unknown or missing criterion ids');
  const source = store.sourceSnapshot(root, task.workspace.scope);
  const timeout = input.timeout_ms ?? 60000;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 180000) throw new Error('Check timeout must be 1..180000 ms');
  const actionId = `check-${input.event_id}`;
  if (task.actions.some(action => action.id === actionId)) throw new Error('Check attempt already started; reconcile its action and use a new event id');
  store.recordAction(root, id, { event_id: `${input.event_id}-begin`, action_id: actionId, status: 'pending', exclusive: true, description: 'Validation command may have run; reconcile before retrying.' });
  const result = spawnSync(input.command[0], input.command.slice(1), { cwd: root, encoding: 'utf8', shell: false, timeout, maxBuffer: 2 * 1024 * 1024 });
  const artifact = `.forgeflow/${path.basename(root)}/task-evidence/${id}/${input.event_id}.txt`;
  writeFileSafe(path.join(root, artifact), `${result.stdout || ''}${result.stderr || ''}${result.error?.message || ''}\n`, { mode: 0o600 });
  const exit = result.status ?? 1;
  const recorded = store.recordEvidence(root, id, { event_id: input.event_id, kind: 'test', status: exit === 0 && !result.error ? 'passed' : 'failed',
    criterion_ids: input.criterion_ids, command: input.command, exit_code: exit, reason: result.error?.message || `Command exited ${exit}`, artifact, observed_source: source });
  const reconciled = store.recordAction(root, id, { event_id: `${input.event_id}-end`, action_id: actionId, status: 'confirmed', description: 'Validation command finished.', evidence: `Saved ${recorded.evidence.at(-1).id} with exit ${exit}.` });
  return store.taskView(root, reconciled);
}
function main(argv = process.argv.slice(2)) {
  const action = argv.shift();
  if (action === '--help' || !action) {
    console.log('Usage: task.js start|status|list|evidence|check|checkpoint|resume|action|recover-lock --root <repository> [--task <id>] [--input <json>] [--json]'); return;
  }
  const options = { root: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--json') continue;
    if (!['--root', '--task', '--input'].includes(argv[i]) || !argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error('Invalid task arguments');
    options[argv[i].slice(2)] = argv[++i];
  }
  const root = store.assertWorkspace(options.root);
  const input = options.input ? JSON.parse(safeReadTextFile(path.resolve(options.input)).content) : {};
  let result;
  if (action === 'list') result = store.listTasks(root);
  else if (action === 'recover-lock') result = store.recoverTaskLock(root, options.task);
  else if (action === 'status') result = store.taskView(root, store.readTask(root, options.task));
  else if (action === 'check') result = runCheck(root, options.task, input);
  else {
    const methods = { start: 'createTask', evidence: 'recordEvidence', checkpoint: 'checkpointTask', resume: 'resumeTask', action: 'recordAction' };
    if (!methods[action]) throw new Error('Unknown task action');
    const task = action === 'start' ? store.createTask(root, input) : store[methods[action]](root, options.task, input);
    result = store.taskView(root, task);
  }
  console.log(JSON.stringify(result, null, 2));
  if (action === 'check') {
    const proof = result.evidence.find(item => item.id === input.event_id);
    if (proof?.status !== 'passed' || proof.freshness !== 'current' || result.actions.some(item => ['pending', 'unknown'].includes(item.status))) process.exitCode = 1;
  }
}
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { runCheck, main };
