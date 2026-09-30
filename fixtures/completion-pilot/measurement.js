// Coordinator-owned observations. Durations include orchestration and validation waits.
const fs = require('node:fs');
function summarize(events) {
  if (!Array.isArray(events) || !events.length || events.length > 10) throw new Error('invalid event count');
  let state = 'new', boot, previous, started, submitted, failed, correctionSubmitted, finished;
  let outcome;
  for (const e of events) {
    if (!e || typeof e.boot_id !== 'string' || !e.boot_id || typeof e.monotonic_ns !== 'string' || !/^[0-9]+$/.test(e.monotonic_ns)) throw new Error('invalid clock');
    const time = BigInt(e.monotonic_ns);
    if (boot && boot !== e.boot_id) throw new Error('clock epoch changed');
    if (previous !== undefined && time < previous) throw new Error('clock reversed');
    boot = e.boot_id; previous = time;
    if (e.type === 'start' && state === 'new') { started = time; state = 'working'; }
    else if (e.type === 'submission' && state === 'working') { submitted = time; state = 'validating'; }
    else if (e.type === 'validation_failed' && state === 'validating') { failed = time; state = 'correction'; }
    else if (e.type === 'correction_submission' && state === 'correction') { correctionSubmitted = time; state = 'revalidating'; }
    else if (e.type === 'validation_passed' && ['validating', 'revalidating'].includes(state)) { finished = time; outcome = 'passed'; state = 'terminal'; }
    else if (e.type === 'validation_failed' && state === 'revalidating') { finished = time; outcome = 'failed'; state = 'terminal'; }
    else if (['timeout', 'interrupted'].includes(e.type) && ['working', 'validating', 'correction', 'revalidating'].includes(state)) { finished = time; outcome = e.type; state = 'terminal'; }
    else throw new Error(`invalid transition ${state}:${e.type}`);
  }
  const seconds = (a, b) => a === undefined || b === undefined ? null : Number(b - a) / 1e9;
  const limits = require('./protocol.json').budget;
  const exceeded = [];
  if (seconds(started, submitted === undefined ? previous : submitted) > limits.initial_workflow_seconds) exceeded.push('initial-workflow');
  if (failed !== undefined && seconds(failed, correctionSubmitted === undefined ? previous : correctionSubmitted) > limits.correction_workflow_seconds) exceeded.push('correction-workflow');
  const firstValidation = failed === undefined ? finished : failed;
  if (submitted !== undefined && firstValidation !== undefined && seconds(submitted, firstValidation) > limits.acceptance_timeout_seconds) exceeded.push('initial-acceptance');
  if (correctionSubmitted !== undefined && finished !== undefined && seconds(correctionSubmitted, finished) > limits.acceptance_timeout_seconds) exceeded.push('correction-acceptance');
  return {
    budget_exceeded: exceeded,
    qualifies_within_budget: outcome === 'passed' && exceeded.length === 0,
    outcome: outcome || 'pending',
    initial_submission_seconds: seconds(started, submitted),
    verified_completion_seconds: outcome === 'passed' ? seconds(started, finished) : null,
    correction: failed === undefined
      ? { status: outcome === 'passed' ? 'not_applicable' : 'unobserved', seconds: null }
      : { status: outcome === 'passed' ? 'observed' : state === 'terminal' ? 'censored' : 'unobserved', seconds: outcome === 'passed' ? seconds(failed, finished) : null },
    observation_window_seconds: seconds(started, finished === undefined ? previous : finished),
  };
}
function record(file, type) {
  const events = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  events.push({ type, boot_id: fs.readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim(), monotonic_ns: process.hrtime.bigint().toString() });
  const result = summarize(events);
  // Exclusive coordinator, sequential calls only. Not a concurrent or crash-durable log.
  fs.writeFileSync(file, `${JSON.stringify(events, null, 2)}\n`);
  return result;
}
if (require.main === module) {
  try { console.log(JSON.stringify(record(process.argv[2], process.argv[3]), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { summarize, record };
