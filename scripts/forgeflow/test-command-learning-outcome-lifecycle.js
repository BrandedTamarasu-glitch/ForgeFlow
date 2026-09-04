#!/usr/bin/env node
const fs = require('fs'); const os = require('os'); const path = require('path');
const { recordProjectLearning, projectLearningId } = require('./record-project-learning');
const { build: recordOutcome } = require('./record-command-interface-learning-outcome');
const { correctProjectLearning } = require('./correct-project-learning');
const { buildMemoryIndex } = require('./index-memory'); const { selectMemoryRecords } = require('./memory-retrieval');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-command-learning-lifecycle-')); const projectDir = path.join(root, '.forgeflow', 'demo');
const original = { category: 'validation-pattern', learning: 'Run health then smoke checks.', source: 'Forgeflow command interface evidence', evidence: '3 aggregate observations.', confidence: 'low', evidence_count: 3, application_guidance: 'Advisory only.', status: 'active' };
recordProjectLearning({ projectDir, inputEntries: [original] }); const id = projectLearningId(original);
recordOutcome({ projectDir, id, outcome: 'incorrect', write: true });
const withheld = buildMemoryIndex({ projectDir }).index.records; const withheldSelection = selectMemoryRecords(withheld, 'health smoke');
const correction = correctProjectLearning({ projectDir, id, replacement: 'Run focused validation before broader checks.', write: true });
const restored = buildMemoryIndex({ projectDir }).index.records; const restoredSelection = selectMemoryRecords(restored, 'focused validation');
if (!(withheldSelection.diagnostics.excluded_outcome_incorrect === 1 && withheldSelection.selected.length === 0 && restoredSelection.selected.some((item) => item.text.includes('Run focused validation')) && !restoredSelection.selected.some((item) => item.learning_id === id) && correction.status === 'written')) process.exit(1);
console.log('command learning outcome lifecycle: ok');
