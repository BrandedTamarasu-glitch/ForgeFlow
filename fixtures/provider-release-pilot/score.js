// Aggregate executed checks only. This function never creates model observations.
const fs = require('node:fs');
const protocol = require('./protocol.json');
function score(queue, records, { controlValidity = 'pending', evidence = 'actual' } = {}) {
  if (!['actual', 'fixture'].includes(evidence)) throw new Error('Unknown evidence kind');
  if (queue.length !== protocol.proposed_trials || queue.some((slot, index) => slot.index !== index
    || !protocol.families.some(family => family.id === slot.family) || !protocol.arms.includes(slot.arm)
    || !['defective', 'control'].includes(slot.variant))) throw new Error('Invalid queue');
  const observed = new Map();
  for (const record of records) {
    const slot = queue.find(item => item.index === record.index);
    if (!slot || observed.has(record.index)) throw new Error('Unknown or duplicate trial');
    if (!['completed', 'failed'].includes(record.status)) throw new Error('Invalid attempt status');
    const expected = protocol.checks[slot.family];
    if (record.status === 'completed') {
      if (!Array.isArray(record.checks) || record.checks.length !== expected.length || new Set(record.checks.map(check => check.id)).size !== expected.length
        || record.checks.some(check => !expected.includes(check.id) || typeof check.pass !== 'boolean')) throw new Error('Incomplete or invalid oracle output');
    }
    observed.set(record.index, record);
  }
  const rows = [];
  for (const family of protocol.families) for (const arm of protocol.arms) for (const variant of ['defective', 'control']) {
    const slots = queue.filter(slot => slot.family === family.id && slot.arm === arm && slot.variant === variant);
    if (slots.length !== protocol.repetitions) throw new Error('Unbalanced queue');
    const row = { family: family.id, arm, variant, planned: slots.length, observed: 0, complete: 0, failed_attempts: 0, missing: 0, regressions: 0, source_edits: 0, unknown_edits: 0, boundary_failures: 0 };
    for (const slot of slots) {
      const record = observed.get(slot.index);
      if (!record) { row.missing++; continue; }
      row.observed++;
      if (record.source_changed === true) row.source_edits++;
      else if (record.source_changed !== false) row.unknown_edits++;
      if (record.fixed_files_unchanged !== true) row.boundary_failures++;
      if (record.status === 'failed') { row.failed_attempts++; continue; }
      if (record.checks.every(check => check.pass) && record.fixed_files_unchanged === true) row.complete++;
      const initiallyFailed = variant === 'defective' ? protocol.initial_failures[family.id] : [];
      row.regressions += record.checks.filter(check => !check.pass && !initiallyFailed.includes(check.id)).length;
    }
    rows.push(row);
  }
  const repairs = arm => rows.filter(row => row.arm === arm && row.variant === 'defective').reduce((sum, row) => sum + row.complete, 0);
  const eligible = evidence === 'actual' && controlValidity === 'independently-reviewed' && observed.size === queue.length
    && protocol.status === 'frozen-after-independent-control-review'
    && protocol.review.required_families.every(family => protocol.review.completed.includes(family))
    && records.every(record => record.status === 'completed' && record.fixed_files_unchanged === true);
  const triggers = protocol.arms.filter(arm => arm !== 'baseline').filter(arm => eligible
    && repairs(arm) >= repairs('baseline') + 2
    && rows.filter(row => row.arm === arm && row.variant === 'control').every(row => row.complete === row.planned)
    && rows.filter(row => row.arm === arm).every(row => row.regressions === 0 && row.boundary_failures === 0));
  return { evidence, control_validity: controlValidity, planned: queue.length, observed: observed.size, missing: queue.length - observed.size,
    status: observed.size === 0 ? 'unobserved' : observed.size < queue.length ? 'incomplete' : 'observed', rows,
    improvement_trigger: triggers, activation_qualified: false,
    tokens: null, cost: null, exact_backend: null, latency: null };
}
if (require.main === module) {
  const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  console.log(JSON.stringify(score(input.queue, input.records, input.options), null, 2));
}
module.exports = { score };
