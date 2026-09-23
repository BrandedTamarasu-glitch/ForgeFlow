// Checkout-only preparation. No models, network or installed runtime mutation.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const protocol = require('./protocol.json');
function prepare() {
  for (const [file, expected] of Object.entries(protocol.hashes)) {
    const observed = crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, file))).digest('hex');
    if (observed !== expected) throw new Error(`Frozen input changed: ${file}`);
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-recovery-workbench-'));
  const queue = [];
  for (const scenario of protocol.cases) for (let repeat = 0; repeat < protocol.repetitions; repeat++) for (let position = 0; position < protocol.arms.length; position++) {
    const arm = protocol.arms[(repeat + position) % protocol.arms.length];
    const index = queue.length, workspace = path.join(root, `trial-${index}`);
    fs.cpSync(path.join(__dirname, 'base'), workspace, { recursive: true });
    if (scenario === 'clean') fs.copyFileSync(path.join(__dirname, 'corrected-shelf.js'), path.join(workspace, 'src/shelf.js'));
    const treatment = arm === 'baseline' ? '' : fs.readFileSync(path.join(__dirname, 'treatments', `${arm === 'full' ? 'full' : 'checklist'}.md`), 'utf8');
    const prompt = fs.readFileSync(path.join(__dirname, 'task-template.txt'), 'utf8').replace('<TRIAL_WORKSPACE>', workspace)
      + (treatment ? `Additional procedure guidance (subject to task scope and budget):\n${treatment}` : '');
    fs.writeFileSync(path.join(root, `prompt-${index}.txt`), prompt);
    queue.push({ index, scenario, repeat, position, arm, workspace, prompt_bytes: Buffer.byteLength(prompt) });
  }
  fs.writeFileSync(path.join(root, 'queue.json'), JSON.stringify(queue, null, 2));
  fs.copyFileSync(path.join(__dirname, 'protocol.json'), path.join(root, 'frozen-protocol.json'));
  return { root, queue };
}
if (require.main === module) console.log(JSON.stringify(prepare(), null, 2));
module.exports = { prepare };
