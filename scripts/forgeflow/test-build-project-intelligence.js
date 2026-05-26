#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildProjectIntelligence,
  collectRiskSignals,
  parseArgs,
  readinessState,
  renderMarkdown,
  reviewPrep,
  riskSignals,
  trustState,
} = require('./build-project-intelligence');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-project-intelligence-'));
const projectDir = path.join(root, '.forgeflow', path.basename(root));
const contextDir = path.join(projectDir, 'context');
fs.mkdirSync(contextDir, { recursive: true });
fs.mkdirSync(path.join(root, 'src'), { recursive: true });
fs.writeFileSync(path.join(root, 'src', 'app.ts'), "import './missing';\nexport const value = 1;\n");
fs.writeFileSync(path.join(projectDir, 'project-learning-candidates.jsonl'), [
  JSON.stringify({
    category: 'risk-area',
    learning: 'Auth changes repeatedly need session boundary checks.',
    confidence: 'medium',
    evidence_count: 2,
  }),
  JSON.stringify({
    category: 'hot-file',
    learning: 'src/auth/session.ts',
    confidence: 'medium',
    evidence_count: 2,
  }),
  JSON.stringify({
    category: 'validation-pattern',
    learning: 'Run auth regression tests before review.',
    confidence: 'medium',
    evidence_count: 2,
  }),
  JSON.stringify({
    category: 'recommended-approach',
    learning: 'Start auth work by reading session helpers.',
    confidence: 'medium',
    evidence_count: 2,
  }),
].join('\n'));
fs.writeFileSync(path.join(projectDir, 'agent-feedback.jsonl'), [
  JSON.stringify({
    schema_version: '1',
    agent: 'smith_reviewer',
    signal: 'incorrect',
    summary: 'Flagged a safe query as unsafe',
    confidence: 'high',
    evidence_count: 2,
  }),
  JSON.stringify({
    schema_version: '1',
    agent: 'warden_reviewer',
    signal: 'useful',
    summary: 'Caught missing permission check',
    confidence: 'medium',
    evidence_count: 1,
  }),
  '{not-json',
  '"not-an-object"',
  '42',
  JSON.stringify({
    schema_version: '1',
    agent: 'warden_reviewer',
    signal: 'incorrect',
    summary: 'Review https://example.internal/team before approving',
    confidence: 'high',
    evidence_count: 2,
  }),
].join('\n'));
fs.writeFileSync(path.join(contextDir, 'code-map-history.jsonl'), `${JSON.stringify({
  generated_at: '2026-05-21T00:00:00Z',
  commit_short: 'aaaaaaa',
  dirty: false,
  summary: {
    source_files: 1,
    local_edges: 1,
    unresolved_imports: 0,
    skipped_dynamic_imports: 0,
    changed_sections: 0,
  },
  high_fan_in: [],
  high_fan_out: [],
})}\n${JSON.stringify({
  generated_at: '2026-05-22T00:00:00Z',
  commit_short: 'bbbbbbb',
  dirty: false,
  summary: {
    source_files: 1,
    local_edges: 1,
    unresolved_imports: 1,
    skipped_dynamic_imports: 0,
    changed_sections: 1,
  },
  high_fan_in: [{ path: 'src/auth/session.ts', fan_in: 3 }],
  high_fan_out: [],
})}\n`);
fs.writeFileSync(path.join(contextDir, 'code-topology.json'), JSON.stringify({
  schema_version: '1',
  unresolved: [{ source: 'src/auth/session.ts', specifier: './missing', scope: 'production' }],
  skipped_dynamic: [],
}, null, 2));

const previousCwd = process.cwd();
process.chdir(root);
const result = buildProjectIntelligence({ root, projectDir });
process.chdir(previousCwd);
const markdown = renderMarkdown(result);
const latestReportPath = path.join(projectDir, 'context', 'latest', 'latest-insights-report.json');
const latestReport = fs.existsSync(latestReportPath) ? JSON.parse(fs.readFileSync(latestReportPath, 'utf8')) : null;
const customOut = path.join(projectDir, 'context', 'custom-rollup');
const custom = buildProjectIntelligence({ root, projectDir, out: customOut });
const historyBeforeRefresh = fs.readFileSync(path.join(contextDir, 'code-map-history.jsonl'), 'utf8').trim().split(/\r?\n/).filter(Boolean).length;
buildProjectIntelligence({ root, projectDir, out: path.join(projectDir, 'context', 'refresh-rollup.json'), refresh: true });
const historyAfterRefresh = fs.readFileSync(path.join(contextDir, 'code-map-history.jsonl'), 'utf8').trim().split(/\r?\n/).filter(Boolean).length;
const cliJson = buildProjectIntelligence(parseArgs([
  '--root',
  root,
  '--project-dir',
  projectDir,
  '--json',
], { exitOnError: false }));
const syntheticRisks = riskSignals({
  freshness: { issues: [{ message: 'Project freshness stale.' }] },
  latest_insights: { freshness: { issues: [] } },
  failure_digest: { freshness: { issues: [] }, triage: { state: 'usable' } },
  import_gaps: { status: 'attention', production_total: 2 },
  advisor: { recommendations: [{ severity: 'warn', reason: 'Budget is over.', command: 'split scope' }] },
}, {
  check: { status: 'pass' },
  risk_areas: ['- Risk from learnings'],
});
const blockedLearningRisks = riskSignals({
  freshness: { issues: Array.from({ length: 8 }, (_, index) => ({ message: `Freshness issue ${index + 1}` })) },
  latest_insights: { freshness: { issues: [{ message: 'Latest insights stale.' }] } },
  failure_digest: { freshness: { issues: [] }, triage: { state: 'usable' } },
  import_gaps: { status: 'clear', production_total: 0 },
  advisor: { recommendations: [] },
}, {
  check: { status: 'fail' },
  risk_areas: ['- Should not be trusted while gate is failing'],
});
const allBlockedLearningRisks = collectRiskSignals({
  freshness: { issues: Array.from({ length: 12 }, (_, index) => ({ message: `Freshness issue ${index + 1}` })) },
  latest_insights: { freshness: { issues: [{ message: 'Latest insights stale.' }] } },
  failure_digest: { freshness: { issues: [] }, triage: { state: 'usable' } },
  import_gaps: { status: 'clear', production_total: 0 },
  advisor: { recommendations: [] },
}, {
  check: { status: 'fail' },
  risk_areas: [],
});
const longRiskList = [
  ...Array.from({ length: 9 }, (_, index) => ({
    severity: 'attention',
    source: 'synthetic',
    summary: `Attention risk ${index + 1}`,
    next_action: '',
  })),
  {
    severity: 'high',
    source: 'synthetic',
    summary: 'High risk after display cap',
    next_action: 'fix-high-risk',
  },
];
const truncatedLongRiskList = longRiskList.slice(0, 8);
const syntheticPrep = reviewPrep({
  code_map: {
    new_high_fan_in: ['src/auth/session.ts'],
    new_high_fan_out: ['src/auth/index.ts'],
  },
}, {
  trust_state: 'attention',
  freshness: { project: 'attention', latest_insights: 'current' },
  top_risks: [{ next_action: 'forgeflow-trends --refresh' }],
  recommendations: [
    { command: 'forgeflow-code-map' },
    { command: 'Split scope before review.' },
  ],
  agent_feedback: {
    file: path.join(projectDir, 'agent-feedback.jsonl'),
    by_signal: { incorrect: 1, unclear: 1 },
    promotable: 1,
  },
  hot_files: ['src/auth/session.ts'],
  validation_patterns: ['Run auth regression tests before review.'],
});
const readyState = readinessState({
  freshness: { status: 'current' },
  latest_insights: { check_status: 'pass', freshness: { status: 'current' } },
  failure_digest: { freshness: { status: 'current' } },
  import_gaps: { status: 'clear' },
  advisor: { budget_status: 'pass' },
}, { check: { status: 'pass' } }, [], []);
const needsRefreshState = readinessState({
  freshness: { status: 'attention' },
  latest_insights: { check_status: 'pass', freshness: { status: 'current' } },
  failure_digest: { freshness: { status: 'not-applicable' } },
  import_gaps: { status: 'clear' },
  advisor: { budget_status: 'pass' },
}, { check: { status: 'pass' } }, [], []);
const needsTriageState = readinessState({
  freshness: { status: 'current' },
  latest_insights: { check_status: 'pass', freshness: { status: 'current' } },
  failure_digest: { freshness: { status: 'current' } },
  import_gaps: { status: 'attention', production_total: 2 },
  advisor: { budget_status: 'pass' },
}, { check: { status: 'pass' } }, [], []);
const blockedState = readinessState({
  freshness: { status: 'current' },
  latest_insights: { check_status: 'fail', freshness: { status: 'current' } },
  failure_digest: { freshness: { status: 'current' } },
  import_gaps: { status: 'clear' },
  advisor: { budget_status: 'pass' },
}, { check: { status: 'pass' } }, [], []);
const warnLatestInsightsState = readinessState({
  freshness: { status: 'current' },
  latest_insights: { check_status: 'warn', freshness: { status: 'current' } },
  failure_digest: { freshness: { status: 'current' } },
  import_gaps: { status: 'clear' },
  advisor: { budget_status: 'pass' },
}, { check: { status: 'pass' } }, [], []);
const fullRiskReadinessState = readinessState({
  freshness: { status: 'current' },
  latest_insights: { check_status: 'pass', freshness: { status: 'current' } },
  failure_digest: { freshness: { status: 'current' } },
  import_gaps: { status: 'clear' },
  advisor: { budget_status: 'pass' },
}, { check: { status: 'pass' } }, longRiskList, []);
const budgetTriageState = readinessState({
  freshness: { status: 'current' },
  latest_insights: { check_status: 'pass', freshness: { status: 'current' } },
  failure_digest: { freshness: { status: 'current' } },
  import_gaps: { status: 'clear' },
  advisor: { budget_status: 'warn' },
}, { check: { status: 'pass' } }, [], []);
const checkoutResult = buildProjectIntelligence({
  root: path.resolve(__dirname, '..', '..'),
  projectDir,
  out: path.join(projectDir, 'context', 'checkout-provenance.json'),
});

const checks = [
  ['schema version', result.schema_version === '1'],
  ['writes json artifact', fs.existsSync(result.artifacts.json)],
  ['writes markdown artifact', fs.existsSync(result.artifacts.markdown)],
  ['trust state attention with nonblocking risks', result.trust_state === 'attention'],
  ['includes readiness object', result.readiness && result.readiness.state === 'needs-triage' && result.readiness.evidence && result.readiness.clearing_commands.includes('forgeflow-code-map')],
  ['includes git provenance', result.provenance && result.provenance.git && result.provenance.git.available === false],
  ['includes checkout git provenance', checkoutResult.provenance.git.available === true && checkoutResult.provenance.git.branch && checkoutResult.provenance.git.commit_short && checkoutResult.provenance.git.dirty_available === false],
  ['includes freshness summary', result.freshness.project && result.freshness.latest_insights],
  ['includes learning gate status', result.guidance.project_learnings_gate],
  ['latest insights read after learning check refresh', latestReport && result.artifacts.latest_insights_report && result.artifacts.latest_insights_report.endsWith('latest-insights-report.json') && result.guidance.latest_insights_status === latestReport.status],
  ['includes project learning risk', result.top_risks.some((item) => item.source === 'project-learnings')],
  ['project learning risk uses readable label', result.top_risks.some((item) => item.source === 'project-learnings' && !item.summary.includes('{'))],
  ['includes import gap risk', result.top_risks.some((item) => item.source === 'import-gaps') && syntheticRisks.some((item) => item.source === 'import-gaps')],
  ['includes hot file', result.hot_files.some((item) => item.includes('src/auth/session.ts'))],
  ['includes next action', result.recommended_next_actions.length > 0],
  ['includes agent feedback summary', result.agent_feedback.status === 'present' && result.agent_feedback.records === 2 && result.agent_feedback.invalid_lines === 4 && result.agent_feedback.by_signal.incorrect === 1 && !result.agent_feedback.by_signal.undefined && result.agent_feedback.by_agent.warden_reviewer === 1 && result.agent_feedback.promotable === 1 && result.agent_feedback.latest.some((item) => item.agent === 'smith_reviewer')],
  ['includes review prep', result.review_prep && result.review_prep.trust_summary && result.review_prep.refresh_first.length > 0 && result.review_prep.read_first.length > 0 && result.review_prep.validate_first.length > 0],
  ['review prep includes feedback notes', result.review_prep.review_notes.some((item) => item.includes('corrective agent-feedback') && item.includes('Advisory only')) && result.review_prep.review_notes.some((item) => item.includes('promotable')) && result.review_prep.review_notes.some((item) => item.includes('agent-feedback line(s) were skipped')) && result.review_prep.review_notes.some((item) => item.includes('Flagged a safe query as unsafe') && item.includes('confidence: high') && item.includes('evidence: 2'))],
  ['markdown renders sections', markdown.includes('# Forgeflow Project Intelligence') && markdown.includes('not a source of truth') && markdown.includes('## Readiness') && markdown.includes('- State:') && markdown.includes('Clearing commands:') && markdown.includes('## Top Risks') && markdown.includes('## Review Prep') && markdown.includes('### Refresh First') && markdown.includes('### Review Notes') && markdown.includes('### Read First') && markdown.includes('## Agent Feedback') && markdown.includes('advisory only') && markdown.includes('confidence: high') && markdown.includes('evidence: 2') && markdown.includes('Invalid lines skipped: 4') && markdown.includes('Agents: smith_reviewer: 1, warden_reviewer: 1') && markdown.includes('privacy-boundary') && markdown.includes('invalid-schema') && !markdown.includes('example.internal') && markdown.includes('## Sources') && markdown.includes('Project learnings:') && markdown.includes('Agent feedback:') && markdown.includes('Code map history:') && markdown.includes('## Artifacts')],
  ['cli json works', cliJson.schema_version === '1' && cliJson.artifacts.json.endsWith('project-intelligence-rollup.json')],
  ['custom out does not collide', custom.artifacts.json === customOut && custom.artifacts.markdown === `${customOut}.md` && fs.existsSync(custom.artifacts.json) && fs.existsSync(custom.artifacts.markdown)],
  ['refresh records one code-map snapshot', historyAfterRefresh === historyBeforeRefresh + 1],
  ['risk synthesis combines sources', syntheticRisks.length >= 4 && syntheticRisks.some((item) => item.source === 'context-advisor')],
  ['risk synthesis keeps current risks when learning gate fails', blockedLearningRisks[0].next_action === 'forgeflow-learnings --project --check' && blockedLearningRisks.some((item) => item.source === 'project-freshness') && !blockedLearningRisks.some((item) => item.summary.includes('Should not be trusted'))],
  ['readiness uses uncapped risks', longRiskList.length > truncatedLongRiskList.length && truncatedLongRiskList.every((item) => item.severity !== 'high') && fullRiskReadinessState.state === 'blocked' && fullRiskReadinessState.reasons.some((item) => item.includes('High risk after display cap'))],
  ['review prep dedupes and combines priorities', syntheticPrep.read_first.filter((item) => item === 'src/auth/session.ts').length === 1 && syntheticPrep.refresh_first.includes('forgeflow-trends --refresh') && syntheticPrep.refresh_first.includes('forgeflow-code-map') && !syntheticPrep.refresh_first.includes('Split scope before review.') && syntheticPrep.review_notes.includes('Split scope before review.') && syntheticPrep.review_notes.some((item) => item.includes('corrective agent-feedback')) && syntheticPrep.validate_first.includes('Run auth regression tests before review.')],
  ['readiness states classify signals', readyState.state === 'ready' && needsRefreshState.state === 'needs-refresh' && needsRefreshState.clearing_commands.includes('forgeflow-trends --refresh') && needsTriageState.state === 'needs-triage' && needsTriageState.clearing_commands.includes('forgeflow-code-map') && budgetTriageState.state === 'needs-triage' && budgetTriageState.evidence.context_budget === 'warn' && blockedState.state === 'blocked' && warnLatestInsightsState.state === 'blocked' && warnLatestInsightsState.clearing_commands.includes('forgeflow-trends --refresh') && blockedState.clearing_commands.includes('forgeflow-trends --refresh')],
  ['trust current when clean', trustState({ latest_insights: { status: 'injected', check_status: 'pass', freshness: { status: 'current' } }, freshness: { status: 'current' } }, { check: { status: 'pass' } }, []) === 'current'],
  ['trust blocked on failed gate', trustState({ latest_insights: { status: 'injected', check_status: 'fail', freshness: { status: 'current' } }, freshness: { status: 'current' } }, { check: { status: 'pass' } }, []) === 'blocked'],
  ['trust attention without learning check', trustState({ latest_insights: { status: 'injected', check_status: 'pass', freshness: { status: 'current' } }, freshness: { status: 'current' } }, {}, []) === 'attention'],
  ['readiness and trust blocked parity', trustState({ latest_insights: { status: 'injected', check_status: 'pass', freshness: { status: 'current' } }, freshness: { status: 'current' } }, { check: { status: 'pass' } }, longRiskList) === 'blocked' && fullRiskReadinessState.state === 'blocked'],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('project intelligence: ok');
