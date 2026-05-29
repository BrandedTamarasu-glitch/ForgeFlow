#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { compareLearningSignalPolicy, normalizePolicy, readLearningSignalPolicy, renderMarkdown, writeLearningSignalPolicy } = require('./learning-signal-policy');
const { buildLearningStatus, buildSignalQuality, renderMarkdown: renderLearningStatusMarkdown } = require('./show-learning-status');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-learning-policy-'));
const projectDir = path.join(root, '.forgeflow', 'Project');
fs.mkdirSync(projectDir, { recursive: true });
const custom = writeLearningSignalPolicy(projectDir, { aging_unreinforced_days: 1, stale_unreinforced_days: 2, aging_penalty: 5, stale_penalty: 9, missing_penalty: 7, reinforcement_records: 2 });
const read = readLearningSignalPolicy(projectDir);
const proposedFile = path.join(root, 'proposed-policy.json');
fs.writeFileSync(proposedFile, JSON.stringify({ aging_unreinforced_days: 3, stale_unreinforced_days: 7, aging_penalty: 4, stale_penalty: 11, missing_penalty: 6, reinforcement_records: 4 }, null, 2));
const comparison = compareLearningSignalPolicy(projectDir, proposedFile);
const normalized = normalizePolicy({ aging_unreinforced_days: 10, stale_unreinforced_days: 1 });
const quality = buildSignalQuality([{ name: 'agent-feedback', status: 'missing', records: 0, issues: 0 }], {}, projectDir, read.policy);
const status = buildLearningStatus({ root, projectDir });
const statusMarkdown = renderLearningStatusMarkdown(status);
const markdown = renderMarkdown(read);
let unsafeBlocked = false;
try {
  writeLearningSignalPolicy(path.join(root, 'not-forgeflow'));
} catch (_err) {
  unsafeBlocked = true;
}
let bareForgeflowBlocked = false;
try {
  writeLearningSignalPolicy(path.join(root, '.forgeflow'));
} catch (_err) {
  bareForgeflowBlocked = true;
}

const checks = [
  ['writes policy', custom.status === 'written' && fs.existsSync(custom.file)],
  ['reads custom policy', read.status === 'custom' && read.policy.missing_penalty === 7],
  ['normalizes stale threshold', normalized.stale_unreinforced_days === 10],
  ['compares proposed policy', comparison.status === 'changed' && comparison.changes.some((change) => change.field === 'reinforcement_records') && renderMarkdown(comparison).includes('Policy Comparison')],
  ['blocks non-forgeflow project dir', unsafeBlocked],
  ['blocks bare forgeflow dir', bareForgeflowBlocked],
  ['policy affects quality', quality.signals[0].decay.penalty === 7 && quality.policy.reinforcement_records === 2],
  ['learning status consumes policy', status.learning_signal_policy.status === 'custom' && status.signal_quality.policy.missing_penalty === 7 && statusMarkdown.includes('Policy: custom')],
  ['renders markdown', markdown.includes('# Forgeflow Learning Signal Policy')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('learning signal policy: ok');
