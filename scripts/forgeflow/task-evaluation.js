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

const WORKFLOW = { arms: ARMS, metrics: METRICS, target: 'forgeflow', minimum: 3 };
const SKILL = { arms: ['skill-disabled', 'skill-enabled'], metrics: [...METRICS, 'missed_defects', 'false_findings', 'latency_ms', 'tokens'], target: 'skill-enabled', minimum: 4 };

function validateManifest(manifest, profile = WORKFLOW) {
  requireText(manifest.seed, 'seed');
  requireText(manifest.baseline, 'baseline revision or snapshot identity');
  if (!Array.isArray(manifest.tasks) || !manifest.tasks.length) throw new Error('tasks must be nonempty');
  const ids = manifest.tasks.map((task) => requireText(task.id, 'task id'));
  if (new Set(ids).size !== ids.length) throw new Error('task ids must be unique');
  for (const arm of profile.arms) {
    const settings = manifest.arms && manifest.arms[arm];
    if (!settings || !Object.hasOwn(settings, 'model') || !Object.hasOwn(settings, 'settings') || !Object.hasOwn(settings, 'budget')) throw new Error(`${arm} requires model, settings, budget metadata (null allowed)`);
  }
  const repetitions = manifest.repetitions ?? profile.minimum;
  if (!Number.isSafeInteger(repetitions) || repetitions < profile.minimum || repetitions > 300 || repetitions % profile.arms.length) throw new Error(`repetitions must be a multiple of ${profile.arms.length} between ${profile.minimum} and 300`);
  return repetitions;
}

function planTrials(manifest, profile = WORKFLOW) {
  const repetitions = validateManifest(manifest, profile);
  const planId = digest(manifest);
  const trials = [];
  const tasks = [...manifest.tasks].sort((a, b) => digest([manifest.seed, a.id]).localeCompare(digest([manifest.seed, b.id])));
  for (const task of tasks) {
    const order = [...profile.arms].sort((a, b) => digest([manifest.seed, task.id, a]).localeCompare(digest([manifest.seed, task.id, b])));
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      for (let position = 0; position < profile.arms.length; position += 1) {
        const arm = order[(position + repetition) % profile.arms.length];
        const { model, settings, budget } = manifest.arms[arm];
        trials.push({ trial_id: digest([planId, task.id, repetition, arm]).slice(0, 24), plan_id: planId, task_id: task.id, task, baseline: manifest.baseline, repetition, position, arm, model, settings, budget, observation: 'unobserved', ...Object.fromEntries(profile.metrics.map((key) => [key, null])) });
      }
    }
  }
  return { schema_version: '1', plan_id: planId, seed: manifest.seed, boundary: 'Local schedule only. No model calls. Each arm occupies each order position equally. Use fresh isolated copies of the same baseline for each trial.', trials };
}

function validateTrial(record, profile = WORKFLOW) {
  for (const key of ['trial_id', 'plan_id', 'task_id', 'baseline']) requireText(record[key], key);
  if (!profile.arms.includes(record.arm)) throw new Error('Invalid arm');
  if (!['actual', 'fixture', 'unobserved'].includes(record.observation)) throw new Error('Explicit actual, fixture, or unobserved observation required');
  if (!Number.isSafeInteger(record.repetition) || record.repetition < 0) throw new Error('Invalid repetition');
  for (const key of ['model', 'settings', 'budget']) if (!Object.hasOwn(record, key)) throw new Error(`Missing ${key} metadata`);
  for (const metric of profile.metrics) {
    const value = record[metric];
    if (value === null || value === undefined) continue;
    if (record.observation === 'unobserved') throw new Error('Unobserved trial cannot contain measured outcomes');
    if (metric === 'verified_completion' ? typeof value !== 'boolean' : !Number.isFinite(value) || value < 0) throw new Error(`Invalid ${metric}`);
    if (['regressions', 'missed_defects', 'false_findings', 'tokens'].includes(metric) && !Number.isSafeInteger(value)) throw new Error(`${metric} must be an integer`);
  }
}

function summarizeGroup(records, observation, profile) {
  return profile.arms.map((arm) => {
    const trials = records.filter((record) => record.arm === arm && record.observation === observation);
    const metrics = Object.fromEntries(profile.metrics.map((metric) => {
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

function matchedDifferences(groups, observation, profile) {
  const complete = groups.filter((group) => group.length === profile.arms.length && group[0].observation === observation);
  return profile.arms.filter((arm) => arm !== profile.target).map((baselineArm) => {
    const metrics = Object.fromEntries(profile.metrics.map((metric) => {
      const differences = complete.flatMap((group) => {
        const baseline = group.find((record) => record.arm === baselineArm)[metric];
        const treatment = group.find((record) => record.arm === profile.target)[metric];
        return baseline == null || treatment == null ? [] : [Number(treatment) - Number(baseline)];
      });
      return [metric, { observed_pairs: differences.length, unknown_pairs: complete.length - differences.length, mean_difference: differences.length ? differences.reduce((sum, value) => sum + value, 0) / differences.length : null }];
    }));
    return { baseline_arm: baselineArm, direction: `${profile.target} minus baseline; descriptive only`, metrics };
  });
}

function summarizeTrials(input, profile = WORKFLOW) {
  const records = Array.isArray(input) ? input : input.trials;
  if (!Array.isArray(records)) throw new Error('Expected trial records array or {trials: []}');
  const seen = new Set();
  const matched = new Map();
  for (const record of records) {
    validateTrial(record, profile);
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
  return { schema_version: '1', actual: summarizeGroup(records, 'actual', profile), fixture: summarizeGroup(records, 'fixture', profile), matched_differences: { actual: matchedDifferences(groups, 'actual', profile), fixture: matchedDifferences(groups, 'fixture', profile) }, unobserved: records.filter((record) => record.observation === 'unobserved').length, matched_actual_groups: groups.filter((group) => group.length === profile.arms.length && group[0].observation === 'actual').length, incomplete_groups: groups.filter((group) => group.length !== profile.arms.length).length, boundary: 'Descriptive observed outcomes only. Fixture results are separated from actual trials; unknowns remain null. Differences use complete matched groups only. Counts do not establish causality or statistical superiority.' };
}

// Skill comparisons retain the original workflow arm meanings and schema.
// A manifest is the frozen protocol; only its task.input belongs in model input.
function planSkillTrials(manifest) {
  manifest = structuredClone(manifest);
  if (manifest.comparison !== 'skill') throw new Error('comparison must be skill');
  if (!['fixture-only', 'model-ready'].includes(manifest.execution)) throw new Error('execution must be fixture-only or model-ready');
  for (const key of ['id', 'revision']) requireText(manifest.skill?.[key], `skill.${key}`);
  for (const key of ['source', 'source_revision', 'license', 'derivation', 'answer_key_sha256']) requireText(manifest.provenance?.[key], `provenance.${key}`);
  for (const key of ['source_revision', 'answer_key_sha256']) {
    if (!/^[a-f0-9]{64}$/.test(manifest.provenance[key])) throw new Error(`provenance.${key} must be a SHA256 digest`);
  }
  requireText(manifest.criteria, 'frozen scoring criteria');
  if (!Array.isArray(manifest.tasks)) throw new Error('tasks must be nonempty');
  for (const task of manifest.tasks) {
    requireText(task.input, 'task input');
    if (Object.keys(task).some((key) => !['id', 'input'].includes(key))) throw new Error('Skill tasks accept only id and input; keep answer keys separate');
  }
  validateManifest(manifest, SKILL);
  if (digest(manifest.arms['skill-disabled']) !== digest(manifest.arms['skill-enabled'])) throw new Error('Skill arms must share model, settings and budget');
  if (manifest.execution === 'model-ready') requireText(manifest.arms['skill-enabled'].model, 'actual model identity');
  const plan = planTrials(manifest, SKILL);
  return { ...plan, schema_version: '2', comparison: 'skill', execution: manifest.execution, skill: manifest.skill, provenance: manifest.provenance, criteria: manifest.criteria,
    trials: plan.trials.map((trial) => ({ ...trial, comparison: 'skill', execution: manifest.execution, skill: manifest.skill, skill_enabled: trial.arm === 'skill-enabled', run_status: 'unobserved' })) };
}

function summarizeSkillTrials(input) {
  // Regenerate the entire schedule, retaining omitted attempts as unobserved.
  const plan = planSkillTrials(input.manifest);
  if (!Array.isArray(input.trials)) throw new Error('Expected trials array');
  const expected = new Map(plan.trials.map((trial) => [trial.trial_id, trial]));
  const submitted = new Map();
  const mutable = new Set([...SKILL.metrics, 'observation', 'run_status']);
  for (const record of input.trials) {
    const original = expected.get(record.trial_id);
    if (!original) throw new Error('Trial is not in the frozen plan');
    if (submitted.has(record.trial_id)) throw new Error('Duplicate trial id');
    const immutable = (value) => Object.fromEntries(Object.entries(value).filter(([key]) => !mutable.has(key)));
    if (digest(immutable(record)) !== digest(immutable(original))) throw new Error('Trial metadata differs from frozen plan');
    validateTrial(record, SKILL);
    if (record.observation === 'actual' && input.manifest.execution !== 'model-ready') throw new Error('Actual trials require a model-ready protocol');
    if (!['unobserved', 'completed', 'failed'].includes(record.run_status)) throw new Error('Invalid run_status');
    if ((record.observation === 'unobserved') !== (record.run_status === 'unobserved')) throw new Error('run_status must agree with observation');
    submitted.set(record.trial_id, record);
  }
  const trials = plan.trials.map((trial) => submitted.get(trial.trial_id) || trial);
  return { ...summarizeTrials(trials, SKILL), schema_version: '2', comparison: 'skill', plan_id: plan.plan_id,
    skill: plan.skill, provenance: plan.provenance, criteria: plan.criteria,
    scheduled: trials.length, submitted: submitted.size,
    failed: Object.fromEntries(['actual', 'fixture'].map((kind) => [kind, trials.filter((trial) => trial.observation === kind && trial.run_status === 'failed').length])), trials };
}

function main(argv) {
  const [command, flag, input, ...extra] = argv;
  if (!['plan', 'summarize', 'plan-skill', 'summarize-skill'].includes(command) || flag !== '--input' || !input || extra.length) throw new Error('Usage: task-evaluation.js plan|summarize|plan-skill|summarize-skill --input <json-file>');
  const file = path.resolve(input);
  const parsed = JSON.parse(safeReadTextFile(file).content);
  return { plan: planTrials, summarize: summarizeTrials, 'plan-skill': planSkillTrials, 'summarize-skill': summarizeSkillTrials }[command](parsed);
}

if (require.main === module) {
  try { process.stdout.write(`${JSON.stringify(main(process.argv.slice(2)), null, 2)}\n`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { ARMS, METRICS, planTrials, summarizeTrials, planSkillTrials, summarizeSkillTrials, main };
