const GUIDANCE_STATUS = Object.freeze({
  CURRENT: 'current',
  ATTENTION: 'attention',
  MISSING: 'missing',
  INVALID: 'invalid',
  BLOCKED: 'blocked',
  NOT_APPLICABLE: 'not-applicable',
});

const RECOMMENDATIONS = Object.freeze({
  REFRESH_PROJECT_TRENDS: {
    severity: 'attention',
    action: 'refresh-project-trends',
    command: 'forgeflow-trends --refresh',
    reason: 'Project guidance artifacts are stale or missing for the current checkout.',
  },
  INSPECT_REFRESH: {
    severity: 'attention',
    action: 'inspect-refresh',
    command: 'forgeflow-learnings --project --check',
    reason: 'The trends refresh did not complete cleanly.',
  },
  INSPECT_LEARNING_GATE: {
    severity: 'attention',
    action: 'inspect-learning-gate',
    command: 'forgeflow-learnings --project --check',
    reason: 'Latest insights are not ready for agent context.',
  },
  INSPECT_PROJECT_LEARNINGS: {
    severity: 'attention',
    action: 'inspect-project-learnings',
    command: 'forgeflow-learnings --project --check',
    reason: 'Project learnings quality gate is not passing.',
  },
  REVIEW_IMPORT_GAPS: {
    severity: 'attention',
    action: 'review-import-gaps',
    command: 'forgeflow-code-map',
    reason: 'Code map has production-scope import gaps.',
  },
  REFRESH_FAILURE_DIGEST: {
    severity: 'attention',
    action: 'refresh-failure-digest',
    command: 'forgeflow-failure-digest',
    reason: 'Latest failure digest is stale for the current checkout.',
  },
});

function cloneRecommendation(template, overrides = {}) {
  return {
    ...template,
    ...overrides,
  };
}

function refreshProjectTrends(overrides = {}) {
  return cloneRecommendation(RECOMMENDATIONS.REFRESH_PROJECT_TRENDS, overrides);
}

function inspectRefresh(overrides = {}) {
  return cloneRecommendation(RECOMMENDATIONS.INSPECT_REFRESH, overrides);
}

function inspectLearningGate(overrides = {}) {
  return cloneRecommendation(RECOMMENDATIONS.INSPECT_LEARNING_GATE, overrides);
}

function inspectProjectLearnings(overrides = {}) {
  return cloneRecommendation(RECOMMENDATIONS.INSPECT_PROJECT_LEARNINGS, overrides);
}

function reviewImportGaps(productionTotal = 0, overrides = {}) {
  const reason = Number(productionTotal) > 0
    ? `Code map has ${productionTotal} production-scope import gap(s).`
    : RECOMMENDATIONS.REVIEW_IMPORT_GAPS.reason;
  return cloneRecommendation(RECOMMENDATIONS.REVIEW_IMPORT_GAPS, { reason, ...overrides });
}

function refreshFailureDigest(overrides = {}) {
  return cloneRecommendation(RECOMMENDATIONS.REFRESH_FAILURE_DIGEST, overrides);
}

function uniqueRecommendations(items) {
  const seen = new Map();
  const out = [];
  for (const item of items || []) {
    const key = item && (item.command || item.action || item.reason);
    if (!item || !key) continue;
    if (!seen.has(key)) {
      seen.set(key, item);
      out.push(item);
      continue;
    }
    const existing = seen.get(key);
    if (item.reason && existing.reason && item.reason !== existing.reason && !existing.reason.includes(item.reason)) {
      existing.reason = `${existing.reason} Also: ${item.reason}`;
    }
    if (item.action && existing.action && item.action !== existing.action) {
      const actions = new Set(existing.related_actions || [existing.action]);
      actions.add(item.action);
      existing.related_actions = [...actions];
    }
  }
  return out;
}

module.exports = {
  GUIDANCE_STATUS,
  RECOMMENDATIONS,
  inspectLearningGate,
  inspectProjectLearnings,
  inspectRefresh,
  refreshFailureDigest,
  refreshProjectTrends,
  reviewImportGaps,
  uniqueRecommendations,
};
