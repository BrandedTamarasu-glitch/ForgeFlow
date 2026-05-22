#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildProjectIntelligence,
  parseArgs,
  renderMarkdown,
  reviewPrep,
  riskSignals,
  trustState,
} = require('./build-project-intelligence');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-project-intelligence-'));
const projectDir = path.join(root, '.forgeflow', path.basename(root));
const contextDir = path.join(projectDir, 'context');
fs.mkdirSync(contextDir, { recursive: true });
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
  hot_files: ['src/auth/session.ts'],
  validation_patterns: ['Run auth regression tests before review.'],
});
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
  ['includes git provenance', result.provenance && result.provenance.git && result.provenance.git.available === false],
  ['includes checkout git provenance', checkoutResult.provenance.git.available === true && checkoutResult.provenance.git.branch && checkoutResult.provenance.git.commit_short && checkoutResult.provenance.git.dirty_available === false],
  ['includes freshness summary', result.freshness.project && result.freshness.latest_insights],
  ['includes learning gate status', result.guidance.project_learnings_gate],
  ['latest insights read after learning check refresh', latestReport && result.artifacts.latest_insights_report && result.artifacts.latest_insights_report.endsWith('latest-insights-report.json') && result.guidance.latest_insights_status === latestReport.status],
  ['includes project learning risk', result.top_risks.some((item) => item.source === 'project-learnings')],
  ['project learning risk uses readable label', result.top_risks.some((item) => item.source === 'project-learnings' && !item.summary.includes('{'))],
  ['includes import gap risk', result.top_risks.some((item) => item.source === 'import-gaps')],
  ['includes hot file', result.hot_files.some((item) => item.includes('src/auth/session.ts'))],
  ['includes next action', result.recommended_next_actions.length > 0],
  ['includes review prep', result.review_prep && result.review_prep.trust_summary && result.review_prep.refresh_first.length > 0 && result.review_prep.read_first.length > 0 && result.review_prep.validate_first.length > 0],
  ['markdown renders sections', markdown.includes('# Forgeflow Project Intelligence') && markdown.includes('not a source of truth') && markdown.includes('## Top Risks') && markdown.includes('## Review Prep') && markdown.includes('### Refresh First') && markdown.includes('### Review Notes') && markdown.includes('### Read First') && markdown.includes('## Sources') && markdown.includes('Project learnings:') && markdown.includes('Code map history:') && markdown.includes('## Artifacts')],
  ['cli json works', cliJson.schema_version === '1' && cliJson.artifacts.json.endsWith('project-intelligence-rollup.json')],
  ['custom out does not collide', custom.artifacts.json === customOut && custom.artifacts.markdown === `${customOut}.md` && fs.existsSync(custom.artifacts.json) && fs.existsSync(custom.artifacts.markdown)],
  ['risk synthesis combines sources', syntheticRisks.length >= 4 && syntheticRisks.some((item) => item.source === 'context-advisor')],
  ['risk synthesis blocks failed learning gate', blockedLearningRisks.length === 1 && blockedLearningRisks[0].next_action === 'forgeflow-learnings --project --check' && !blockedLearningRisks[0].summary.includes('Should not be trusted')],
  ['review prep dedupes and combines priorities', syntheticPrep.read_first.filter((item) => item === 'src/auth/session.ts').length === 1 && syntheticPrep.refresh_first.includes('forgeflow-trends --refresh') && syntheticPrep.refresh_first.includes('forgeflow-code-map') && !syntheticPrep.refresh_first.includes('Split scope before review.') && syntheticPrep.review_notes.includes('Split scope before review.') && syntheticPrep.validate_first.includes('Run auth regression tests before review.')],
  ['trust current when clean', trustState({ latest_insights: { status: 'injected', check_status: 'pass', freshness: { status: 'current' } }, freshness: { status: 'current' } }, { check: { status: 'pass' } }, []) === 'current'],
  ['trust blocked on failed gate', trustState({ latest_insights: { status: 'injected', check_status: 'fail', freshness: { status: 'current' } }, freshness: { status: 'current' } }, { check: { status: 'pass' } }, []) === 'blocked'],
  ['trust attention without learning check', trustState({ latest_insights: { status: 'injected', check_status: 'pass', freshness: { status: 'current' } }, freshness: { status: 'current' } }, {}, []) === 'attention'],
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
