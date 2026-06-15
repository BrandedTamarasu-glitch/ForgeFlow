#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  aggregateRuns,
  buildLeanLab,
  normalizeResults,
  normalizeTaskPack,
  parseArgs,
  renderMarkdown,
} = require('./render-lean-lab');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-lean-lab-'));
const projectDir = path.join(root, '.forgeflow', 'Demo');
const contextDir = path.join(projectDir, 'context');
const fixtureDir = path.join(root, 'fixtures', 'lean-lab');
fs.mkdirSync(contextDir, { recursive: true });
fs.mkdirSync(fixtureDir, { recursive: true });
const taskPackPath = path.join(fixtureDir, 'task-pack.json');
const resultsPath = path.join(contextDir, 'results.json');
fs.writeFileSync(taskPackPath, JSON.stringify({
  name: 'Demo lean lab',
  required_sample_size_per_mode: 2,
  tasks: [
    { id: 'wrapper-cleanup', title: 'Remove duplicate wrapper branch', validation: ['node --test'] },
    { id: 'docs-trim', title: 'Trim redundant docs paragraph', validation: ['node scripts/forgeflow/test-doc-links.js'] },
  ],
}, null, 2));
fs.writeFileSync(resultsPath, JSON.stringify({
  runs: [
    { task_id: 'wrapper-cleanup', mode: 'baseline', loc: 42, files_changed: 2, validation_passed: true, review_findings: 2, context_tokens: 900, cost_usd: 0.05, latency_ms: 5000, follow_up_fixes: 1 },
    { task_id: 'docs-trim', mode: 'baseline', loc: 24, files_changed: 1, validation_passed: true, review_findings: 1, context_tokens: 700, cost_usd: 0.04, latency_ms: 4000, follow_up_fixes: 0 },
    { task_id: 'wrapper-cleanup', mode: 'balanced', loc: 28, files_changed: 1, validation_passed: true, review_findings: 1, context_tokens: 620, cost_usd: 0.03, latency_ms: 3500, follow_up_fixes: 0 },
    { task_id: 'docs-trim', mode: 'balanced', loc: 16, files_changed: 1, validation_passed: true, review_findings: 0, context_tokens: 520, cost_usd: 0.02, latency_ms: 3200, follow_up_fixes: 0 },
    { task_id: 'wrapper-cleanup', mode: 'strict', loc: 18, files_changed: 1, validation_passed: true, review_findings: 0, context_tokens: 420, cost_usd: 0.02, latency_ms: 2900, follow_up_fixes: 0 },
    { task_id: 'docs-trim', mode: 'strict', loc: 12, files_changed: 1, validation_passed: true, review_findings: 0, context_tokens: 400, cost_usd: 0.02, latency_ms: 2800, follow_up_fixes: 0 },
    { task_id: 'wrapper-cleanup', mode: 'ultra', loc: 10, files_changed: 1, validation_passed: true, review_findings: 0, context_tokens: 330, cost_usd: 0.01, latency_ms: 2500, follow_up_fixes: 0 },
    { task_id: 'docs-trim', mode: 'ultra', loc: 8, files_changed: 1, validation_passed: true, review_findings: 0, context_tokens: 300, cost_usd: 0.01, latency_ms: 2400, follow_up_fixes: 0 },
  ],
}, null, 2));

const result = buildLeanLab({ root, projectDir, taskPack: taskPackPath, results: resultsPath, write: true });
const markdown = renderMarkdown(result);
const taskPack = normalizeTaskPack(JSON.parse(fs.readFileSync(taskPackPath, 'utf8')));
const results = normalizeResults(JSON.parse(fs.readFileSync(resultsPath, 'utf8')));
const aggregate = aggregateRuns(results.runs);
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--task-pack', taskPackPath, '--results', resultsPath, '--write', '--json']);

const thinPath = path.join(contextDir, 'thin-results.json');
fs.writeFileSync(thinPath, JSON.stringify({ runs: [
  { task_id: 'wrapper-cleanup', mode: 'baseline', loc: 1, validation_passed: true },
  { task_id: 'wrapper-cleanup', mode: 'balanced', loc: 1, validation_passed: true },
  { task_id: 'wrapper-cleanup', mode: 'strict', loc: 1, validation_passed: true },
  { task_id: 'wrapper-cleanup', mode: 'ultra', loc: 1, validation_passed: true },
] }, null, 2));
const thin = buildLeanLab({ root, projectDir, taskPack: taskPackPath, results: thinPath });

const failedValidationPath = path.join(contextDir, 'failed-results.json');
fs.writeFileSync(failedValidationPath, JSON.stringify({ runs: [
  { task_id: 'wrapper-cleanup', mode: 'baseline', validation_passed: true },
  { task_id: 'docs-trim', mode: 'baseline', validation_passed: true },
  { task_id: 'wrapper-cleanup', mode: 'balanced', validation_passed: false },
] }, null, 2));
const failedValidation = buildLeanLab({ root, projectDir, taskPack: taskPackPath, results: failedValidationPath });

const invalidPath = path.join(contextDir, 'invalid.json');
fs.writeFileSync(invalidPath, '{nope');
const invalid = buildLeanLab({ root, projectDir, taskPack: taskPackPath, results: invalidPath });

let symlinkRejected = false;
const symlinkRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-lean-lab-link-'));
const symlinkProject = path.join(symlinkRoot, '.forgeflow', 'Demo');
fs.mkdirSync(path.dirname(symlinkProject), { recursive: true });
fs.symlinkSync(projectDir, symlinkProject);
try {
  buildLeanLab({ root: symlinkRoot, projectDir: symlinkProject });
} catch (_err) {
  symlinkRejected = true;
}

const checks = [
  ['compares four modes with gate ready', result.status === 'ready' && result.claim_level === 'comparable-local-signals' && result.ranking[0].mode === 'ultra'],
  ['normalizes task pack', taskPack.tasks.length === 2 && taskPack.required_sample_size_per_mode === 2],
  ['normalizes results', results.runs.length === 8 && results.runs[0].validation_passed],
  ['aggregates mode metrics', aggregate.modes.find((mode) => mode.mode === 'baseline').loc_avg === 33],
  ['writes artifacts', fs.existsSync(path.join(contextDir, 'lean-lab.md')) && fs.existsSync(path.join(contextDir, 'lean-lab.json'))],
  ['renders boundaries and no-ranking rule', markdown.includes('no raw private snippets') && markdown.includes('Claim level: comparable-local-signals')],
  ['single samples are descriptive only', thin.status === 'thin' && thin.claim_level === 'descriptive' && thin.decision === 'collect-sample-size'],
  ['validation failures block comparison', failedValidation.status === 'attention' && failedValidation.decision === 'fix-validation'],
  ['invalid inputs draw attention', invalid.status === 'attention' && invalid.invalid_artifacts.length === 1],
  ['parses args', opts.root === root && opts.projectDir === projectDir && opts.taskPack === taskPackPath && opts.results === resultsPath && opts.write && opts.json],
  ['symlink project rejected', symlinkRejected],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  for (const [name] of failed) console.error(`FAIL: ${name}`);
  process.exit(1);
}

console.log('lean lab: ok');
