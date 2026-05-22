#!/usr/bin/env node
const {
  GUIDANCE_STATUS,
  explainRecommendations,
  inspectLearningGate,
  inspectProjectLearnings,
  inspectRefresh,
  refreshFailureDigest,
  refreshProjectTrends,
  renderRecommendation,
  renderRecommendationList,
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
const mergedLearningGate = unique.find((item) => item.command === 'forgeflow-learnings --project --check');
const explanation = explainRecommendations([refresh, inspectLearningGate()]);

const checks = [
  ['exports canonical statuses', GUIDANCE_STATUS.CURRENT === 'current' && GUIDANCE_STATUS.ATTENTION === 'attention' && GUIDANCE_STATUS.NOT_APPLICABLE === 'not-applicable'],
  ['refresh recommendation canonical', refresh.action === 'refresh-project-trends' && refresh.command === 'forgeflow-trends --refresh' && refresh.reason.includes('Project guidance artifacts')],
  ['refresh recommendation explains gate', refresh.evidence.includes('freshness checks') && refresh.clears.includes('both report current')],
  ['import gaps includes count', importGaps.action === 'review-import-gaps' && importGaps.reason.includes('3 production-scope import gap')],
  ['failure digest override keeps action', failureDigest.action === 'refresh-failure-digest' && failureDigest.reason === 'Digest fixture is stale.'],
  ['render recommendation includes reason evidence clears', renderRecommendation(refresh).includes('Project guidance artifacts') && renderRecommendation(refresh).includes('Evidence:') && renderRecommendation(refresh).includes('Clears:')],
  ['render recommendation list handles empty', renderRecommendationList([])[0] === '- (none)'],
  ['render recommendation list splits explainability', renderRecommendationList([refresh]).length === 3 && renderRecommendationList([refresh])[1].startsWith('  - Evidence:') && renderRecommendationList([refresh])[2].startsWith('  - Clears:')],
  ['explain recommendations normalizes next actions', explanation.next_actions.length === 2 && explanation.reason.includes('Project guidance artifacts') && explanation.evidence.includes('freshness checks') && explanation.clears.includes('quality gate reports pass')],
  ['explain recommendations preserves related actions', explainRecommendations([inspectLearningGate(), inspectProjectLearnings()]).next_actions[0].related_actions.includes('inspect-project-learnings')],
  ['dedupes by command', unique.length === 3 && unique.filter((item) => item.command === 'forgeflow-trends --refresh').length === 1 && unique.filter((item) => item.command === 'forgeflow-learnings --project --check').length === 1],
  ['dedupe preserves duplicate diagnostics', unique.find((item) => item.command === 'forgeflow-trends --refresh').reason.includes('Different surface, same action.') && mergedLearningGate.related_actions.includes('inspect-project-learnings')],
  ['dedupe preserves duplicate explainability', mergedLearningGate.evidence.includes('Latest-insights readiness') && mergedLearningGate.evidence.includes('project-learning checker') && mergedLearningGate.clears.includes('latest-insights readiness') && mergedLearningGate.clears.includes('project-learning checker')],
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
