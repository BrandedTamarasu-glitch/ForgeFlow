#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { assertSafeDirectory, safeReadTextFile, writeFileSafe } = require('./file-safety');
const { containsProhibitedFeedbackContent, rollupFeedback } = require('./record-agent-feedback');
const { correctionThemes, promotionCandidates, staleMarkers } = require('./rollup-agent-feedback');
const { showProjectLearnings } = require('./show-project-learnings');
const { showProjectTrends } = require('./show-project-trends');
const VALID_FEEDBACK_SIGNALS = new Set(['useful', 'unclear', 'ignored', 'incorrect']);
const VALID_FEEDBACK_CONFIDENCE = new Set(['low', 'medium', 'high']);

function usage() {
  console.error('Usage: build-project-intelligence.js [--root <dir>] [--project-dir <dir>] [--out <path>] [--json]');
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
  for (const issue of (trends.failure_digest && trends.failure_digest.freshness && trends.failure_digest.freshness.issues) || []) {
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
  if (digest.triage && digest.triage.state && !['usable', 'missing'].includes(digest.triage.state)) {
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
  return {
    trust_summary: `Trust state is ${intelligenceDraft.trust_state}; project freshness ${intelligenceDraft.freshness.project}; latest insights ${intelligenceDraft.freshness.latest_insights}.`,
    refresh_first: refreshFirst,
    review_notes: [
      ...nextActions.filter((item) => !looksRunnable(item)),
      ...feedbackNotes,
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

function addNextWorkItem(items, item) {
  if (!item || !item.title) return;
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
    proof_boundary: item.proof_boundary || 'Advisory candidate only; verify against current code, tests, and review output before treating it as work complete.',
  });
}

function nextWorkItems(intelligenceDraft) {
  const items = [];
  const readiness = intelligenceDraft.readiness || {};
  const review = intelligenceDraft.review_prep || {};
  const feedback = intelligenceDraft.agent_feedback || {};
  const corrective = feedback.by_signal
    ? (feedback.by_signal.incorrect || 0) + (feedback.by_signal.unclear || 0) + (feedback.by_signal.ignored || 0)
    : 0;

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

  for (const risk of (intelligenceDraft.top_risks || []).slice(0, 3)) {
    addNextWorkItem(items, {
      title: `Triage ${risk.source} signal`,
      priority: priorityForSeverity(risk.severity),
      source: risk.source,
      why: risk.summary,
      start_with: [risk.next_action].filter(Boolean),
      validate_with: review.refresh_first || [],
      proof_boundary: 'A triaged signal is not a bug fix by itself; verify the raw artifact and current project behavior.',
    });
  }

  if (corrective > 0) {
    addNextWorkItem(items, {
      title: 'Review corrective agent feedback before reusing guidance',
      priority: 'medium',
      source: 'agent-feedback',
      why: `${corrective} corrective feedback signal(s) may change how agents should interpret similar work.`,
      start_with: [feedback.file || 'agent-feedback.jsonl', ...(review.review_notes || []).filter((item) => item.includes('corrective agent-feedback')).slice(0, 1)],
      validate_with: ['scripts/forgeflow/build-project-intelligence.js --json'],
      proof_boundary: 'Feedback is advisory only and must be promoted manually only after current-code verification.',
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
    addNextWorkItem(items, {
      title: 'Select a small next slice and refresh project intelligence',
      priority: 'low',
      source: 'project-intelligence',
      why: 'No active readiness, risk, feedback, or hot-file signal is currently strong enough to suggest a specific local candidate.',
      start_with: ['scripts/forgeflow/build-project-intelligence.js --json'],
      validate_with: ['focused tests for the selected slice', 'full validation before review'],
      proof_boundary: 'This fallback is only a planning prompt; choose scope from current product and code evidence.',
    });
  }

  return items.slice(0, 5).map(({ dedupe_key: _dedupeKey, ...item }) => item);
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
    recommendations,
    artifacts: {
      json: jsonOut,
      markdown: markdownOut,
      project_learnings: learnings.out || '',
      code_map_history: trends.paths ? trends.paths.code_map_history : null,
      code_topology: path.join(projectDir, 'context', 'code-topology.json'),
      failure_digest: trends.paths ? trends.paths.failure_digest : null,
      latest_insights_report: trends.paths ? trends.paths.latest_insights_report : null,
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
      lines.push(`  - Start with: ${item.start_with.length > 0 ? item.start_with.join('; ') : '(none)'}`);
      lines.push(`  - Validate with: ${item.validate_with.length > 0 ? item.validate_with.join('; ') : '(none)'}`);
      lines.push(`  - Boundary: ${item.proof_boundary}`);
    }
  }
  lines.push('', '## Recommended Next Actions', '', ...(intelligence.recommended_next_actions.length > 0 ? intelligence.recommended_next_actions.map((item) => `- ${item}`) : ['- (none)']));
  lines.push('', '## Validation Patterns', '', ...(intelligence.validation_patterns.length > 0 ? intelligence.validation_patterns.map((item) => `- ${item}`) : ['- (none)']));
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
  lines.push('', '## Sources', '');
  lines.push(`- Project learnings: ${intelligence.artifacts.project_learnings || '(missing)'}`);
  lines.push(`- Code map history: ${intelligence.artifacts.code_map_history || '(missing)'}`);
  lines.push(`- Code topology: ${intelligence.artifacts.code_topology || '(missing)'}`);
  lines.push(`- Latest insights report: ${intelligence.artifacts.latest_insights_report || '(missing)'}`);
  lines.push(`- Failure digest: ${intelligence.artifacts.failure_digest || '(missing)'}`);
  lines.push(`- Agent feedback: ${intelligence.agent_feedback.file || '(missing)'}`);
  lines.push('', '## Artifacts', '', `- JSON: ${intelligence.artifacts.json}`, `- Markdown: ${intelligence.artifacts.markdown}`);
  return `${lines.join('\n')}\n`;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildProjectIntelligence(opts);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
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
  parseArgs,
  nextWorkBrief,
  nextWorkItems,
  reviewPrep,
  readinessState,
  renderMarkdown,
  riskSignals,
  trustState,
};
