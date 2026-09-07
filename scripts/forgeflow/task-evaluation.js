#!/usr/bin/env node
const crypto = require('crypto');
const path = require('path');
const { safeReadTextFile } = require('./file-safety');

const ARMS = Object.freeze(['no-agent', 'single-agent', 'forgeflow']);
const METRICS = Object.freeze(['verified_completion', 'human_correction_minutes', 'cost_usd', 'regressions']);

function requireText(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required`);
  return value;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function validateManifest(manifest) {
  requireText(manifest.seed, 'seed');
  requireText(manifest.baseline, 'baseline revision or snapshot identity');
  if (!Array.isArray(manifest.tasks) || !manifest.tasks.length) throw new Error('tasks must be nonempty');
  const ids = manifest.tasks.map((task) => requireText(task.id, 'task id'));
  if (new Set(ids).size !== ids.length) throw new Error('task ids must be unique');
  for (const arm of ARMS) {
    const settings = manifest.arms && manifest.arms[arm];
    if (!settings || !Object.hasOwn(settings, 'model') || !Object.hasOwn(settings, 'settings') || !Object.hasOwn(settings, 'budget')) throw new Error(`${arm} requires model, settings, budget metadata (null allowed)`);
  }
  const repetitions = manifest.repetitions ?? 3;
  if (!Number.isSafeInteger(repetitions) || repetitions < 3 || repetitions > 300 || repetitions % 3) throw new Error('repetitions must be a multiple of 3 between 3 and 300');
  return repetitions;
}

function planTrials(manifest) {
  const repetitions = validateManifest(manifest);
  const planId = digest(manifest);
  const trials = [];
  const tasks = [...manifest.tasks].sort((a, b) => digest([manifest.seed, a.id]).localeCompare(digest([manifest.seed, b.id])));
  for (const task of tasks) {
    const order = [...ARMS].sort((a, b) => digest([manifest.seed, task.id, a]).localeCompare(digest([manifest.seed, task.id, b])));
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      for (let position = 0; position < ARMS.length; position += 1) {
        const arm = order[(position + repetition) % ARMS.length];
        const { model, settings, budget } = manifest.arms[arm];
        trials.push({ trial_id: digest([planId, task.id, repetition, arm]).slice(0, 24), plan_id: planId, task_id: task.id, task, baseline: manifest.baseline, repetition, position, arm, model, settings, budget, observation: 'unobserved', ...Object.fromEntries(METRICS.map((key) => [key, null])) });
      }
    }
  }
  return { schema_version: '1', plan_id: planId, seed: manifest.seed, boundary: 'Local schedule only. No model calls. Each arm occupies each order position equally. Use fresh isolated copies of the same baseline for each trial.', trials };
}

function validateTrial(record) {
  for (const key of ['trial_id', 'plan_id', 'task_id', 'baseline']) requireText(record[key], key);
  if (!ARMS.includes(record.arm)) throw new Error('Invalid arm');
  if (!['actual', 'fixture', 'unobserved'].includes(record.observation)) throw new Error('Explicit actual, fixture, or unobserved observation required');
  if (!Number.isSafeInteger(record.repetition) || record.repetition < 0) throw new Error('Invalid repetition');
  for (const key of ['model', 'settings', 'budget']) if (!Object.hasOwn(record, key)) throw new Error(`Missing ${key} metadata`);
  for (const metric of METRICS) {
    const value = record[metric];
    if (value === null || value === undefined) continue;
    if (record.observation === 'unobserved') throw new Error('Unobserved trial cannot contain measured outcomes');
    if (metric === 'verified_completion' ? typeof value !== 'boolean' : !Number.isFinite(value) || value < 0) throw new Error(`Invalid ${metric}`);
    if (metric === 'regressions' && !Number.isSafeInteger(value)) throw new Error('regressions must be an integer');
  }
}

function summarizeGroup(records, observation) {
  return ARMS.map((arm) => {
    const trials = records.filter((record) => record.arm === arm && record.observation === observation);
    const metrics = Object.fromEntries(METRICS.map((metric) => {
      const observed = trials.map((trial) => trial[metric]).filter((value) => value !== null && value !== undefined);
      return [metric, { observed: observed.length, unknown: trials.length - observed.length, mean: observed.length ? observed.reduce((sum, value) => sum + Number(value), 0) / observed.length : null }];
    }));
    const configurations = [...new Map(trials.map(({ plan_id, baseline, model, settings, budget }) => {
      const configuration = { plan_id, baseline, model, settings, budget };
      return [digest(configuration), configuration];
    })).values()];
    return { arm, trials: trials.length, configurations, metrics };
  });
}

function matchedDifferences(groups, observation) {
  const complete = groups.filter((group) => group.length === ARMS.length && group[0].observation === observation);
  return ARMS.filter((arm) => arm !== 'forgeflow').map((baselineArm) => {
    const metrics = Object.fromEntries(METRICS.map((metric) => {
      const differences = complete.flatMap((group) => {
        const baseline = group.find((record) => record.arm === baselineArm)[metric];
        const forgeflow = group.find((record) => record.arm === 'forgeflow')[metric];
        return baseline == null || forgeflow == null ? [] : [Number(forgeflow) - Number(baseline)];
      });
      return [metric, { observed_pairs: differences.length, unknown_pairs: complete.length - differences.length, mean_difference: differences.length ? differences.reduce((sum, value) => sum + value, 0) / differences.length : null }];
    }));
    return { baseline_arm: baselineArm, direction: 'forgeflow minus baseline; descriptive only', metrics };
  });
}

function summarizeTrials(input) {
  const records = Array.isArray(input) ? input : input.trials;
  if (!Array.isArray(records)) throw new Error('Expected trial records array or {trials: []}');
  const seen = new Set();
  const matched = new Map();
  for (const record of records) {
    validateTrial(record);
    if (seen.has(record.trial_id)) throw new Error('Duplicate trial id');
    seen.add(record.trial_id);
    const key = digest([record.plan_id, record.task_id, record.repetition, record.observation]);
    const group = matched.get(key) || [];
    if (group.some((trial) => trial.arm === record.arm)) throw new Error('Duplicate arm in matched trial');
    if (group.some((trial) => trial.baseline !== record.baseline)) throw new Error('Matched trials must share a baseline');
    group.push(record);
    matched.set(key, group);
  }
  const groups = [...matched.values()];
  return { schema_version: '1', actual: summarizeGroup(records, 'actual'), fixture: summarizeGroup(records, 'fixture'), matched_differences: { actual: matchedDifferences(groups, 'actual'), fixture: matchedDifferences(groups, 'fixture') }, unobserved: records.filter((record) => record.observation === 'unobserved').length, matched_actual_groups: groups.filter((group) => group.length === 3 && group[0].observation === 'actual').length, incomplete_groups: groups.filter((group) => group.length !== 3).length, boundary: 'Descriptive observed outcomes only. Fixture results are separated from actual trials; unknowns remain null. Differences use complete matched groups only. Counts do not establish causality or statistical superiority.' };
}

function main(argv) {
  const [command, flag, input, ...extra] = argv;
  if (!['plan', 'summarize'].includes(command) || flag !== '--input' || !input || extra.length) throw new Error('Usage: task-evaluation.js plan|summarize --input <json-file>');
  const file = path.resolve(input);
  const parsed = JSON.parse(safeReadTextFile(file).content);
  return command === 'plan' ? planTrials(parsed) : summarizeTrials(parsed);
}

if (require.main === module) {
  try { process.stdout.write(`${JSON.stringify(main(process.argv.slice(2)), null, 2)}\n`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { ARMS, METRICS, planTrials, summarizeTrials, main };
