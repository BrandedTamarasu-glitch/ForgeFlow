'use strict';
const path = require('node:path');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const { listTasks } = require('../../scripts/forgeflow/task-store');

// Keep source paths, command arguments, host sessions and event payloads server-side.
function scanTasks(projectRoot) {
  const snapshot = listTasks(projectRoot);
  return {
    schema_version: snapshot.schema_version,
    project_root: path.basename(snapshot.project_root),
    warnings: snapshot.warnings.length ? [`${snapshot.warnings.length} task record(s) could not be read.`] : [],
    tasks: snapshot.tasks.map(task => ({
      id: task.id, objective: task.objective, updated_at: task.updated_at,
      phase: task.phase, status: task.status, counts: task.counts, next_action: task.next_action,
      criteria: task.criteria.map(item => ({ id: item.id, description: item.description, status: item.status })),
      evidence: task.evidence.map(item => ({
        id: item.id, kind: item.kind, criterion_ids: item.criterion_ids,
        status: item.freshness === 'current' ? ({ passed: 'verified', failed: 'failed', waived: 'waived' }[item.status] || 'missing') : item.freshness,
        artifact: item.artifact?.path || null
      })),
      history: task.history.map(item => ({ at: item.at, phase: item.phase, action: item.state, freshness: item.freshness }))
    }))
  };
}
// One scan at a time per server. Overlapping readers share only the current work;
// the next request after completion captures source and artifacts again.
function createTaskScanner(projectRoot, options = {}) {
  const timeoutMs = options.timeoutMs ?? 8000;
  const workerFactory = options.workerFactory || (() => new Worker(__filename, {
    workerData: { forgeflowTaskScan: true, projectRoot }
  }));
  let active = null;
  let closed = false;
  function scan() {
    if (closed) return Promise.reject(new Error('Task scanner is closed'));
    if (active) return active.promise;
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    const job = { promise, worker: null, timer: null, settling: false, finish: null, cleanup: null };
    active = job;
    job.finish = (error, body) => {
      if (job.settling) return;
      job.settling = true;
      clearTimeout(job.timer);
      // Native calls inside the worker can delay termination. Deliver failures
      // promptly while keeping the worker slot reserved until cleanup finishes.
      if (error) reject(error);
      // Do not release the slot until termination completes, including timeout
      // and close paths. Requests cannot build a backlog of abandoned workers.
      job.cleanup = Promise.resolve().then(() => job.worker?.terminate()).then(() => {
        active = null;
        if (closed) reject(new Error('Task scanner is closed'));
        else if (error) reject(error);
        else resolve(body);
      }, error => { active = null; reject(error); });
    };
    try {
      job.worker = workerFactory();
      job.worker.once('message', message => {
        if (typeof message?.body !== 'string') job.finish(new Error('Task scan failed'));
        else job.finish(null, message.body);
      });
      job.worker.once('error', error => job.finish(error));
      job.worker.once('exit', () => job.finish(new Error('Task worker exited without a result')));
      job.timer = setTimeout(() => job.finish(new Error('Task scan timed out')), timeoutMs);
    } catch (error) { job.finish(error); }
    return promise;
  }
  function close() {
    closed = true;
    if (!active) return Promise.resolve();
    active.finish(new Error('Task scanner is closed'));
    return active.cleanup;
  }
  return { scan, close };
}

// Self-contained worker entry remains included in both existing host packages.
// Project paths come from the launching server, never an HTTP parameter.
if (!isMainThread && workerData?.forgeflowTaskScan === true) {
  try { parentPort.postMessage({ body: JSON.stringify(scanTasks(workerData.projectRoot)) }); }
  catch { parentPort.postMessage({ error: 'Task scan failed' }); }
}
module.exports = { scanTasks, createTaskScanner };
