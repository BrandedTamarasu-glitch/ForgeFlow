const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { planSkillTrials } = require('../../scripts/forgeflow/task-evaluation');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
function preparePilot() {
  const protocol = JSON.parse(read('protocol.json'));
  for (const [file, expected] of [['inputs.json', protocol.source_sha256], ['answer-key.json', protocol.answer_key_sha256]]) {
    if (hash(read(file)) !== expected) throw new Error('Frozen corpus/key changed');
  }
  return Object.entries(protocol.procedures).map(([id, snapshot]) => {
    const procedure = read(snapshot.path);
    if (hash(procedure) !== snapshot.sha256) throw new Error('Frozen procedure changed');
    const configuration = { model: protocol.model, settings: protocol.settings, budget: protocol.budget };
    const manifest = { comparison: 'skill', execution: 'model-ready', seed: protocol.seed, repetitions: protocol.repetitions,
      baseline: `sha256:${protocol.source_sha256}`, skill: { id, revision: snapshot.sha256 },
      provenance: { source: 'fixtures/recovery-review-pilot/inputs.json', source_revision: protocol.source_sha256, license: 'MIT (repository LICENSE)', derivation: protocol.provenance, answer_key_sha256: protocol.answer_key_sha256 },
      criteria: JSON.parse(read('answer-key.json')).scoring, arms: { 'skill-disabled': configuration, 'skill-enabled': configuration },
      tasks: JSON.parse(read('inputs.json')).cases.filter(item => item.capability === id).map(({ id, input }) => ({ id, input })),
      protocol_sha256: hash(read('protocol.json')), measurement_limits: protocol.measurement_limits };
    const plan = planSkillTrials(manifest);
    const prompts = Object.fromEntries(plan.trials.map(trial => [trial.trial_id, trial.skill_enabled ? `Procedure guidance (subject to task limits):\n${procedure}\nTask:\n${trial.task.input}` : trial.task.input]));
    return { manifest, plan, prompts };
  });
}
module.exports = { preparePilot };
