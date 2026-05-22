#!/usr/bin/env node
const {
  GUIDANCE_STATUS,
  inspectLearningGate,
  inspectProjectLearnings,
  inspectRefresh,
  refreshFailureDigest,
  refreshProjectTrends,
  reviewImportGaps,
  uniqueRecommendations,
} = require('./guidance-contract');

const refresh = refreshProjectTrends();
const duplicateRefresh = refreshProjectTrends({ reason: 'Different surface, same action.' });
const importGaps = reviewImportGaps(3);
const failureDigest = refreshFailureDigest({ reason: 'Digest fixture is stale.' });
const unique = uniqueRecommendations([
  refresh,
  duplicateRefresh,
  inspectRefresh(),
  inspectLearningGate(),
  inspectProjectLearnings(),
  failureDigest,
]);

const checks = [
  ['exports canonical statuses', GUIDANCE_STATUS.CURRENT === 'current' && GUIDANCE_STATUS.ATTENTION === 'attention' && GUIDANCE_STATUS.NOT_APPLICABLE === 'not-applicable'],
  ['refresh recommendation canonical', refresh.action === 'refresh-project-trends' && refresh.command === 'forgeflow-trends --refresh' && refresh.reason.includes('Project guidance artifacts')],
  ['import gaps includes count', importGaps.action === 'review-import-gaps' && importGaps.reason.includes('3 production-scope import gap')],
  ['failure digest override keeps action', failureDigest.action === 'refresh-failure-digest' && failureDigest.reason === 'Digest fixture is stale.'],
  ['dedupes by command', unique.length === 3 && unique.filter((item) => item.command === 'forgeflow-trends --refresh').length === 1 && unique.filter((item) => item.command === 'forgeflow-learnings --project --check').length === 1],
  ['dedupe preserves duplicate diagnostics', unique.find((item) => item.command === 'forgeflow-trends --refresh').reason.includes('Different surface, same action.') && unique.find((item) => item.command === 'forgeflow-learnings --project --check').related_actions.includes('inspect-project-learnings')],
  ['learning gate command shared', inspectLearningGate().command === 'forgeflow-learnings --project --check' && inspectProjectLearnings().command === 'forgeflow-learnings --project --check'],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('guidance contract: ok');
