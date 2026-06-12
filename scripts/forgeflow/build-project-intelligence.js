#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { assertSafeDirectory, safeReadTextFile, writeFileSafe } = require('./file-safety');
const { containsProhibitedFeedbackContent, rollupFeedback } = require('./record-agent-feedback');
const { applyOutcome, validateOutcome } = require('./record-review-outcome');
const { correctionThemes, promotionCandidates, staleMarkers } = require('./rollup-agent-feedback');
const { showProjectLearnings } = require('./show-project-learnings');
const { showProjectTrends } = require('./show-project-trends');
const { compactUserProfile } = require('./user-profile');
const { readNextWorkOutcomes } = require('./record-next-work-outcome');
const { buildLeanDecision, renderBriefSection: renderLeanBriefSection } = require('./render-lean-decision');
const VALID_FEEDBACK_SIGNALS = new Set(['useful', 'unclear', 'ignored', 'incorrect']);
const VALID_FEEDBACK_CONFIDENCE = new Set(['low', 'medium', 'high']);
const NEXT_WORK_SOURCE_RANK = Object.freeze({
  security: 0,
  schema: 0,
  runtime: 0,
  'import-gaps': 1,
  'context-advisor': 1,
  'project-learnings': 1,
  'failure-digest': 1,
  'user-profile': 2,
  'review-outcomes': 2,
  'agent-feedback': 3,
  readiness: 4,
  'next-work-confidence': 5,
  'review-prep': 6,
  'project-intelligence': 7,
});

function usage() {
  console.error('Usage: build-project-intelligence.js [--root <dir>] [--project-dir <dir>] [--out <path>] [--json] [--next-work] [--brief <index>]');
}

function argumentError(message, exitOnError) {
  if (exitOnError) {
    console.error(message);
    usage();
    process.exit(2);
  }
  const err = new Error(message);
  err.exitCode = 2;
  throw err;
}

function requireValue(argv, name, index, exitOnError = true) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) {
    argumentError(`Missing value for ${name}`, exitOnError);
  }
  return value;
}

function parseArgs(argv, options = {}) {
  const exitOnError = options.exitOnError !== false;
  const opts = {
    root: process.cwd(),
    projectDir: '',
    out: '',
    json: false,
    nextWork: false,
    briefIndex: 0,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i, exitOnError));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i, exitOnError));
      i += 1;
    } else if (arg === '--out') {
      opts.out = path.resolve(requireValue(argv, arg, i, exitOnError));
      i += 1;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--next-work') {
      opts.nextWork = true;
    } else if (arg === '--brief') {
      const value = Number(requireValue(argv, arg, i, exitOnError));
      if (!Number.isInteger(value) || value < 1) {
        argumentError(`Invalid value for ${arg}: ${argv[i + 1] || ''}`, exitOnError);
      }
      opts.briefIndex = value;
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      if (exitOnError) process.exit(0);
      return opts;
    } else {
      argumentError(`Unknown argument: ${arg}`, exitOnError);
    }
  }
  return opts;
}

function defaultProjectDir(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function defaultJsonOut(projectDir) {
  return path.join(projectDir, 'context', 'project-intelligence-rollup.json');
}

function markdownOutFor(jsonOut) {
  return /\.json$/i.test(jsonOut) ? jsonOut.replace(/\.json$/i, '.md') : `${jsonOut}.md`;
}

function trimBullet(value) {
  if (value && typeof value === 'object') {
    return trimBullet(value.text || value.summary || value.name || value.path || JSON.stringify(value));
  }
  return String(value || '').replace(/^-\s+/, '').trim();
}

function topItems(items, limit = 5) {
  return (items || []).map(trimBullet).filter(Boolean).slice(0, limit);
}

function feedbackSchemaIssue(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return 'invalid-schema';
  if (!record.agent || typeof record.agent !== 'string') return 'invalid-schema';
  if (!VALID_FEEDBACK_SIGNALS.has(record.signal)) return 'invalid-schema';
  if (!record.summary || typeof record.summary !== 'string') return 'invalid-schema';
  if (!VALID_FEEDBACK_CONFIDENCE.has(record.confidence)) return 'invalid-schema';
  if (!Number.isInteger(record.evidence_count) || record.evidence_count < 1) return 'invalid-schema';
  return '';
}

function readAgentFeedback(projectDir) {
  const file = path.join(projectDir, 'agent-feedback.jsonl');
  if (!fs.existsSync(file)) {
    return {
      status: 'missing',
      file,
      records: 0,
      by_signal: {},
      by_agent: {},
      promotable: 0,
      invalid_lines: 0,
      latest: [],
    };
  }
  try {
    const records = [];
    const invalid = [];
    const lines = safeReadTextFile(file, projectDir).content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    for (const [index, line] of lines.entries()) {
      try {
        const record = JSON.parse(line);
        const schemaIssue = feedbackSchemaIssue(record);
        if (schemaIssue) {
          invalid.push({ line: index + 1, reason: schemaIssue });
          continue;
        }
        const combined = [
          record.work_item,
          record.agent,
          record.signal,
          record.summary,
          record.correction,
        ].join('\n');
        if (containsProhibitedFeedbackContent(combined)) {
          invalid.push({ line: index + 1, reason: 'privacy-boundary' });
          continue;
        }
        records.push(record);
      } catch (err) {
        invalid.push({ line: index + 1, reason: 'malformed-json' });
      }
    }
    const rollup = rollupFeedback(records);
    return {
      status: records.length > 0 ? 'present' : 'invalid',
      file,
      records: rollup.records,
      by_signal: rollup.by_signal,
      by_agent: rollup.by_agent,
      promotable: rollup.promotable,
      invalid_lines: invalid.length,
      latest: records.slice(-5).map((record) => ({
        agent: record.agent || '',
        signal: record.signal || '',
        summary: record.summary || '',
        confidence: record.confidence || '',
        evidence_count: record.evidence_count || 0,
      })),
      correction_themes: correctionThemes(records),
      promotion_candidates: promotionCandidates(records),
      stale_markers: staleMarkers(records),
      invalid_reasons: invalid.slice(0, 5),
    };
  } catch (err) {
    return {
      status: 'invalid',
      file,
      records: 0,
      by_signal: {},
      by_agent: {},
      promotable: 0,
      invalid_lines: 0,
      latest: [],
      reason: err.message,
    };
  }
}

function emptyReviewOutcomeSummary() {
  return {
    schema_version: '1',
    records: 0,
    modes: {},
    agents: {},
    totals: {
      findings_total: 0,
      findings_confirmed: 0,
      findings_rejected: 0,
      verifier_confirmed: 0,
      verifier_rejected: 0,
      verifier_blocked: 0,
      review_minutes: 0,
      auto_fix_success: 0,
      auto_fix_failed: 0,
      post_merge_regression: 0,
    },
    learning_signals: {
      true_positive: 0,
      false_positive: 0,
      missed_issue: 0,
      stale_guidance: 0,
      manual_promotion_candidate: 0,
    },
    classes: {},
  };
}

function readReviewOutcomes(projectDir) {
  const file = path.join(projectDir, 'review-outcomes.jsonl');
  if (!fs.existsSync(file)) {
    return {
      status: 'missing',
      file,
      records: 0,
      invalid_lines: 0,
      learning_signals: emptyReviewOutcomeSummary().learning_signals,
      totals: emptyReviewOutcomeSummary().totals,
      classes: {},
      top_classes: [],
    };
  }
  try {
    const summary = emptyReviewOutcomeSummary();
    const invalid = [];
    const lines = safeReadTextFile(file, projectDir).content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    for (const [index, line] of lines.entries()) {
      try {
        const record = JSON.parse(line);
        const errors = validateOutcome(record);
        if (errors.length > 0) {
          invalid.push({ line: index + 1, reason: 'invalid-schema' });
          continue;
        }
        applyOutcome(summary, record);
      } catch (err) {
        invalid.push({ line: index + 1, reason: 'malformed-json' });
      }
    }
    summary.totals.review_minutes = Number(summary.totals.review_minutes.toFixed(2));
    const topClasses = Object.entries(summary.classes || {})
      .map(([name, counts]) => ({ name, ...counts }))
      .sort((a, b) => (b.findings_confirmed - a.findings_confirmed) || (b.findings_total - a.findings_total) || a.name.localeCompare(b.name))
      .slice(0, 5);
    return {
      status: summary.records > 0 ? 'present' : 'invalid',
      file,
      records: summary.records,
      invalid_lines: invalid.length,
      invalid_reasons: invalid.slice(0, 5),
      modes: summary.modes,
      agents: summary.agents,
      totals: summary.totals,
      learning_signals: summary.learning_signals,
      top_classes: topClasses,
    };
  } catch (err) {
    return {
      status: 'invalid',
      file,
      records: 0,
      invalid_lines: 0,
      learning_signals: emptyReviewOutcomeSummary().learning_signals,
      totals: emptyReviewOutcomeSummary().totals,
      classes: {},
      top_classes: [],
      reason: err.message,
    };
  }
}

function git(args, cwd) {
  const result = spawnSync('git', ['-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', ...args], {
    cwd,
    encoding: 'utf8',
  });
  if (result.status !== 0) return '';
  return result.stdout.trim();
}

function gitProvenance(root) {
  const topLevel = git(['rev-parse', '--show-toplevel'], root);
  if (!topLevel) {
    return {
      available: false,
      branch: '',
      commit_short: '',
      dirty: false,
      dirty_available: false,
    };
  }
  return {
    available: true,
    branch: git(['branch', '--show-current'], root),
    commit_short: git(['rev-parse', '--short', 'HEAD'], root),
    dirty: false,
    dirty_available: false,
  };
}

function addIssue(out, severity, source, summary, nextAction = '') {
  if (!summary) return;
  out.push({ severity, source, summary, next_action: nextAction });
}

function freshnessIssues(trends) {
  const issues = [];
  for (const issue of (trends.freshness && trends.freshness.issues) || []) {
    addIssue(issues, issue.severity || 'attention', 'project-freshness', issue.message || issue.code, 'forgeflow-trends --refresh');
  }
  for (const issue of (trends.latest_insights && trends.latest_insights.freshness && trends.latest_insights.freshness.issues) || []) {
    addIssue(issues, issue.severity || 'attention', 'latest-insights', issue.message || issue.code, 'forgeflow-trends --refresh');
  }
  const failureDigest = trends.failure_digest || {};
  if (failureDigest.first_run) return issues;
  for (const issue of (failureDigest.freshness && failureDigest.freshness.issues) || []) {
    addIssue(issues, issue.severity || 'attention', 'failure-digest', issue.message || issue.code, 'forgeflow-failure-digest');
  }
  return issues;
}

function riskSignals(trends, learnings) {
  return collectRiskSignals(trends, learnings).slice(0, 8);
}

function collectRiskSignals(trends, learnings) {
  const risks = [];
  const learningStatus = learnings && learnings.check ? learnings.check.status : 'missing';
  const learningGatePass = learningStatus === 'pass';
  if (learningStatus !== 'pass') {
    addIssue(
      risks,
      learningStatus === 'fail' ? 'high' : 'attention',
      'project-learnings',
      `Project-learning quality gate is ${learningStatus}.`,
      'forgeflow-learnings --project --check'
    );
  }
  const importGaps = trends.import_gaps || {};
  if (importGaps.status === 'attention') {
    addIssue(
      risks,
      'attention',
      'import-gaps',
      `${importGaps.production_total || 0} production-scope import gap(s) need review.`,
      'forgeflow-code-map'
    );
  }
  const digest = trends.failure_digest || {};
  if (!digest.first_run && digest.triage && digest.triage.state && !['usable', 'missing'].includes(digest.triage.state)) {
    addIssue(
      risks,
      digest.triage.state === 'raw-required' ? 'high' : 'attention',
      'failure-digest',
      digest.triage.reason || `Failure digest state is ${digest.triage.state}.`,
      digest.triage.next_action ? digest.triage.next_action.command || digest.triage.next_action.action : 'forgeflow-failure-digest'
    );
  }
  for (const item of (trends.advisor && trends.advisor.recommendations) || []) {
    if (item.severity === 'info') continue;
    addIssue(risks, item.severity || 'attention', 'context-advisor', item.reason, item.command);
  }
  risks.push(...freshnessIssues(trends));
  if (learningGatePass) {
    for (const item of topItems(learnings.risk_areas, 3)) {
      addIssue(risks, 'attention', 'project-learnings', item, 'inspect project-learnings.md');
    }
  }
  return risks;
}

function trustState(trends, learnings, risks) {
  const latest = trends.latest_insights || {};
  const freshness = trends.freshness || {};
  const learningCheck = learnings.check || {};
  const latestGate = latest.check_status || '';
  const highRisk = risks.some((item) => item.severity === 'high' || item.severity === 'fail');
  if (highRisk || learningCheck.status === 'fail' || latestGate === 'fail') return 'blocked';
  if (
    freshness.status === 'current'
    && latest.status === 'injected'
    && (!latestGate || latestGate === 'pass')
    && (!latest.freshness || latest.freshness.status === 'current')
    && learningCheck.status === 'pass'
    && risks.length === 0
  ) {
    return 'current';
  }
  return 'attention';
}

function readinessState(trends = {}, learnings = {}, risks = [], recommendations = []) {
  const reasons = [];
  const clearing = [];
  const learningStatus = learnings.check ? learnings.check.status : 'missing';
  const latest = trends.latest_insights || {};
  const projectFreshness = trends.freshness ? trends.freshness.status : 'missing';
  const latestFreshness = latest.freshness ? latest.freshness.status : 'missing';
  const failureDigest = trends.failure_digest || {};
  const failureDigestFreshness = failureDigest.freshness ? failureDigest.freshness.status : 'not-applicable';
  const importGaps = trends.import_gaps || {};
  const advisorStatus = trends.advisor ? (trends.advisor.budget_status || (trends.advisor.budget && trends.advisor.budget.status) || '') : '';

  function note(reason, command) {
    if (reason && !reasons.includes(reason)) reasons.push(reason);
    if (command && !clearing.includes(command)) clearing.push(command);
  }

  if (learningStatus === 'fail') note('Project-learning quality gate is failing.', 'forgeflow-learnings --project --check');
  if (latest.check_status && latest.check_status !== 'pass') note(`Latest-insights quality gate is ${latest.check_status}.`, 'forgeflow-trends --refresh');
  if (risks.some((risk) => risk.severity === 'high' || risk.severity === 'fail')) {
    for (const risk of risks.filter((item) => item.severity === 'high' || item.severity === 'fail')) {
      note(`${risk.source}: ${risk.summary}`, risk.next_action);
    }
  }
  if (reasons.length > 0) {
    return {
      state: 'blocked',
      reasons,
      clearing_commands: clearing,
      evidence: {
        project_freshness: projectFreshness,
        latest_insights_freshness: latestFreshness,
        failure_digest_freshness: failureDigestFreshness,
        project_learnings_gate: learningStatus,
        latest_insights_gate: latest.check_status || '',
        import_gaps: importGaps.status || 'missing',
        context_budget: advisorStatus || 'unknown',
      },
    };
  }

  if (projectFreshness !== 'current' || latestFreshness !== 'current' || failureDigestFreshness === 'attention' || learningStatus !== 'pass') {
    if (projectFreshness !== 'current') note(`Project guidance freshness is ${projectFreshness}.`, 'forgeflow-trends --refresh');
    if (latestFreshness !== 'current') note(`Latest-insights freshness is ${latestFreshness}.`, 'forgeflow-trends --refresh');
    if (failureDigestFreshness === 'attention') note('Failure digest is stale for the current checkout.', 'forgeflow-failure-digest');
    if (learningStatus !== 'pass') note(`Project-learning quality gate is ${learningStatus}.`, 'forgeflow-learnings --project --check');
    return {
      state: 'needs-refresh',
      reasons,
      clearing_commands: clearing,
      evidence: {
        project_freshness: projectFreshness,
        latest_insights_freshness: latestFreshness,
        failure_digest_freshness: failureDigestFreshness,
        project_learnings_gate: learningStatus,
        latest_insights_gate: latest.check_status || '',
        import_gaps: importGaps.status || 'missing',
        context_budget: advisorStatus || 'unknown',
      },
    };
  }

  if (importGaps.status === 'attention' || ['warn', 'fail'].includes(advisorStatus) || recommendations.some((item) => item.severity && item.severity !== 'info')) {
    if (importGaps.status === 'attention') note(`${importGaps.production_total || 0} production-scope import gap(s) need review.`, 'forgeflow-code-map');
    if (['warn', 'fail'].includes(advisorStatus)) note(`Context budget advisor is ${advisorStatus}.`, 'check-context-budget --root .forgeflow --warn-only --json');
    for (const item of recommendations.filter((entry) => entry.severity && entry.severity !== 'info')) {
      note(item.reason || item.action, item.command);
    }
  }
  for (const risk of risks) {
    note(`${risk.source}: ${risk.summary}`, risk.next_action);
  }
  if (reasons.length > 0) {
    return {
      state: 'needs-triage',
      reasons,
      clearing_commands: clearing,
      evidence: {
        project_freshness: projectFreshness,
        latest_insights_freshness: latestFreshness,
        failure_digest_freshness: failureDigestFreshness,
        project_learnings_gate: learningStatus,
        latest_insights_gate: latest.check_status || '',
        import_gaps: importGaps.status || 'missing',
        context_budget: advisorStatus || 'unknown',
      },
    };
  }

  return {
    state: 'ready',
    reasons: ['Project intelligence inputs are current and no triage signals are active.'],
    clearing_commands: [],
    evidence: {
      project_freshness: projectFreshness,
      latest_insights_freshness: latestFreshness,
      failure_digest_freshness: failureDigestFreshness,
      project_learnings_gate: learningStatus,
      latest_insights_gate: latest.check_status || '',
      import_gaps: importGaps.status || 'missing',
      context_budget: advisorStatus || 'unknown',
    },
  };
}

function reviewPrep(trends, intelligenceDraft) {
  const readFirst = [
    ...topItems(intelligenceDraft.hot_files, 5),
    ...topItems((trends.code_map && trends.code_map.new_high_fan_in) || [], 3),
    ...topItems((trends.code_map && trends.code_map.new_high_fan_out) || [], 3),
  ].filter((value, index, list) => list.indexOf(value) === index).slice(0, 8);
  const nextActions = [
    ...intelligenceDraft.top_risks.map((risk) => risk.next_action),
    ...intelligenceDraft.recommendations.map((item) => item.command || item.action),
  ].filter(Boolean).filter((value, index, list) => list.indexOf(value) === index).slice(0, 6);
  const looksRunnable = (value) => /^(\/?forgeflow|scripts\/|node\s+scripts\/|npm\s+|pnpm\s+|yarn\s+|git\s+)/.test(String(value || '').trim());
  const refreshFirst = nextActions.filter(looksRunnable);
  const feedback = intelligenceDraft.agent_feedback || {};
  const outcomes = intelligenceDraft.review_outcomes || {};
  const outcomeSignals = outcomes.learning_signals || {};
  const feedbackNotes = [];
  const corrective = (feedback.by_signal && ((feedback.by_signal.incorrect || 0) + (feedback.by_signal.unclear || 0) + (feedback.by_signal.ignored || 0))) || 0;
  if (corrective > 0) feedbackNotes.push(`${corrective} corrective agent-feedback signal(s) recorded; inspect ${feedback.file || 'agent-feedback.jsonl'} before reusing similar guidance. Advisory only; verify against current code and tests.`);
  if (feedback.promotable > 0) feedbackNotes.push(`${feedback.promotable} feedback signal(s) are promotable when reviewed and still supported.`);
  for (const item of (feedback.correction_themes || []).slice(0, 3)) {
    feedbackNotes.push(`Correction theme: ${item.theme} (${item.count} signal(s)); ${item.manual_promotion}`);
  }
  for (const item of (feedback.promotion_candidates || []).slice(0, 3)) {
    feedbackNotes.push(`Promotion candidate: ${item.agent} ${item.signal} feedback with ${item.evidence_count} evidence point(s); ${item.manual_promotion}`);
  }
  if (feedback.stale_markers && feedback.stale_markers.status !== 'current') {
    feedbackNotes.push(`Agent-feedback staleness marker is ${feedback.stale_markers.status}; old records ${feedback.stale_markers.stale_records}, missing timestamps ${feedback.stale_markers.missing_timestamp_records}.`);
  }
  if (feedback.invalid_lines > 0) feedbackNotes.push(`${feedback.invalid_lines} agent-feedback line(s) were skipped by JSON/privacy validation.`);
  for (const item of (feedback.latest || []).slice(-3)) {
    if (item.signal && item.summary) {
      feedbackNotes.push(`${item.agent || 'agent'} ${item.signal}: ${item.summary} [confidence: ${item.confidence || 'unknown'}, evidence: ${item.evidence_count || 0}, advisory-only]`);
    }
  }
  const outcomeNotes = [];
  if ((outcomes.records || 0) > 0) {
    const truePositives = outcomeSignals.true_positive || 0;
    const falsePositives = outcomeSignals.false_positive || 0;
    const missedIssues = outcomeSignals.missed_issue || 0;
    const staleGuidance = outcomeSignals.stale_guidance || 0;
    const promotionCandidates = outcomeSignals.manual_promotion_candidate || 0;
    if (falsePositives > 0) outcomeNotes.push(`${falsePositives} false-positive review outcome signal(s) recorded; verify similar future findings against current code before escalating.`);
    if (missedIssues > 0) outcomeNotes.push(`${missedIssues} missed-issue signal(s) recorded after review; prioritize regression evidence and focused tests for similar work.`);
    if (staleGuidance > 0) outcomeNotes.push(`${staleGuidance} stale-guidance signal(s) recorded; refresh or correct the underlying project guidance before reusing it.`);
    if (promotionCandidates > 0) outcomeNotes.push(`${promotionCandidates} manual promotion candidate(s) recorded from review outcomes; promote only after current-code verification.`);
    if (truePositives > 0) outcomeNotes.push(`${truePositives} true-positive review outcome signal(s) recorded; useful reviewer patterns may be worth preserving when still supported.`);
  }
  if ((outcomes.invalid_lines || 0) > 0) outcomeNotes.push(`${outcomes.invalid_lines} review-outcome line(s) were skipped by JSON/schema validation.`);
  return {
    trust_summary: `Trust state is ${intelligenceDraft.trust_state}; project freshness ${intelligenceDraft.freshness.project}; latest insights ${intelligenceDraft.freshness.latest_insights}.`,
    refresh_first: refreshFirst,
    review_notes: [
      ...nextActions.filter((item) => !looksRunnable(item)),
      ...feedbackNotes,
      ...outcomeNotes,
    ],
    read_first: readFirst,
    validate_first: topItems(intelligenceDraft.validation_patterns, 5),
  };
}

function nextWorkBrief(intelligenceDraft) {
  const readiness = intelligenceDraft.readiness || {};
  const review = intelligenceDraft.review_prep || {};
  const readFirst = [
    ...(review.read_first || []),
    ...(intelligenceDraft.hot_files || []),
  ].filter(Boolean).filter((value, index, list) => list.indexOf(value) === index).slice(0, 8);
  const avoidFirst = [];
  if (readiness.state && readiness.state !== 'ready') {
    avoidFirst.push(`Do not start broad implementation until readiness is ${readiness.state === 'blocked' ? 'unblocked' : 'triaged'}; clear ${((readiness.clearing_commands || [])[0] || 'the readiness findings')} first.`);
  }
  if ((intelligenceDraft.guidance || {}).project_learnings_gate !== 'pass') {
    avoidFirst.push('Do not treat project learnings as agent guidance until the learning quality gate passes.');
  }
  if ((intelligenceDraft.top_risks || []).some((risk) => risk.source === 'import-gaps')) {
    avoidFirst.push('Do not treat static import gaps as runtime failures without checking the referenced files or bundler aliases.');
  }
  const corrective = intelligenceDraft.agent_feedback && intelligenceDraft.agent_feedback.by_signal
    ? (intelligenceDraft.agent_feedback.by_signal.incorrect || 0) + (intelligenceDraft.agent_feedback.by_signal.unclear || 0) + (intelligenceDraft.agent_feedback.by_signal.ignored || 0)
    : 0;
  if (corrective > 0) {
    avoidFirst.push('Do not reuse prior agent guidance blindly; inspect corrective feedback and verify against current code.');
  }
  const reviewSignals = intelligenceDraft.review_outcomes ? intelligenceDraft.review_outcomes.learning_signals || {} : {};
  if ((reviewSignals.false_positive || 0) > 0 || (reviewSignals.stale_guidance || 0) > 0) {
    avoidFirst.push('Do not repeat previously rejected or stale review guidance; inspect review-outcome learning signals before escalating similar findings.');
  }
  if ((reviewSignals.missed_issue || 0) > 0) {
    avoidFirst.push('Do not skip regression-oriented validation; review outcomes recorded missed issues on prior work.');
  }
  if (avoidFirst.length === 0) {
    avoidFirst.push('Do not skip current code and validation evidence; this brief is orientation only.');
  }
  const validateFirst = (review.validate_first || [])
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)
    .slice(0, 8);
  return {
    state: readiness.state || 'unknown',
    read_first: readFirst,
    avoid_first: avoidFirst.slice(0, 8),
    validate_first: validateFirst,
    proof_boundary: [
      'Use this brief as orientation only to choose what to inspect first, not as proof that a change is safe.',
      'Verify every implementation decision against current code, focused tests, full validation, and review evidence.',
      'Treat project learnings, topology, failure digest, and agent feedback as advisory local artifacts.',
    ],
  };
}

function priorityForSeverity(severity) {
  if (severity === 'high' || severity === 'fail') return 'high';
  if (severity === 'warn' || severity === 'attention') return 'medium';
  return 'low';
}

function nextWorkRankingPolicy() {
  return {
    priority_rank: { high: 0, medium: 1, low: 2 },
    source_rank: { ...NEXT_WORK_SOURCE_RANK },
    boundary: 'Priority comes first, then current actionable source rank, confidence score, and original order. Add new signal families here deliberately.',
  };
}

function evidenceStrengthForItem(item) {
  if (item.evidence_strength) return item.evidence_strength;
  if (item.source === 'readiness') return item.priority === 'high' ? 'strong' : 'medium';
  if (item.source === 'review-outcomes') return 'medium';
  if (item.source === 'agent-feedback') return 'medium';
  if (item.source === 'review-prep' || item.source === 'project-intelligence') return 'weak';
  if (item.priority === 'high') return 'medium';
  return 'weak';
}

function validationForRisk(risk, review) {
  const source = risk.source || '';
  if (source === 'context-advisor') {
    return ['scripts/forgeflow/check-context-budget.js --root .forgeflow --warn-only --json', 'scripts/forgeflow/advise-context.js --root .forgeflow --record --json'];
  }
  if (source === 'import-gaps') {
    return ['forgeflow-code-map', 'scripts/forgeflow/build-code-topology.js --json'];
  }
  if (source === 'project-learnings') {
    return ['scripts/forgeflow/show-project-learnings.js --check --json'];
  }
  if (source === 'project-freshness' || source === 'latest-insights' || source === 'failure-digest') {
    return ['forgeflow-trends --refresh'];
  }
  const refreshFirst = topItems((review && review.refresh_first) || [], 2);
  return refreshFirst.length > 0 ? refreshFirst : ['scripts/forgeflow/build-project-intelligence.js --json'];
}

function actionQualityForItem(item) {
  const source = item.source || 'project-intelligence';
  const title = item.title || 'Review project-intelligence candidate';
  const validateWith = topItems(item.validate_with || [], 4);
  const proof = item.proof_boundary || 'Advisory candidate only; verify against current code, tests, and review output before treating it as work complete.';
  const defaults = {
    what_to_change: item.what_to_change || `Inspect the current ${source} evidence for "${title}" and choose the smallest bounded change it supports.`,
    how_to_prove: item.how_to_prove || (validateWith.length > 0
      ? `Run ${validateWith.join('; ')} and verify the raw artifact still supports the candidate.`
      : 'Run focused validation for the selected slice, then full validation before review.'),
    stop_when: item.stop_when || `Stop when the candidate is cleared, contradicted by current evidence, or needs product judgment; ${proof}`,
    evidence_strength: evidenceStrengthForItem(item),
  };
  if (source === 'readiness') {
    defaults.what_to_change = item.what_to_change || 'Clear the readiness blocker or triage item before starting broader implementation work.';
    defaults.how_to_prove = item.how_to_prove || 'Rebuild project intelligence and confirm readiness moved to ready or the remaining state is explicitly understood.';
    defaults.stop_when = item.stop_when || 'Stop once readiness is ready, or when a remaining blocker requires product or environment input.';
  } else if (source === 'agent-feedback') {
    defaults.what_to_change = item.what_to_change || 'Inspect corrective feedback and update only the guidance or workflow behavior still supported by current code.';
    defaults.how_to_prove = item.how_to_prove || 'Rebuild project intelligence and confirm feedback remains advisory unless manually promoted with current evidence.';
    defaults.stop_when = item.stop_when || 'Stop when unsupported feedback is not reused automatically, or when promotion needs a human confirmation.';
  } else if (source === 'review-outcomes') {
    defaults.what_to_change = item.what_to_change || 'Triage aggregate review-outcome signals and correct stale or rejected guidance before repeating it.';
    defaults.how_to_prove = item.how_to_prove || 'Rebuild project intelligence and confirm future guidance points to current code, validation, and review evidence.';
    defaults.stop_when = item.stop_when || 'Stop when stale guidance is refreshed, rejected guidance is not repeated, or a missed issue has regression coverage planned.';
  } else if (source === 'review-prep') {
    defaults.what_to_change = item.what_to_change || 'Use read-first and validate-first guidance to define a small implementation slice, not a broad project plan.';
    defaults.how_to_prove = item.how_to_prove || 'Confirm the selected slice has current-code evidence, focused tests, full validation, and review coverage.';
    defaults.stop_when = item.stop_when || 'Stop at slice selection if product intent or acceptance criteria are unclear.';
  } else if (source === 'context-advisor') {
    defaults.what_to_change = item.what_to_change || 'Triage the context-budget or context-size signal and narrow scope only if the current budget helper still reports pressure.';
    defaults.how_to_prove = item.how_to_prove || 'Run the context budget and context advisor helpers and confirm the compact packet is within budget or has an explicit trim plan.';
    defaults.stop_when = item.stop_when || 'Stop when the budget signal clears, a trim plan exists, or the selected work must be split before review.';
  } else if (source === 'import-gaps') {
    defaults.what_to_change = item.what_to_change || 'Inspect unresolved import guidance and separate expected static-analysis gaps from project gaps that need review.';
    defaults.how_to_prove = item.how_to_prove || 'Refresh the code map or topology helper and confirm production-scope gaps are cleared, accepted, or still labeled for review.';
    defaults.stop_when = item.stop_when || 'Stop when remaining gaps are either accepted static-analysis limits or require project-specific bundler knowledge.';
  } else if (source === 'project-intelligence') {
    defaults.what_to_change = item.what_to_change || 'Select a small product-backed slice, then refresh project intelligence before planning from it.';
    defaults.how_to_prove = item.how_to_prove || 'Confirm refreshed intelligence produces no stronger local candidate, then validate the selected slice normally.';
    defaults.stop_when = item.stop_when || 'Stop when the next slice requires product judgment, missing context, or external state.';
  }
  return defaults;
}

function confidenceForItem(item) {
  const reasons = [];
  let score = 35;
  const strength = item.evidence_strength || 'weak';
  if (strength === 'strong') {
    score += 25;
    reasons.push('strong-evidence');
  } else if (strength === 'medium') {
    score += 15;
    reasons.push('medium-evidence');
  } else {
    reasons.push('weak-evidence');
  }
  if ((item.start_with || []).length > 0) {
    score += 10;
    reasons.push('has-start-point');
  }
  if ((item.validate_with || []).length > 0) {
    score += 15;
    reasons.push('has-validation');
  }
  if (item.priority === 'high') {
    score += 10;
    reasons.push('high-priority');
  }
  if (/readiness|review-outcomes|agent-feedback|next-work-confidence/.test(item.source || '')) {
    score -= 10;
    reasons.push('historical-or-readiness-signal');
  }
  if (/advisory|aggregate|history|trend/i.test(item.proof_boundary || '')) {
    score -= 5;
    reasons.push('advisory-boundary');
  }
  const bounded = Math.max(5, Math.min(95, score));
  const band = bounded >= 75 ? 'high' : bounded >= 50 ? 'medium' : 'low';
  return {
    confidence: {
      score: bounded,
      band,
      reason_codes: reasons,
      boundary: 'Recommendation confidence is advisory ranking only; current scope, code, validation, review, and user priorities decide the work.',
    },
  };
}

function addNextWorkItem(items, item) {
  if (!item || !item.title) return;
  if (item.priority === 'info' || item.severity === 'info') return;
  if (item.source === 'failure-digest' && item.first_run) return;
  const dedupeKey = [
    item.title,
    item.source || 'project-intelligence',
    item.why || '',
  ].join('\n');
  if (items.some((existing) => existing.dedupe_key === dedupeKey)) return;
  items.push({
    dedupe_key: dedupeKey,
    title: item.title,
    priority: item.priority || 'medium',
    source: item.source || 'project-intelligence',
    why: item.why || '',
    start_with: topItems(item.start_with || [], 4),
    validate_with: topItems(item.validate_with || [], 4),
    evidence_strength: item.evidence_strength,
    what_to_change: item.what_to_change,
    how_to_prove: item.how_to_prove,
    stop_when: item.stop_when,
    proof_boundary: item.proof_boundary || 'Advisory candidate only; verify against current code, tests, and review output before treating it as work complete.',
  });
  Object.assign(items[items.length - 1], actionQualityForItem(items[items.length - 1]));
  Object.assign(items[items.length - 1], confidenceForItem(items[items.length - 1]));
}

function nextWorkItems(intelligenceDraft) {
  const items = [];
  const readiness = intelligenceDraft.readiness || {};
  const review = intelligenceDraft.review_prep || {};
  const feedback = intelligenceDraft.agent_feedback || {};
  const userProfile = intelligenceDraft.user_profile || {};
  const nextWorkOutcomes = intelligenceDraft.next_work_confidence || {};
  const corrective = feedback.by_signal
    ? (feedback.by_signal.incorrect || 0) + (feedback.by_signal.unclear || 0) + (feedback.by_signal.ignored || 0)
    : 0;
  const outcomeSignals = intelligenceDraft.review_outcomes ? intelligenceDraft.review_outcomes.learning_signals || {} : {};

  if (readiness.state && readiness.state !== 'ready') {
    addNextWorkItem(items, {
      title: `Clear ${readiness.state} project-intelligence readiness`,
      priority: readiness.state === 'blocked' ? 'high' : 'medium',
      source: 'readiness',
      why: (readiness.reasons || [])[0] || `Project intelligence readiness is ${readiness.state}.`,
      start_with: readiness.clearing_commands || [],
      validate_with: ['scripts/forgeflow/build-project-intelligence.js --json'],
      proof_boundary: 'Clearing readiness only proves local guidance is current enough to plan; it does not approve implementation work.',
    });
  }

  if (corrective > 0) {
    const feedbackIsStale = feedback.stale_markers && feedback.stale_markers.status && feedback.stale_markers.status !== 'current';
    addNextWorkItem(items, {
      title: 'Review corrective agent feedback before reusing guidance',
      priority: 'medium',
      source: 'agent-feedback',
      why: `${corrective} corrective feedback signal(s) may change how agents should interpret similar work.`,
      start_with: [feedback.file || 'agent-feedback.jsonl', ...(review.review_notes || []).filter((item) => item.includes('corrective agent-feedback')).slice(0, 1)],
      validate_with: ['scripts/forgeflow/build-project-intelligence.js --json'],
      evidence_strength: feedbackIsStale ? 'weak' : 'medium',
      stop_when: feedbackIsStale
        ? 'Stop when stale feedback is not promoted or reused without fresh current-code evidence.'
        : undefined,
      proof_boundary: 'Feedback is advisory only and must be promoted manually only after current-code verification.',
    });
  }

  if ((outcomeSignals.stale_guidance || 0) > 0 || (outcomeSignals.false_positive || 0) > 0 || (outcomeSignals.missed_issue || 0) > 0) {
    const activeSignals = [];
    if ((outcomeSignals.stale_guidance || 0) > 0) activeSignals.push(`${outcomeSignals.stale_guidance} stale-guidance`);
    if ((outcomeSignals.false_positive || 0) > 0) activeSignals.push(`${outcomeSignals.false_positive} false-positive`);
    if ((outcomeSignals.missed_issue || 0) > 0) activeSignals.push(`${outcomeSignals.missed_issue} missed-issue`);
    addNextWorkItem(items, {
      title: 'Triage review-outcome learning signals before repeating guidance',
      priority: (outcomeSignals.missed_issue || 0) > 0 ? 'high' : 'medium',
      source: 'review-outcomes',
      why: `${activeSignals.join(', ')} signal(s) may affect future review guidance.`,
      start_with: [intelligenceDraft.review_outcomes.file || 'review-outcomes.jsonl'],
      validate_with: ['scripts/forgeflow/build-project-intelligence.js --json', 'scripts/forgeflow/record-review-outcome.js --summary .forgeflow/<project>/review-outcomes.jsonl --json'],
      proof_boundary: 'Review-outcome learning signals are aggregate guidance only; verify each future finding against current code and tests.',
    });
  }

  if (nextWorkOutcomes.recommendation === 'calibrate-next-work-selection') {
    addNextWorkItem(items, {
      title: 'Calibrate next-work recommendations from outcome history',
      priority: 'medium',
      source: 'next-work-confidence',
      why: `${(nextWorkOutcomes.by_outcome && ((nextWorkOutcomes.by_outcome.ignored || 0) + (nextWorkOutcomes.by_outcome.incorrect || 0) + (nextWorkOutcomes.by_outcome.blocked || 0))) || 0} prior next-work outcome(s) were ignored, incorrect, or blocked.`,
      start_with: [nextWorkOutcomes.file || 'next-work-outcomes.jsonl'],
      validate_with: ['scripts/forgeflow/build-project-intelligence.js --json'],
      evidence_strength: 'weak',
      what_to_change: 'Adjust future candidate selection only after matching outcome history to current code and user intent.',
      how_to_prove: 'Record follow-up next-work outcomes and compare whether useful outcomes increase.',
      stop_when: 'Stop before treating historical next-work outcomes as proof that a current task is correct.',
      proof_boundary: 'Next-work confidence is advisory trend evidence only; verify current scope, code, tests, and user priorities.',
    });
  }

  const profileNeedsReview = userProfile.status && userProfile.status !== 'pass';
  const profileSuggestions = userProfile.suggestion_count || 0;
  const profileConflicts = userProfile.conflict_count || 0;
  if (profileNeedsReview || profileSuggestions > 0 || profileConflicts > 0) {
    addNextWorkItem(items, {
      title: 'Review user profile guidance before agent-heavy work',
      priority: profileConflicts > 0 || userProfile.status === 'fail' ? 'high' : 'medium',
      source: 'user-profile',
      why: `${userProfile.status || 'missing'} profile status with ${profileSuggestions} suggestion(s) and ${profileConflicts} conflict(s) can change how agents communicate, validate, or escalate.`,
      start_with: ['scripts/forgeflow/render-profile-review.js', 'scripts/forgeflow/check-user-profile.js --json'],
      validate_with: ['scripts/forgeflow/build-project-intelligence.js --json', 'scripts/forgeflow/check-profile-compliance.js'],
      evidence_strength: 'medium',
      what_to_change: 'Clarify, move, or supersede profile guidance only after explicit user confirmation.',
      how_to_prove: 'Rerun the profile review and project intelligence; profile-related next-work should disappear or downgrade when guidance is clean.',
      stop_when: 'Stop before recording inferred preferences or changing behavior from profile guidance that conflicts with current user instructions.',
      proof_boundary: 'User profile guidance is advisory only and never overrides current instructions, security, accessibility, validation evidence, or product judgment.',
    });
  }

  const rankedRisks = (intelligenceDraft.top_risks || [])
    .filter((risk) => risk && risk.severity !== 'info' && !(risk.source === 'failure-digest' && risk.first_run))
    .map((risk, index) => ({
      ...risk,
      _order: index,
      _rank: ({ high: 0, fail: 0, attention: 1, warn: 1, medium: 1, low: 2 }[risk.severity] ?? 2),
    }))
    .sort((a, b) => a._rank - b._rank || a._order - b._order)
    .slice(0, 3);
  for (const risk of rankedRisks) {
    addNextWorkItem(items, {
      title: `Triage ${risk.source} signal`,
      priority: priorityForSeverity(risk.severity),
      source: risk.source,
      why: risk.summary,
      start_with: [risk.next_action].filter(Boolean),
      validate_with: validationForRisk(risk, review),
      proof_boundary: 'A triaged signal is not a bug fix by itself; verify the raw artifact and current project behavior.',
    });
  }

  if ((review.read_first || []).length > 0 || (review.validate_first || []).length > 0) {
    addNextWorkItem(items, {
      title: 'Plan the next implementation slice from local project guidance',
      priority: items.length === 0 ? 'medium' : 'low',
      source: 'review-prep',
      why: 'Project intelligence has concrete read-first and validate-first guidance for the next bounded slice.',
      start_with: review.read_first || [],
      validate_with: review.validate_first || [],
      proof_boundary: 'Use this candidate to scope inspection and validation; it is not a substitute for a product decision.',
    });
  }

  if (items.length === 0) {
    const firstRunGuidance = intelligenceDraft.freshness && intelligenceDraft.freshness.failure_digest === 'not-applicable';
    addNextWorkItem(items, {
      title: firstRunGuidance ? 'Start first bounded project slice with fresh local guidance' : 'Select a small next slice and refresh project intelligence',
      priority: 'low',
      source: 'project-intelligence',
      why: firstRunGuidance
        ? 'This looks like a first-run project with no captured failure digest yet; start by orienting the project instead of chasing missing digest noise.'
        : 'No active readiness, risk, feedback, or hot-file signal is currently strong enough to suggest a specific local candidate.',
      start_with: firstRunGuidance
        ? ['forgeflow-first-run', 'forgeflow-code-map', 'scripts/forgeflow/build-project-intelligence.js --json']
        : ['scripts/forgeflow/build-project-intelligence.js --json'],
      validate_with: firstRunGuidance
        ? ['forgeflow-health', 'forgeflow-trends --refresh', 'focused tests for the selected slice']
        : ['focused tests for the selected slice', 'full validation before review'],
      what_to_change: firstRunGuidance
        ? 'Use the first-run path to verify install health, orient on the code map, then choose one small product-backed slice.'
        : undefined,
      how_to_prove: firstRunGuidance
        ? 'Confirm health and trends are current, then validate the selected slice with focused tests before review.'
        : undefined,
      stop_when: firstRunGuidance
        ? 'Stop if install health, project orientation, or product intent is unclear before implementation.'
        : undefined,
      proof_boundary: firstRunGuidance
        ? 'First-run guidance is an orientation path only; it does not prove the selected implementation is correct.'
        : 'This fallback is only a planning prompt; choose scope from current product and code evidence.',
    });
  }

  const { priority_rank: priorityRank, source_rank: sourceRank } = nextWorkRankingPolicy();
  return items
    .map((item, index) => ({ ...item, order: index }))
    .sort((a, b) => (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1)
      || (sourceRank[a.source] ?? 5) - (sourceRank[b.source] ?? 5)
      || (b.confidence ? b.confidence.score : 0) - (a.confidence ? a.confidence.score : 0)
      || a.order - b.order)
    .slice(0, 5)
    .map(({ dedupe_key: _dedupeKey, order: _order, ...item }) => item);
}

function buildProjectIntelligence(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  assertSafeDirectory(projectDir);
  const jsonOut = path.resolve(opts.out || defaultJsonOut(projectDir));
  const markdownOut = markdownOutFor(jsonOut);
  let learnings = null;
  let trends = null;
  if (opts.refresh) {
    trends = showProjectTrends({ root, projectDir, refresh: true });
    learnings = showProjectLearnings({ root, projectDir, refreshCodeMap: false, check: true });
  } else {
    learnings = showProjectLearnings({ root, projectDir, refreshCodeMap: true, check: true });
    trends = showProjectTrends({ root, projectDir, refresh: false });
  }
  const allRisks = collectRiskSignals(trends, learnings);
  const risks = allRisks.slice(0, 8);
  const learningGatePass = learnings.check && learnings.check.status === 'pass';
  const hotFiles = learningGatePass ? topItems(learnings.hot_files_and_modules, 8) : [];
  const recommendations = trends.recommendations || [];
  const agentFeedback = readAgentFeedback(projectDir);
  const reviewOutcomes = readReviewOutcomes(projectDir);
  const userProfile = compactUserProfile({ root, projectDir }, 2200);
  const nextWorkConfidence = readNextWorkOutcomes(projectDir);
  const readiness = readinessState(trends, learnings, allRisks, recommendations);
  const intelligence = {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    project_dir: projectDir,
    provenance: {
      git: gitProvenance(root),
    },
    trust_state: trustState(trends, learnings, allRisks),
    readiness,
    freshness: {
      project: trends.freshness ? trends.freshness.status : 'missing',
      latest_insights: trends.latest_insights && trends.latest_insights.freshness ? trends.latest_insights.freshness.status : 'missing',
      failure_digest: trends.failure_digest && trends.failure_digest.freshness ? trends.failure_digest.freshness.status : 'not-applicable',
    },
    guidance: {
      latest_insights_status: trends.latest_insights ? trends.latest_insights.status : 'missing',
      latest_insights_gate: trends.latest_insights ? trends.latest_insights.check_status || '' : '',
      project_learnings_gate: learnings.check ? learnings.check.status : 'missing',
      project_learnings_present: Boolean(learnings.out && fs.existsSync(learnings.out)),
      consumed_code_map_trend: Boolean(learnings.sources && learnings.sources.code_map_trend === 'compared'),
    },
    top_risks: risks,
    hot_files: hotFiles,
    recommended_next_actions: learningGatePass ? topItems(learnings.recommended_approach_for_next_work, 8) : [],
    validation_patterns: learningGatePass ? topItems(learnings.validation_patterns, 5) : [],
    agent_feedback: agentFeedback,
    review_outcomes: reviewOutcomes,
    next_work_confidence: nextWorkConfidence,
    user_profile: {
      status: userProfile.result.check.status,
      injected: userProfile.injected,
      issue_count: userProfile.result.check.issues.length,
      suggestion_count: userProfile.result.check.suggestions.length,
      conflict_count: userProfile.result.check.conflicts.length,
      records: userProfile.result.check.records,
      files: userProfile.result.files,
      guidance: userProfile.markdown,
    },
    recommendations,
    artifacts: {
      json: jsonOut,
      markdown: markdownOut,
      project_learnings: learnings.out || '',
      code_map_history: trends.paths ? trends.paths.code_map_history : null,
      code_topology: path.join(projectDir, 'context', 'code-topology.json'),
      failure_digest: trends.paths ? trends.paths.failure_digest : null,
      latest_insights_report: trends.paths ? trends.paths.latest_insights_report : null,
      user_profile: userProfile.result.files,
    },
  };
  intelligence.review_prep = reviewPrep(trends, intelligence);
  intelligence.next_work_brief = nextWorkBrief(intelligence);
  intelligence.next_work_items = nextWorkItems(intelligence);
  fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
  writeFileSafe(jsonOut, `${JSON.stringify(intelligence, null, 2)}\n`);
  writeFileSafe(markdownOut, renderMarkdown(intelligence));
  return intelligence;
}

function renderMarkdown(intelligence) {
  const lines = [
    '# Forgeflow Project Intelligence',
    '',
    `Generated at: ${intelligence.generated_at}`,
    `Trust state: ${intelligence.trust_state}`,
    `Readiness: ${intelligence.readiness ? intelligence.readiness.state : 'unknown'}`,
    `Git: ${intelligence.provenance.git.available ? `${intelligence.provenance.git.branch || '(detached)'} ${intelligence.provenance.git.commit_short || '(unknown)'}${intelligence.provenance.git.dirty_available ? (intelligence.provenance.git.dirty ? ' dirty' : ' clean') : ' dirty-state-not-checked'}` : '(unavailable)'}`,
    '',
    'This is a synthesis of local Forgeflow artifacts, not a source of truth. Verify decisions against the raw artifacts, current code, and current validation output.',
    '',
    '## Freshness',
    '',
    `- Project guidance: ${intelligence.freshness.project}`,
    `- Latest insights: ${intelligence.freshness.latest_insights}`,
    `- Failure digest: ${intelligence.freshness.failure_digest}`,
    '',
    '## Readiness',
    '',
    `- State: ${intelligence.readiness ? intelligence.readiness.state : 'unknown'}`,
    `- Reasons: ${intelligence.readiness && intelligence.readiness.reasons.length > 0 ? intelligence.readiness.reasons.join('; ') : '(none)'}`,
    `- Clearing commands: ${intelligence.readiness && intelligence.readiness.clearing_commands.length > 0 ? intelligence.readiness.clearing_commands.join('; ') : '(none)'}`,
    `- Evidence: project ${intelligence.readiness ? intelligence.readiness.evidence.project_freshness : 'unknown'}, latest-insights ${intelligence.readiness ? intelligence.readiness.evidence.latest_insights_freshness : 'unknown'}, failure-digest ${intelligence.readiness ? intelligence.readiness.evidence.failure_digest_freshness : 'unknown'}, learning-gate ${intelligence.readiness ? intelligence.readiness.evidence.project_learnings_gate : 'unknown'}, import-gaps ${intelligence.readiness ? intelligence.readiness.evidence.import_gaps : 'unknown'}, context-budget ${intelligence.readiness ? intelligence.readiness.evidence.context_budget : 'unknown'}`,
    '',
    '## Top Risks',
    '',
  ];
  if (intelligence.top_risks.length === 0) {
    lines.push('- (none)');
  } else {
    for (const risk of intelligence.top_risks) {
      lines.push(`- ${risk.severity}: ${risk.source} - ${risk.summary}`);
      if (risk.next_action) lines.push(`  - Next: ${risk.next_action}`);
    }
  }
  lines.push('', '## Hot Files', '', ...(intelligence.hot_files.length > 0 ? intelligence.hot_files.map((item) => `- ${item}`) : ['- (none)']));
  lines.push('', '## Review Prep', '');
  lines.push(`- Trust summary: ${intelligence.review_prep.trust_summary}`);
  lines.push('', '### Refresh First', '', ...(intelligence.review_prep.refresh_first.length > 0 ? intelligence.review_prep.refresh_first.map((item) => `- ${item}`) : ['- (none)']));
  lines.push('', '### Review Notes', '', ...(intelligence.review_prep.review_notes.length > 0 ? intelligence.review_prep.review_notes.map((item) => `- ${item}`) : ['- (none)']));
  lines.push('', '### Read First', '', ...(intelligence.review_prep.read_first.length > 0 ? intelligence.review_prep.read_first.map((item) => `- ${item}`) : ['- (none)']));
  lines.push('', '### Validate First', '', ...(intelligence.review_prep.validate_first.length > 0 ? intelligence.review_prep.validate_first.map((item) => `- ${item}`) : ['- (none)']));
  lines.push('', '## Next Work Brief', '');
  lines.push(`- State: ${intelligence.next_work_brief.state}`);
  lines.push('', '### Read First', '', ...(intelligence.next_work_brief.read_first.length > 0 ? intelligence.next_work_brief.read_first.map((item) => `- ${item}`) : ['- (none)']));
  lines.push('', '### Avoid First', '', ...(intelligence.next_work_brief.avoid_first.length > 0 ? intelligence.next_work_brief.avoid_first.map((item) => `- ${item}`) : ['- (none)']));
  lines.push('', '### Validate First', '', ...(intelligence.next_work_brief.validate_first.length > 0 ? intelligence.next_work_brief.validate_first.map((item) => `- ${item}`) : ['- (none)']));
  lines.push('', '### Proof Boundary', '', ...intelligence.next_work_brief.proof_boundary.map((item) => `- ${item}`));
  lines.push('', '## Next Work Items', '');
  if ((intelligence.next_work_items || []).length === 0) {
    lines.push('- (none)');
  } else {
    for (const item of intelligence.next_work_items) {
      lines.push(`- ${item.priority}: ${item.title}`);
      if (item.why) lines.push(`  - Why: ${item.why}`);
      lines.push(`  - Source: ${item.source}`);
      lines.push(`  - Evidence strength: ${item.evidence_strength || 'weak'}`);
      if (item.confidence) lines.push(`  - Confidence: ${item.confidence.band} (${item.confidence.score}) - ${item.confidence.reason_codes.join(', ') || 'none'}`);
      lines.push(`  - What to change: ${item.what_to_change || '(unspecified)'}`);
      lines.push(`  - Start with: ${item.start_with.length > 0 ? item.start_with.join('; ') : '(none)'}`);
      lines.push(`  - Validate with: ${item.validate_with.length > 0 ? item.validate_with.join('; ') : '(none)'}`);
      lines.push(`  - How to prove: ${item.how_to_prove || '(unspecified)'}`);
      lines.push(`  - Stop when: ${item.stop_when || '(unspecified)'}`);
      lines.push(`  - Boundary: ${item.proof_boundary}`);
    }
  }
  lines.push('', '## Recommended Next Actions', '', ...(intelligence.recommended_next_actions.length > 0 ? intelligence.recommended_next_actions.map((item) => `- ${item}`) : ['- (none)']));
  lines.push('', '## Validation Patterns', '', ...(intelligence.validation_patterns.length > 0 ? intelligence.validation_patterns.map((item) => `- ${item}`) : ['- (none)']));
  lines.push('', '## User Profile Guidance', '');
  lines.push(`- Status: ${intelligence.user_profile ? intelligence.user_profile.status : 'missing'}`);
  lines.push(`- Injected: ${intelligence.user_profile && intelligence.user_profile.injected ? 'yes' : 'no'}`);
  lines.push(`- Active records: ${intelligence.user_profile && intelligence.user_profile.records ? intelligence.user_profile.records.active : 0}`);
  if (intelligence.user_profile && intelligence.user_profile.guidance) {
    lines.push('', intelligence.user_profile.guidance.replace(/^# Forgeflow User Profile[^\n]*\s*/u, '').trim());
  }
  lines.push('', '## Next-Work Confidence', '');
  lines.push(`- Status: ${intelligence.next_work_confidence.status}`);
  lines.push(`- Records: ${intelligence.next_work_confidence.records}`);
  lines.push(`- Invalid lines skipped: ${intelligence.next_work_confidence.invalid_lines || 0}`);
  lines.push(`- Recommendation: ${intelligence.next_work_confidence.recommendation}`);
  lines.push('- Boundary: advisory only; use outcome history to calibrate recommendations, not to auto-select work.');
  const outcomeSummary = Object.entries(intelligence.next_work_confidence.by_outcome || {}).map(([outcome, count]) => `${outcome}: ${count}`).join(', ');
  lines.push(`- Outcomes: ${outcomeSummary || '(none)'}`);
  const sourceSummary = Object.entries(intelligence.next_work_confidence.by_source || {}).map(([source, count]) => `${source}: ${count}`).join(', ');
  lines.push(`- Sources: ${sourceSummary || '(none)'}`);
  lines.push('', '## Agent Feedback', '');
  lines.push(`- Status: ${intelligence.agent_feedback.status}`);
  lines.push(`- Records: ${intelligence.agent_feedback.records}`);
  lines.push(`- Promotable: ${intelligence.agent_feedback.promotable}`);
  lines.push(`- Invalid lines skipped: ${intelligence.agent_feedback.invalid_lines || 0}`);
  lines.push('- Boundary: advisory only; verify against current code, tests, and review artifacts before relying on feedback.');
  if (intelligence.agent_feedback.stale_markers) {
    lines.push(`- Staleness: ${intelligence.agent_feedback.stale_markers.status} (old records ${intelligence.agent_feedback.stale_markers.stale_records}, missing timestamps ${intelligence.agent_feedback.stale_markers.missing_timestamp_records})`);
  }
  const signalSummary = Object.entries(intelligence.agent_feedback.by_signal || {}).map(([signal, count]) => `${signal}: ${count}`).join(', ');
  lines.push(`- Signals: ${signalSummary || '(none)'}`);
  const agentSummary = Object.entries(intelligence.agent_feedback.by_agent || {}).map(([agent, count]) => `${agent}: ${count}`).join(', ');
  lines.push(`- Agents: ${agentSummary || '(none)'}`);
  if ((intelligence.agent_feedback.invalid_reasons || []).length > 0) {
    const skipped = intelligence.agent_feedback.invalid_reasons.map((item) => `line ${item.line} ${item.reason}`).join(', ');
    lines.push(`- Skipped detail: ${skipped}`);
  }
  if (intelligence.agent_feedback.latest.length > 0) {
    lines.push('', '### Latest Feedback', '');
    for (const item of intelligence.agent_feedback.latest) {
      lines.push(`- ${item.agent} ${item.signal}: ${item.summary} [confidence: ${item.confidence || 'unknown'}, evidence: ${item.evidence_count || 0}, advisory-only]`);
    }
  }
  lines.push('', '### Correction Themes', '');
  lines.push(...((intelligence.agent_feedback.correction_themes || []).length > 0
    ? intelligence.agent_feedback.correction_themes.map((item) => `- ${item.theme}: ${item.count} signal(s). ${item.manual_promotion}`)
    : ['- (none)']));
  lines.push('', '### Promotion Candidates', '');
  lines.push(...((intelligence.agent_feedback.promotion_candidates || []).length > 0
    ? intelligence.agent_feedback.promotion_candidates.map((item) => `- ${item.agent} ${item.signal}: ${item.summary} [confidence: ${item.confidence}, evidence: ${item.evidence_count}] ${item.manual_promotion}`)
    : ['- (none)']));
  lines.push('', '## Review Outcomes', '');
  lines.push(`- Status: ${intelligence.review_outcomes.status}`);
  lines.push(`- Records: ${intelligence.review_outcomes.records}`);
  lines.push(`- Invalid lines skipped: ${intelligence.review_outcomes.invalid_lines || 0}`);
  lines.push('- Boundary: aggregate local guidance only; verify every future finding against current code, tests, and review artifacts.');
  const learningSummary = Object.entries(intelligence.review_outcomes.learning_signals || {}).map(([signal, count]) => `${signal}: ${count}`).join(', ');
  lines.push(`- Learning signals: ${learningSummary || '(none)'}`);
  const totals = intelligence.review_outcomes.totals || {};
  lines.push(`- Findings: total ${totals.findings_total || 0}, confirmed ${totals.findings_confirmed || 0}, rejected ${totals.findings_rejected || 0}, regressions ${totals.post_merge_regression || 0}`);
  if ((intelligence.review_outcomes.top_classes || []).length > 0) {
    lines.push('', '### Repeated Finding Classes', '');
    for (const item of intelligence.review_outcomes.top_classes) {
      lines.push(`- ${item.name}: confirmed ${item.findings_confirmed || 0}, rejected ${item.findings_rejected || 0}, total ${item.findings_total || 0}`);
    }
  }
  if ((intelligence.review_outcomes.invalid_reasons || []).length > 0) {
    const skipped = intelligence.review_outcomes.invalid_reasons.map((item) => `line ${item.line} ${item.reason}`).join(', ');
    lines.push(`- Skipped detail: ${skipped}`);
  }
  lines.push('', '## Sources', '');
  lines.push(`- Project learnings: ${intelligence.artifacts.project_learnings || '(missing)'}`);
  lines.push(`- Code map history: ${intelligence.artifacts.code_map_history || '(missing)'}`);
  lines.push(`- Code topology: ${intelligence.artifacts.code_topology || '(missing)'}`);
  lines.push(`- Latest insights report: ${intelligence.artifacts.latest_insights_report || '(missing)'}`);
  if (intelligence.artifacts.user_profile) {
    lines.push(`- User operating profile: ${intelligence.artifacts.user_profile.global || '(missing)'}`);
    lines.push(`- Project experience profile: ${intelligence.artifacts.user_profile.project || '(missing)'}`);
  }
  lines.push(`- Failure digest: ${intelligence.artifacts.failure_digest || '(missing)'}`);
  lines.push(`- Agent feedback: ${intelligence.agent_feedback.file || '(missing)'}`);
  lines.push(`- Review outcomes: ${intelligence.review_outcomes.file || '(missing)'}`);
  lines.push('', '## Artifacts', '', `- JSON: ${intelligence.artifacts.json}`, `- Markdown: ${intelligence.artifacts.markdown}`);
  return `${lines.join('\n')}\n`;
}

function renderNextWorkView(intelligence) {
  const items = intelligence.next_work_items || [];
  const readiness = intelligence.readiness || {};
  const lines = [
    '# Forgeflow Next Work Items',
    '',
    `Generated at: ${intelligence.generated_at}`,
    `Readiness: ${readiness.state || 'unknown'}`,
    `Trust state: ${intelligence.trust_state || 'unknown'}`,
    '',
    'Advisory candidates only. Choose scope from current product intent, then verify against current code, focused tests, full validation, and review evidence.',
    '',
  ];
  if (readiness.state && readiness.state !== 'ready') {
    lines.push(`Readiness note: ${(readiness.reasons || [])[0] || `state is ${readiness.state}`}`);
    if ((readiness.clearing_commands || []).length > 0) {
      lines.push(`Clear first: ${readiness.clearing_commands.join('; ')}`);
    }
    lines.push('');
  }
  if (items.length === 0) {
    lines.push('No next-work candidates were generated.');
  } else {
    items.forEach((item, index) => {
      lines.push(`${index + 1}. [${item.priority || 'medium'}] ${item.title}`);
      if (item.source) lines.push(`   Source: ${item.source}`);
      lines.push(`   Evidence strength: ${item.evidence_strength || 'weak'}`);
      if (item.confidence) lines.push(`   Confidence: ${item.confidence.band} (${item.confidence.score}) - ${item.confidence.reason_codes.join(', ') || 'none'}`);
      if (item.why) lines.push(`   Why: ${item.why}`);
      lines.push(`   What to change: ${item.what_to_change || '(unspecified)'}`);
      lines.push(`   Start with: ${(item.start_with || []).length > 0 ? item.start_with.join('; ') : '(none)'}`);
      lines.push(`   Validate with: ${(item.validate_with || []).length > 0 ? item.validate_with.join('; ') : '(none)'}`);
      lines.push(`   How to prove: ${item.how_to_prove || '(unspecified)'}`);
      lines.push(`   Stop when: ${item.stop_when || '(unspecified)'}`);
      lines.push(`   Boundary: ${item.proof_boundary || 'Advisory candidate only.'}`);
      lines.push('');
    });
  }
  lines.push(`Artifacts: ${intelligence.artifacts ? intelligence.artifacts.json : '(missing)'}`);
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
}

function suggestedReviewLanes(item, brief) {
  const text = [
    item.title,
    item.source,
    item.why,
    ...(item.start_with || []),
    ...(item.validate_with || []),
    ...(brief.read_first || []),
    ...(brief.validate_first || []),
  ].join(' ').toLowerCase();
  const lanes = [];
  if (/(auth|permission|security|secret|token|session|runtime|install|update|repair|support)/.test(text)) {
    lanes.push('Warden: security, runtime, install, and integration boundaries.');
  }
  if (/(schema|database|db|migration|backend|service|helper|contract|artifact|json)/.test(text)) {
    lanes.push('Smith: helper structure, data contracts, backend/craft quality.');
  }
  if (/(ui|ux|frontend|accessibility|screen|display|markdown|docs|copy)/.test(text)) {
    lanes.push('Lumen: user-facing output, documentation clarity, accessibility.');
  }
  if (/(readiness|project-intelligence|review-outcomes|agent-feedback|learning|pilot|coordination|handoff|scope)/.test(text)) {
    lanes.push('Atlas: scope, sequencing, memory, and handoff completeness.');
  }
  lanes.push('Compass: requirements coverage, validation evidence, and proof boundary.');
  return lanes.filter((value, index, list) => list.indexOf(value) === index);
}

function implementationNotesSeeds(item) {
  return [
    `decision: Confirmed scope for "${item.title}" before editing.`,
    'tradeoff: Record the lean decision, chosen minimum path, known ceiling, and upgrade trigger if a smaller path is used.',
    'spec-gap: Record any product or acceptance-criteria gap discovered during implementation.',
    'tradeoff: Record why the chosen slice stayed bounded and what was deferred.',
    'validation: Record focused tests, full validation, and review result.',
    'follow-up: Record any remaining advisory signal that was not safe to resolve in this slice.',
  ];
}

function leanDecisionText(item, brief) {
  return [
    item.title,
    item.what_to_change,
    item.how_to_prove,
    item.stop_when,
    ...(item.start_with || []),
    ...(item.validate_with || []),
    ...(brief.read_first || []),
    ...(brief.avoid_first || []),
    ...(brief.validate_first || []),
  ].filter(Boolean).join('\n');
}

function renderImplementationBriefStub(intelligence, index = 1) {
  const items = intelligence.next_work_items || [];
  const item = items[index - 1] || null;
  const brief = intelligence.next_work_brief || {};
  const lines = [
    '# Forgeflow Implementation Brief Stub',
    '',
    `Generated at: ${intelligence.generated_at}`,
    `Candidate index: ${index}`,
    `Readiness: ${(intelligence.readiness || {}).state || 'unknown'}`,
    '',
    'This is an advisory stub from project intelligence. Confirm product intent, inspect current code, run focused validation, run full validation, and require review before treating work as complete.',
    '',
  ];
  if (!item) {
    lines.push('No next-work candidate exists at this index.');
    lines.push(`Available candidates: ${items.length}`);
    return `${lines.join('\n')}\n`;
  }
  const lanes = suggestedReviewLanes(item, brief);
  const noteSeeds = implementationNotesSeeds(item);
  lines.push('## Candidate', '');
  lines.push(`- Title: ${item.title}`);
  lines.push(`- Priority: ${item.priority || 'medium'}`);
  lines.push(`- Source: ${item.source || 'project-intelligence'}`);
  if (item.why) lines.push(`- Why: ${item.why}`);
  lines.push(`- Evidence strength: ${item.evidence_strength || 'weak'}`);
  if (item.confidence) lines.push(`- Confidence: ${item.confidence.band} (${item.confidence.score}) - ${item.confidence.reason_codes.join(', ') || 'none'}`);
  lines.push(`- What to change: ${item.what_to_change || 'Inspect current evidence and choose the smallest bounded change it supports.'}`);
  lines.push(`- How to prove: ${item.how_to_prove || 'Run focused validation, full validation, and review before treating the work as complete.'}`);
  lines.push(`- Stop when: ${item.stop_when || 'Stop when evidence contradicts the candidate or product judgment is needed.'}`);
  lines.push('', '## Scope To Confirm', '');
  lines.push('- Confirm the requested product outcome and exact acceptance criteria before editing.');
  lines.push('- Keep the first implementation slice bounded to the candidate above unless current evidence requires a smaller prerequisite.');
  lines.push('- Do not treat this generated stub as user approval for broad refactors or speculative features.');
  const leanDecision = buildLeanDecision({
    root: path.dirname(path.dirname(intelligence.project_dir || process.cwd())),
    projectDir: intelligence.project_dir,
    text: leanDecisionText(item, brief),
  });
  lines.push('', renderLeanBriefSection(leanDecision).trim());
  lines.push('', '## Start With', '');
  const startWith = [
    ...(item.start_with || []),
    ...(brief.read_first || []),
  ].filter(Boolean).filter((value, itemIndex, list) => list.indexOf(value) === itemIndex).slice(0, 10);
  lines.push(...(startWith.length > 0 ? startWith.map((value) => `- ${value}`) : ['- Inspect the current task surface and relevant files before editing.']));
  lines.push('', '## Avoid First', '');
  lines.push(...((brief.avoid_first || []).length > 0 ? brief.avoid_first.map((value) => `- ${value}`) : ['- Do not skip current code and validation evidence.']));
  lines.push('', '## Validate With', '');
  const validateWith = [
    ...(item.validate_with || []),
    ...(brief.validate_first || []),
  ].filter(Boolean).filter((value, itemIndex, list) => list.indexOf(value) === itemIndex).slice(0, 10);
  lines.push(...(validateWith.length > 0 ? validateWith.map((value) => `- ${value}`) : ['- Add focused validation for the selected slice, then run full validation before review.']));
  lines.push('', '## Suggested Review Lanes', '');
  lines.push(...lanes.map((value) => `- ${value}`));
  lines.push('', '## Implementation Notes Seed', '');
  lines.push(...noteSeeds.map((value) => `- ${value}`));
  lines.push('', '## Handoff Checklist', '');
  lines.push('- Re-read every edited file before review.');
  lines.push('- Run focused validation, then full validation.');
  lines.push('- Update local implementation notes with decisions, gaps, tradeoffs, validation, and follow-ups.');
  lines.push('- Require review approval before treating the work as complete.');
  lines.push('', '## Proof Boundary', '');
  lines.push(`- ${item.proof_boundary || 'Advisory candidate only; verify against current code, tests, and review output.'}`);
  for (const boundary of brief.proof_boundary || []) {
    lines.push(`- ${boundary}`);
  }
  lines.push('', '## Artifacts', '');
  lines.push(`- Project intelligence JSON: ${intelligence.artifacts ? intelligence.artifacts.json : '(missing)'}`);
  lines.push(`- Project intelligence Markdown: ${intelligence.artifacts ? intelligence.artifacts.markdown : '(missing)'}`);
  return `${lines.join('\n')}\n`;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildProjectIntelligence(opts);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (opts.nextWork) {
    process.stdout.write(renderNextWorkView(result));
  } else if (opts.briefIndex) {
    process.stdout.write(renderImplementationBriefStub(result, opts.briefIndex));
  } else {
    process.stdout.write(renderMarkdown(result));
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = {
  buildProjectIntelligence,
  collectRiskSignals,
  readAgentFeedback,
  readReviewOutcomes,
  parseArgs,
  nextWorkBrief,
  nextWorkItems,
  nextWorkRankingPolicy,
  reviewPrep,
  readinessState,
  renderMarkdown,
  renderImplementationBriefStub,
  renderNextWorkView,
  riskSignals,
  trustState,
};
