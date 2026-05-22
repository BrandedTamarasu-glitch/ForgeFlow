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
    evidence: 'One or more freshness checks reported missing, stale, or dirty-checkout guidance artifacts.',
    clears: 'Cleared when project guidance freshness and latest-insights freshness both report current for this checkout.',
  },
  INSPECT_REFRESH: {
    severity: 'attention',
    action: 'inspect-refresh',
    command: 'forgeflow-learnings --project --check',
    reason: 'The trends refresh did not complete cleanly.',
    evidence: 'The refresh step returned a non-pass status.',
    clears: 'Cleared when the refresh step reports pass and the project-learning quality gate reports pass.',
  },
  INSPECT_LEARNING_GATE: {
    severity: 'attention',
    action: 'inspect-learning-gate',
    command: 'forgeflow-learnings --project --check',
    reason: 'Latest insights are not ready for agent context.',
    evidence: 'Latest-insights readiness is blocked, invalid, or errored.',
    clears: 'Cleared when latest-insights readiness reports injected and the quality gate reports pass.',
  },
  INSPECT_PROJECT_LEARNINGS: {
    severity: 'attention',
    action: 'inspect-project-learnings',
    command: 'forgeflow-learnings --project --check',
    reason: 'Project learnings quality gate is not passing.',
    evidence: 'The project-learning checker returned warn, fail, or invalid.',
    clears: 'Cleared when the project-learning checker reports pass with no remaining issues.',
  },
  REVIEW_IMPORT_GAPS: {
    severity: 'attention',
    action: 'review-import-gaps',
    command: 'forgeflow-code-map',
    reason: 'Code map has production-scope import gaps.',
    evidence: 'The latest code map classified unresolved or dynamic imports as production-scope gaps.',
    clears: 'Cleared when production-scope import gaps are fixed, resolved by topology support, or explicitly accepted as expected.',
  },
  REFRESH_FAILURE_DIGEST: {
    severity: 'attention',
    action: 'refresh-failure-digest',
    command: 'forgeflow-failure-digest',
    reason: 'Latest failure digest is stale for the current checkout.',
    evidence: 'The latest failure digest is missing, invalid, or stale for the current Git state.',
    clears: 'Cleared when the digest is regenerated from current raw output and freshness reports current.',
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
    if (item.evidence && existing.evidence && item.evidence !== existing.evidence && !existing.evidence.includes(item.evidence)) {
      existing.evidence = `${existing.evidence} Also: ${item.evidence}`;
    } else if (item.evidence && !existing.evidence) {
      existing.evidence = item.evidence;
    }
    if (item.clears && existing.clears && item.clears !== existing.clears && !existing.clears.includes(item.clears)) {
      existing.clears = `${existing.clears} Also: ${item.clears}`;
    } else if (item.clears && !existing.clears) {
      existing.clears = item.clears;
    }
    if (item.action && existing.action && item.action !== existing.action) {
      const actions = new Set(existing.related_actions || [existing.action]);
      actions.add(item.action);
      existing.related_actions = [...actions];
    }
  }
  return out;
}

function recommendationParts(item) {
  if (!item) return '';
  const command = item.command || item.action || '(no command)';
  const parts = [`${command}: ${item.reason || 'No reason provided.'}`];
  if (item.evidence) parts.push(`Evidence: ${item.evidence}`);
  if (item.clears) parts.push(`Clears: ${item.clears}`);
  return parts;
}

function renderRecommendation(item) {
  const parts = recommendationParts(item);
  return Array.isArray(parts) ? parts.join(' ') : parts;
}

function renderRecommendationList(items) {
  const recommendations = items || [];
  if (recommendations.length === 0) return ['- (none)'];
  return recommendations.flatMap((item) => {
    const parts = recommendationParts(item);
    if (!Array.isArray(parts) || parts.length === 0) return [];
    return [
      `- ${parts[0]}`,
      ...parts.slice(1).map((part) => `  - ${part}`),
    ];
  });
}

module.exports = {
  GUIDANCE_STATUS,
  RECOMMENDATIONS,
  inspectLearningGate,
  inspectProjectLearnings,
  inspectRefresh,
  refreshFailureDigest,
  refreshProjectTrends,
  renderRecommendation,
  renderRecommendationList,
  reviewImportGaps,
  uniqueRecommendations,
};
