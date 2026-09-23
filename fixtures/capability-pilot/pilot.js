#!/usr/bin/env node
// Checkout-only preparation/scoring. Does not invoke models or mutate trials.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { planSkillTrials } = require('../../scripts/forgeflow/task-evaluation');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

function preparePilot() {
  const protocol = JSON.parse(read('protocol.json'));
  const inputs = read('inputs.json');
  const answers = read('answer-key.json');
  if (hash(inputs) !== protocol.source_sha256 || hash(answers) !== protocol.answer_key_sha256) throw new Error('Frozen corpus or answer key changed');
  const tasks = JSON.parse(inputs).cases;
  const key = JSON.parse(answers);
  return Object.entries(protocol.procedures).map(([id, snapshot]) => {
    const procedure = read(snapshot.path);
    if (hash(procedure) !== snapshot.sha256) throw new Error('Frozen procedure changed');
    const configuration = { model: protocol.model, settings: protocol.settings, budget: protocol.budget };
    const manifest = {
      comparison: 'skill', execution: 'model-ready', seed: protocol.seed, repetitions: protocol.repetitions,
      baseline: `sha256:${protocol.source_sha256}`, skill: { id, revision: snapshot.sha256 },
      provenance: { source: 'fixtures/capability-pilot/inputs.json', source_revision: protocol.source_sha256, license: 'MIT (repository LICENSE)', derivation: 'New synthetic evidence snapshots authored for ForgeFlow. No copied project or personal data.', answer_key_sha256: protocol.answer_key_sha256 },
      criteria: key.scoring,
      arms: { 'skill-disabled': configuration, 'skill-enabled': configuration },
      tasks: tasks.filter(task => task.capability === id).map(({ id: taskId, input }) => ({ id: taskId, input })),
      measurement_limits: protocol.measurement_limits,
      protocol_sha256: hash(read('protocol.json')),
    };
    const plan = planSkillTrials(manifest);
    const prompts = Object.fromEntries(plan.trials.map(trial => [trial.trial_id, trial.skill_enabled ? `Procedure guidance (subject to the task limits):\n${procedure}\nTask:\n${trial.task.input}` : trial.task.input]));
    return { manifest, plan, prompts };
  });
}

function scoreResponse(taskId, text, reasoningConfirmed = false) {
  const expected = JSON.parse(read('answer-key.json')).cases[taskId]?.findings;
  if (!expected) throw new Error('Unknown case');
  let response;
  try { response = JSON.parse(text); } catch { return { valid: false, verified_completion: null, missed_defects: null, false_findings: null }; }
  if (!Array.isArray(response?.findings) || !Array.isArray(response.limitations) || !response.limitations.every(item => typeof item === 'string') || !response.findings.every(item => item !== null && typeof item === 'object' && typeof item.id === 'string' && typeof item.reason === 'string' && item.reason.trim())) return { valid: false, verified_completion: null, missed_defects: null, false_findings: null };
  const seen = new Set();
  let falseFindings = 0;
  for (const finding of response.findings) {
    if (!expected.includes(finding.id) || seen.has(finding.id)) falseFindings++;
    seen.add(finding.id);
  }
  const missed = expected.filter(id => !seen.has(id)).length;
  return { valid: true, verified_completion: reasoningConfirmed ? missed === 0 && falseFindings === 0 : null, missed_defects: missed, false_findings: falseFindings };
}

if (require.main === module) process.stdout.write(`${JSON.stringify(preparePilot(), null, 2)}\n`);
module.exports = { preparePilot, scoreResponse };
