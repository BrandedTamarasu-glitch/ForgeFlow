// Preparation only; no model calls or trial execution.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const protocol = require('./protocol.json');
function verifyHashes() {
  for (const [file, expected] of Object.entries(protocol.hashes)) {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, file))).digest('hex');
    if (actual !== expected) throw new Error(`Candidate input changed: ${file}`);
  }
}
function prepare({ candidateOnly = false } = {}) {
  verifyHashes();
  const reviewed = protocol.review.required_families.every(family => protocol.review.completed.includes(family));
  if (!candidateOnly && (protocol.status !== 'frozen-after-independent-control-review' || !reviewed)) throw new Error('Independent control review and protocol freeze are pending; trial execution is not ready.');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-provider-release-pilot-'));
  const queue = [];
  for (const [familyIndex, family] of protocol.families.entries()) for (const [variantIndex, variant] of ['defective', 'control'].entries()) {
    for (let repeat = 0; repeat < protocol.repetitions; repeat++) for (let position = 0; position < protocol.arms.length; position++) {
      const arm = protocol.arms[(familyIndex * 2 + variantIndex + repeat + position) % protocol.arms.length];
      const index = queue.length, workspace = path.join(root, `trial-${String(index).padStart(2, '0')}`);
      fs.cpSync(path.join(__dirname, family.id, 'base'), workspace, { recursive: true });
      if (variant === 'control') fs.copyFileSync(path.join(__dirname, family.id, 'control.js'), path.join(workspace, family.module));
      const treatment = arm === 'baseline' ? '' : fs.readFileSync(path.join(__dirname, 'treatments', `${family.id}-${arm}.md`), 'utf8');
      const prompt = fs.readFileSync(path.join(__dirname, 'task-template.txt'), 'utf8').replace('<TRIAL_WORKSPACE>', workspace).replace('<EDITABLE_MODULE>', family.module)
        + (treatment ? `\nAdditional guidance, subject to task scope and budget:\n${treatment}` : '');
      fs.writeFileSync(path.join(root, `prompt-${index}.txt`), prompt);
      queue.push({ index, family: family.id, variant, repeat, position, arm, workspace, module: family.module, prompt_bytes: Buffer.byteLength(prompt) });
    }
  }
  fs.writeFileSync(path.join(root, 'queue.json'), JSON.stringify(queue, null, 2));
  fs.copyFileSync(path.join(__dirname, 'protocol.json'), path.join(root, 'protocol.json'));
  return { root, queue, candidate_only: candidateOnly };
}
if (require.main === module) {
  try { console.log(JSON.stringify(prepare({ candidateOnly: process.argv.includes('--candidate-only') }), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { prepare, verifyHashes };
