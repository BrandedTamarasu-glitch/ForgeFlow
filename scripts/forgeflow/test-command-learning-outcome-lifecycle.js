#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { recordProjectLearning, projectLearningId } = require('./record-project-learning');
const { build: recordOutcome } = require('./record-command-interface-learning-outcome');
const { correctProjectLearning } = require('./correct-project-learning');
const { rollupProjectLearnings } = require('./rollup-project-learnings');
const { buildMemoryIndex } = require('./index-memory');
const { selectMemoryRecords } = require('./memory-retrieval');
const { buildMemoryHits, buildContextPack } = require('./build-context-pack');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-command-learning-lifecycle-'));
const projectDir = path.join(root, '.forgeflow', path.basename(root));
const original = { category: 'validation-pattern', learning: 'Run health then smoke checks.', source: 'Forgeflow command interface evidence', evidence: '3 aggregate observations.', confidence: 'low', evidence_count: 3, application_guidance: 'Advisory only.', status: 'active' };
try {
  fs.mkdirSync(path.join(root, 'src/auth'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/auth/session.ts'), 'export const session = true;\n');
  const filesPath = path.join(root, 'review.files');
  fs.writeFileSync(filesPath, 'src/auth/session.ts\n');
  function assertSafePackets(memoryIndex, suffix) {
    const pack = buildContextPack({ root, memoryIndex, filesPath, out: path.join(projectDir, 'context', `${suffix}-${memoryIndex}`), task: 'health smoke focused validation', linesChanged: 80 });
    const packets = Object.values(pack.synthesis_input.agent_packets);
    assert(packets.length > 0, 'regression must exercise actual agent packets');
    for (const packet of packets) {
      assert(!fs.readFileSync(path.resolve(root, packet), 'utf8').includes(original.learning), 'rejected or retired guidance must not appear in complete packets');
    }
  }
  recordProjectLearning({ projectDir, inputEntries: [original] });
  const id = projectLearningId(original);
  const rollup = rollupProjectLearnings({ projectDir });
  const staleMarkdown = fs.readFileSync(rollup.out, 'utf8');
  assert(staleMarkdown.includes(original.learning));
  const oldIndex = buildMemoryIndex({ projectDir });
  assert(selectMemoryRecords(oldIndex.index.records, 'health smoke').selected.some((entry) => entry.learning_id === id));
  // Model an index from before materialized-view filtering was introduced.
  oldIndex.index.records.push({ source: path.relative(root, rollup.out), kind: 'bullet', text: original.learning, line: 1 });
  const staleIndex = path.join(projectDir, 'index', 'stale-index.json');
  fs.writeFileSync(staleIndex, JSON.stringify(oldIndex.index));

  recordOutcome({ projectDir, id, outcome: 'incorrect', write: true });
  for (const indexPath of [staleIndex, null]) {
    const hits = buildMemoryHits(root, [], { reasons: [] }, 'health smoke', 12000, indexPath);
    assert(!hits.includes(original.learning), 'current outcome must suppress stale index and direct fallback');
    assert(hits.includes('withheld after explicit incorrect-outcome feedback'));
  }
  rollupProjectLearnings({ projectDir });
  assert(!fs.readFileSync(rollup.out, 'utf8').includes(original.learning), 'rollup must apply current outcomes');
  fs.writeFileSync(rollup.out, staleMarkdown);
  const withheld = buildMemoryIndex({ projectDir }).index.records;
  const selection = selectMemoryRecords(withheld, 'health smoke');
  assert.strictEqual(selection.diagnostics.excluded_outcome_incorrect, 1);
  assert.strictEqual(selection.selected.length, 0, 'stale rollup must not bypass structured authority');

  for (const memoryIndex of [true, false]) {
    fs.writeFileSync(rollup.out, staleMarkdown);
    assertSafePackets(memoryIndex, 'rejected');
  }
  recordOutcome({ projectDir, id, outcome: 'useful', write: true });
  const correction = correctProjectLearning({ projectDir, id, replacement: 'Run focused validation before broader checks.', write: true });
  assert.strictEqual(correction.status, 'written');
  // Feedback no longer withholds the original, so retirement alone must hold.
  for (const memoryIndex of [true, false]) {
    fs.writeFileSync(rollup.out, staleMarkdown);
    const hits = buildMemoryHits(root, [], { reasons: [] }, 'health smoke focused validation', 12000);
    assert(!hits.includes(original.learning));
    assert(hits.includes('Run focused validation'));
    assertSafePackets(memoryIndex, 'retired');
    assert(!fs.readFileSync(rollup.out, 'utf8').includes(original.learning), 'inactive examples must stay out of injected Markdown');
  }
  assert(!buildMemoryHits(root, [], { reasons: [] }, 'health smoke', 12000, staleIndex).includes(original.learning), 'retirement must override cached active metadata');
  const restored = selectMemoryRecords(buildMemoryIndex({ projectDir }).index.records, 'focused validation');
  assert(restored.selected.some((entry) => entry.text.includes('Run focused validation')));
  assert(!restored.selected.some((entry) => entry.learning_id === id));
  console.log('command learning outcome lifecycle: ok');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
