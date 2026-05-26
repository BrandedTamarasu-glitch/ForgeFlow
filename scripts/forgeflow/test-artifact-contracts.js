#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildProjectIntelligence } = require('./build-project-intelligence');
const { getVersionStatus } = require('./forgeflow-version');
const { summarize } = require('./record-review-outcome');
const { buildReleaseReadiness } = require('./render-release-readiness');

const repoRoot = path.resolve(__dirname, '..', '..');

function assertObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasKeys(value, keys) {
  return assertObject(value) && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function enumValue(value, allowed) {
  return allowed.includes(value);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function createProjectRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-artifact-contract-'));
  const projectDir = path.join(root, '.forgeflow', path.basename(root));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'context'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'app.ts'), 'export const value = 1;\n');
  fs.writeFileSync(path.join(projectDir, 'project-learning-candidates.jsonl'), `${JSON.stringify({
    category: 'validation-pattern',
    learning: 'Run focused artifact contract tests before release.',
    confidence: 'medium',
    evidence_count: 1,
  })}\n`);
  fs.writeFileSync(path.join(projectDir, 'review-outcomes.jsonl'), `${JSON.stringify({
    schema_version: '1',
    change_id: 'artifact-contract-fixture',
    review: {
      mode: 'thin-mode',
      workflow: 'forgeflow',
      agents_used: ['smith_reviewer'],
      verifier_decisions: [],
    },
    outcome: {
      findings_total: 1,
      findings_confirmed: 1,
      findings_rejected: 0,
      review_minutes: 3,
      auto_fix_success: true,
      post_merge_regression: false,
      learning_signals: {
        manual_promotion_candidate: 1,
      },
    },
  })}\n`);
  return { root, projectDir };
}

async function main() {
  const project = createProjectRoot();
  const intelligence = buildProjectIntelligence(project);
  const reviewOutcome = summarize([readJson('fixtures/evaluation/sample-outcome.json')]);
  const readiness = buildReleaseReadiness({ root: repoRoot, planOnly: true });
  const version = await getVersionStatus({ home: fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-version-contract-')), offline: true });
  const schemaDoc = fs.readFileSync(path.join(repoRoot, 'docs/forgeflow-json-schema.md'), 'utf8');

  const checks = [
    ['project intelligence schema', intelligence.schema_version === '1' && hasKeys(intelligence, [
      'generated_at',
      'project_dir',
      'provenance',
      'trust_state',
      'readiness',
      'freshness',
      'guidance',
      'top_risks',
      'hot_files',
      'recommended_next_actions',
      'validation_patterns',
      'agent_feedback',
      'review_outcomes',
      'recommendations',
      'artifacts',
      'review_prep',
      'next_work_brief',
      'next_work_items',
    ])],
    ['project intelligence readiness enum', enumValue(intelligence.readiness.state, ['ready', 'needs-refresh', 'needs-triage', 'blocked'])],
    ['project intelligence review outcome contract', hasKeys(intelligence.review_outcomes, ['status', 'records', 'invalid_lines', 'learning_signals', 'totals', 'top_classes']) && hasKeys(intelligence.review_outcomes.learning_signals, ['true_positive', 'false_positive', 'missed_issue', 'stale_guidance', 'manual_promotion_candidate'])],
    ['project intelligence next work contract', Array.isArray(intelligence.next_work_items) && intelligence.next_work_items.every((item) => hasKeys(item, ['title', 'priority', 'source', 'why', 'start_with', 'validate_with', 'proof_boundary']) && Array.isArray(item.start_with) && Array.isArray(item.validate_with))],
    ['review outcome summary contract', reviewOutcome.schema_version === '1' && hasKeys(reviewOutcome, ['records', 'modes', 'agents', 'totals', 'learning_signals', 'classes']) && hasKeys(reviewOutcome.learning_signals, ['true_positive', 'false_positive', 'missed_issue', 'stale_guidance', 'manual_promotion_candidate'])],
    ['release readiness contract', readiness.schema_version === '1' && hasKeys(readiness, ['generated_at', 'root', 'status', 'mode', 'command_count', 'install_preflight', 'categories', 'blockers', 'checks', 'snapshot', 'comparison', 'boundary']) && enumValue(readiness.mode, ['plan-only', 'run'])],
    ['version snapshot contract', version.schema_version === '1' && hasKeys(version, ['repo', 'home', 'installed', 'upstream', 'paths', 'path_status', 'runtime_helpers', 'snapshot', 'status', 'action']) && version.upstream.status === 'skipped-offline'],
    ['schema docs include artifact contracts', schemaDoc.includes('## Local artifact contracts') && schemaDoc.includes('### Project intelligence rollup') && schemaDoc.includes('### Review outcome summary') && schemaDoc.includes('### Release readiness') && schemaDoc.includes('### Version support snapshot')],
    ['schema docs include learning signals', schemaDoc.includes('learning_signals') && schemaDoc.includes('manual_promotion_candidate')],
  ];

  const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length > 0) {
    console.error(`artifact contract test failed: ${failed.join(', ')}`);
    process.exit(1);
  }

  console.log('artifact contracts: ok');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
