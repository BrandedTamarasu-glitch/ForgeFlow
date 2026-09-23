#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const fixture = path.resolve(__dirname, '../../fixtures/recovery-workbench');
const { evaluate } = require('../../fixtures/recovery-workbench/acceptance');
const protocol = require('../../fixtures/recovery-workbench/protocol.json');
const { prepare } = require('../../fixtures/recovery-workbench/prepare');
async function main() {
  for (const [file, expected] of Object.entries(protocol.hashes)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(fixture, file))).digest('hex'), expected, file);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'recovery-workbench-check-'));
  try {
    for (const scenario of ['defective', 'clean']) {
      const workspace = path.join(root, scenario);
      fs.cpSync(path.join(fixture, 'base'), workspace, { recursive: true });
      if (scenario === 'clean') fs.copyFileSync(path.join(fixture, 'corrected-shelf.js'), path.join(workspace, 'src/shelf.js'));
      const results = await evaluate(workspace);
      assert.equal(results.length, 8);
      assert.deepEqual(results.filter(result => !result.pass).map(result => result.id), scenario === 'clean' ? [] : ['concurrent-accepted', 'cleanup-publication']);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
  const prepared = prepare();
  try {
    assert.equal(prepared.queue.length, 18);
    for (const scenario of protocol.cases) for (const arm of protocol.arms) {
      const slots = prepared.queue.filter(slot => slot.scenario === scenario && slot.arm === arm);
      assert.deepEqual(slots.map(slot => slot.position).sort(), [0, 1, 2]);
      for (const slot of slots) {
        assert.equal(fs.existsSync(path.join(slot.workspace, 'acceptance.js')), false);
        assert.equal(fs.existsSync(path.join(slot.workspace, 'protocol.json')), false);
        const prompt = fs.readFileSync(path.join(prepared.root, `prompt-${slot.index}.txt`), 'utf8');
        assert.ok(prompt.includes(slot.workspace));
        assert.equal(Buffer.byteLength(prompt), slot.prompt_bytes);
      }
    }
  } finally { fs.rmSync(prepared.root, { recursive: true, force: true }); }
  console.log('recovery workbench: frozen hashes, isolated balanced 18-slot preparation, two seeded failures and eight clean acceptance checks passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
