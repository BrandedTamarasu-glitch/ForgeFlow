#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { recordAgentFeedback } = require('./record-agent-feedback');
const { recordNextWorkOutcome } = require('./record-next-work-outcome');
const { buildTelemetryQuality, parseArgs, renderMarkdown } = require('./render-telemetry-quality');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-telemetry-quality-'));
const root = path.join(tmp, 'repo');
const projectDir = path.join(root, '.forgeflow', 'Demo');
const metricsRoot = path.join(tmp, 'metrics');
fs.mkdirSync(projectDir, { recursive: true });
fs.mkdirSync(path.join(metricsRoot, 'project-a'), { recursive: true });

const thin = buildTelemetryQuality({ root, projectDir, metricsRoot });
fs.writeFileSync(path.join(projectDir, 'review-outcomes.jsonl'), `${JSON.stringify({
  schema_version: '1',
  change_id: 'telemetry-quality',
  recorded_at: '2026-05-20T00:00:00Z',
  review: { mode: 'full-mode', workflow: 'forgeflow', agents_used: ['warden_reviewer'], verifier_decisions: [] },
  outcome: {
    findings_total: 1,
    findings_confirmed: 1,
    findings_rejected: 0,
    review_minutes: 3,
    auto_fix_success: true,
    post_merge_regression: false,
  },
})}\n`);
recordAgentFeedback({
  projectDir,
  agent: 'warden_reviewer',
  signal: 'useful',
  summary: 'Helped confirm release evidence.',
  confidence: 'high',
  evidenceCount: 1,
});
recordNextWorkOutcome({
  projectDir,
  title: 'Review profile guidance',
  source: 'user-profile',
  outcome: 'useful',
  confidence: 'high',
});
fs.writeFileSync(path.join(metricsRoot, 'project-a', 'forgeflow-metrics.jsonl'), `${JSON.stringify({ event: 'review' })}\n`);
const ready = buildTelemetryQuality({ root, projectDir, metricsRoot });
fs.appendFileSync(path.join(projectDir, 'review-outcomes.jsonl'), '{bad json}\n');
fs.appendFileSync(path.join(metricsRoot, 'project-a', 'forgeflow-metrics.jsonl'), '{bad json}\n');
const attention = buildTelemetryQuality({ root, projectDir, metricsRoot });
const invalidStatusRoot = path.join(tmp, 'invalid-status-repo');
const invalidStatusProjectDir = path.join(invalidStatusRoot, '.forgeflow', 'Demo');
fs.mkdirSync(path.join(invalidStatusProjectDir, 'review-outcomes.jsonl'), { recursive: true });
const invalidStatus = buildTelemetryQuality({ root: invalidStatusRoot, projectDir: invalidStatusProjectDir, metricsRoot });
const markdown = renderMarkdown(ready);
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--metrics-root', metricsRoot, '--json']);

const checks = [
  ['reports thin evidence', thin.status === 'thin' && thin.missing.includes('review-outcomes') && thin.evidence_score < 100],
  ['reports ready evidence', ready.status === 'ready' && ready.missing.length === 0 && ready.evidence_score === 100],
  ['counts streams', ready.counts.review_outcomes === 1 && ready.counts.agent_feedback === 1 && ready.counts.next_work_outcomes === 1 && ready.counts.metrics_events === 1],
  ['downgrades invalid lines', attention.status === 'attention' && attention.invalid_total === 2 && attention.evidence_score < 100],
  ['downgrades invalid reader status', invalidStatus.status === 'attention' && invalidStatus.invalid.review_outcomes === 1],
  ['renders boundary and counts', markdown.includes('Telemetry quality is advisory') && markdown.includes('metrics_events') && markdown.includes('Invalid Lines')],
  ['parses args', opts.root === root && opts.projectDir === projectDir && opts.metricsRoot === metricsRoot && opts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('telemetry quality: ok');
