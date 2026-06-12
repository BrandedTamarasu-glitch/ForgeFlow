#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildLeanReport, parseArgs, renderMarkdown } = require('./render-lean-report');
const { recordAgentFeedback } = require('./record-agent-feedback');
const { recordNextWorkOutcome } = require('./record-next-work-outcome');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-lean-report-'));
  const projectDir = path.join(root, '.forgeflow', 'Demo');
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'review-outcomes.jsonl'), `${JSON.stringify({
    schema_version: '1',
    change_id: 'lean-report-a',
    recorded_at: '2026-06-12T00:00:00Z',
    review: { mode: 'full-mode', workflow: 'forgeflow', agents_used: ['warden_reviewer'], verifier_decisions: [] },
    outcome: {
      findings_total: 1,
      findings_confirmed: 1,
      findings_rejected: 0,
      review_minutes: 3,
      auto_fix_success: true,
      post_merge_regression: false,
    },
  })}\n${JSON.stringify({
    schema_version: '1',
    change_id: 'lean-report-b',
    recorded_at: '2026-06-12T00:10:00Z',
    review: { mode: 'full-mode', workflow: 'forgeflow', agents_used: ['smith_reviewer'], verifier_decisions: [] },
    outcome: {
      findings_total: 0,
      findings_confirmed: 0,
      findings_rejected: 0,
      review_minutes: 2,
      auto_fix_success: true,
      post_merge_regression: false,
    },
  })}\n`);
  recordAgentFeedback({
    projectDir,
    agent: 'warden_reviewer',
    signal: 'useful',
    summary: 'Helped confirm lean report evidence.',
    confidence: 'high',
    evidenceCount: 1,
  });
  recordAgentFeedback({
    projectDir,
    agent: 'smith_reviewer',
    signal: 'useful',
    summary: 'Helped confirm lean telemetry boundaries.',
    confidence: 'high',
    evidenceCount: 1,
  });
  recordNextWorkOutcome({
    projectDir,
    title: 'delivery report',
    source: 'delivery',
    outcome: 'useful',
    confidence: 'high',
  });
  recordNextWorkOutcome({
    projectDir,
    title: 'delivery report follow-up',
    source: 'delivery',
    outcome: 'useful',
    confidence: 'high',
  });
  const metricsRoot = path.join(root, 'metrics');
  fs.mkdirSync(path.join(metricsRoot, 'project-a'), { recursive: true });
  fs.writeFileSync(path.join(metricsRoot, 'project-a', 'forgeflow-metrics.jsonl'), `${JSON.stringify({ event: 'review' })}\n${JSON.stringify({ event: 'ship' })}\n`);
  return { root, projectDir, metricsRoot };
}

function seedLeanArtifacts(projectDir) {
  writeJson(path.join(projectDir, 'context', 'lean-decision.json'), {
    schema_version: '1',
    decision: {
      decision: 'simplify',
      reuse_candidates: ['native fs'],
      avoid_first: ['new dependency'],
      validation_minimum: ['focused test'],
      do_not_simplify: ['security'],
      ceiling: {
        known_ceiling: 'Upgrade when multiple formats are needed.',
        upgrade_trigger: 'Second caller needs shared parsing.',
      },
    },
    implementation_note_candidate: {
      agent: 'Atlas',
      category: 'tradeoff',
      note: 'Lean path selected.',
    },
  });
  writeJson(path.join(projectDir, 'context', 'lean-review.json'), {
    schema_version: '1',
    status: 'clean',
    findings_count: 0,
    estimated_net_removable_lines: 0,
    findings: [],
  });
  writeJson(path.join(projectDir, 'context', 'output-contract.json'), {
    schema_version: '1',
    status: 'pass',
    lean_checked_count: 1,
    issues: [],
  });
  writeJson(path.join(projectDir, 'context', 'latest', 'context-telemetry.json'), {
    compact_tokens: 1000,
    estimated_saved_tokens: 9000,
  });
  fs.writeFileSync(path.join(projectDir, 'implementation-notes.md'), [
    '# Implementation Notes',
    '',
    '- Lean path selected. Known ceiling: Upgrade when multiple formats are needed. Upgrade trigger: second caller.',
    '- Validation: focused test and source smoke passed.',
  ].join('\n'));
}

function throws(fn, pattern) {
  try {
    fn();
  } catch (err) {
    return pattern.test(err.message);
  }
  return false;
}

const complete = makeRoot();
seedLeanArtifacts(complete.projectDir);
const report = buildLeanReport(complete);
const markdown = renderMarkdown(report);
const written = buildLeanReport({ ...complete, write: true });

const thin = makeRoot();
const thinReport = buildLeanReport(thin);

const invalid = makeRoot();
fs.mkdirSync(path.join(invalid.projectDir, 'context'), { recursive: true });
fs.writeFileSync(path.join(invalid.projectDir, 'context', 'lean-decision.json'), '{nope');
const invalidReport = buildLeanReport(invalid);

const symlink = makeRoot();
fs.mkdirSync(path.join(symlink.projectDir, 'context'), { recursive: true });
fs.writeFileSync(path.join(symlink.root, 'outside.json'), '{}\n');
fs.symlinkSync(path.join(symlink.root, 'outside.json'), path.join(symlink.projectDir, 'context', 'lean-decision.json'));
const symlinkReport = buildLeanReport(symlink);

const linkedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-lean-report-linked-'));
const realProject = path.join(linkedRoot, 'real');
fs.mkdirSync(realProject, { recursive: true });
const linkedProject = path.join(linkedRoot, 'linked');
fs.symlinkSync(realProject, linkedProject);

const opts = parseArgs(['--root', complete.root, '--project-dir', complete.projectDir, '--metrics-root', complete.metricsRoot, '--write', '--json']);

const checks = [
  ['complete lean evidence is ready for dogfood', report.status === 'ready' && report.lean_decision === 'continue-dogfood'],
  ['summarizes lean signals without snippets', report.signals.lean_decision.reuse_candidates === 1 && report.signals.implementation_notes.ceiling_notes >= 1 && !JSON.stringify(report).includes('native fs')],
  ['renders markdown boundaries and metrics', markdown.includes('no raw code snippets') && markdown.includes('Current diff:') && markdown.includes('Telemetry status: ready')],
  ['write mode writes local artifacts', fs.existsSync(written.artifacts.markdown) && fs.existsSync(written.artifacts.json) && JSON.parse(fs.readFileSync(written.artifacts.json, 'utf8')).schema_version === '1'],
  ['missing lean evidence stays thin', thinReport.status === 'thin' && thinReport.lean_decision === 'collect-evidence'],
  ['invalid lean evidence blocks report', invalidReport.status === 'attention' && invalidReport.invalid_artifacts.length === 1],
  ['symlink artifact is invalid evidence', symlinkReport.status === 'attention' && /symlink/i.test(symlinkReport.invalid_artifacts[0].reason)],
  ['symlink project refused', throws(() => buildLeanReport({ root: linkedRoot, projectDir: linkedProject }), /symlinked project directory/)],
  ['parses args', opts.root === complete.root && opts.projectDir === complete.projectDir && opts.metricsRoot === complete.metricsRoot && opts.write && opts.json],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('lean report: ok');
