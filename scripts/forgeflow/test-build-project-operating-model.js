#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildProjectOperatingModel,
  compactProjectOperatingModel,
  countDomains,
  domainName,
  parseArgs,
  renderMarkdown,
} = require('./build-project-operating-model');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-project-operating-model-'));
const projectDir = path.join(root, '.forgeflow', path.basename(root));
const contextDir = path.join(projectDir, 'context');
fs.mkdirSync(contextDir, { recursive: true });

const intelligence = {
  schema_version: '1',
  generated_at: '2026-06-06T00:00:00Z',
  project_dir: projectDir,
  trust_state: 'current',
  readiness: { state: 'ready' },
  freshness: { project: 'current', latest_insights: 'current' },
  provenance: {
    git: { available: true, branch: 'main', commit_short: 'abc1234', dirty: false },
  },
  top_risks: [
    { source: 'project-learnings', severity: 'attention', summary: 'Auto-fix failed once.', next_action: 'review-auto evidence', confidence: { band: 'medium' } },
  ],
  hot_files: ['scripts/forgeflow/file-safety.js', 'scripts/forgeflow/build-context-pack.js'],
  validation_patterns: ['node scripts/forgeflow/test-build-context-pack.js'],
  review_prep: {
    read_first: ['scripts/forgeflow/build-context-pack.js'],
    validate_first: ['node scripts/forgeflow/test-runtime-helper-contract.js'],
  },
  next_work_brief: {
    read_first: ['scripts/forgeflow/file-safety.js'],
    avoid_first: ['Do not mutate installed runtime files.'],
    validate_first: ['node scripts/forgeflow/test-build-context-pack.js'],
    proof_boundary: ['Advisory context only.'],
  },
  user_profile: {
    status: 'pass',
    injected: true,
    records: 3,
    suggestion_count: 1,
    conflict_count: 0,
  },
  artifacts: {
    json: path.join(contextDir, 'project-intelligence-rollup.json'),
    project_learnings: path.join(projectDir, 'project-learnings.md'),
    latest_insights_report: path.join(contextDir, 'latest', 'latest-insights-report.json'),
    code_topology: path.join(contextDir, 'code-topology.json'),
  },
};

const topology = {
  high_fan_in: [{ path: 'scripts/forgeflow/file-safety.js', fan_in: 44 }],
  high_fan_out: [{ path: 'scripts/forgeflow/build-context-pack.js', fan_out: 12 }],
  local_edges: [
    { source: 'scripts/forgeflow/build-context-pack.js', target: 'scripts/forgeflow/file-safety.js' },
    { source: 'commands/review.md', target: 'scripts/forgeflow/file-safety.js' },
    { source: 'docs/wiki/Home.md', target: 'README.md' },
  ],
};

const out = path.join(contextDir, 'project-operating-model.json');
const model = buildProjectOperatingModel({ root, projectDir, out, intelligence, topology });
const markdown = renderMarkdown(model);
const compact = compactProjectOperatingModel(model, 1600);
const missingTopology = buildProjectOperatingModel({
  root,
  projectDir,
  out: path.join(contextDir, 'project-operating-model-missing.json'),
  intelligence: {
    ...intelligence,
    trust_state: 'attention',
    readiness: { state: 'needs-triage' },
  },
  topology: null,
});
const cliOpts = parseArgs(['--root', root, '--project-dir', projectDir, '--out', out, '--json', '--refresh'], { exitOnError: false });
const domains = countDomains([
  'apps/backoffice/src/app.ts',
  'apps/backoffice/src/router.ts',
  'packages/database/src/schema.ts',
  'scripts/forgeflow/file-safety.js',
]);

const checks = [
  ['writes json artifact', fs.existsSync(out)],
  ['writes markdown artifact', fs.existsSync(out.replace(/\.json$/, '.md'))],
  ['schema version', model.schema_version === '1'],
  ['status ready with topology', model.status === 'ready'],
  ['confidence high when ready', model.confidence.band === 'high'],
  ['status attention without topology', missingTopology.status === 'attention' && missingTopology.confidence.band === 'low'],
  ['includes project state', model.project_state.trust_state === 'current' && model.project_state.readiness === 'ready'],
  ['infers domains', domains.some((item) => item.name === 'apps/backoffice') && domains.some((item) => item.name === 'scripts/forgeflow')],
  ['domain names stable', domainName('packages/database/src/schema.ts') === 'packages/database' && domainName('docs/wiki/Home.md') === 'docs'],
  ['includes high-care files', model.high_care_files.some((item) => item.path === 'scripts/forgeflow/file-safety.js' && item.reason.includes('hot file'))],
  ['includes risk zones', model.risk_zones.some((item) => item.summary.includes('Auto-fix failed'))],
  ['includes validation model', model.validation_model.some((item) => item.command_or_pattern.includes('test-runtime-helper-contract'))],
  ['includes preferences', model.operating_preferences.status === 'pass' && model.operating_preferences.injected === true && model.operating_preferences.records === 3],
  ['includes guidance', model.agent_guidance.read_first.includes('scripts/forgeflow/file-safety.js') && model.agent_guidance.avoid_first.includes('Do not mutate installed runtime files.') && model.agent_guidance.proof_boundary.includes('Advisory context only.')],
  ['includes sandbox policy hint', model.review_policy_hints.sandbox_prerequisite.includes('isolated sandbox') && model.review_policy_hints.auto_fix_boundary.includes('security')],
  ['includes source provenance', model.provenance.sources.includes('project-intelligence') && model.provenance.sources.includes('code-topology')],
  ['markdown renders advisory sections', markdown.includes('# Forgeflow Project Operating Model') && markdown.includes('advisory only') && markdown.includes('## Domains') && markdown.includes('## High-Care Files') && markdown.includes('## Review Policy Hints') && markdown.includes('Sandbox prerequisite:')],
  ['compact model renders packet guidance', compact.includes('High-care files:') && compact.includes('Read first:') && compact.includes('Avoid first:') && compact.includes('Validate first:') && compact.includes('Proof boundary:') && compact.includes('advisory only')],
  ['cli opts parse', cliOpts.root === root && cliOpts.projectDir === projectDir && cliOpts.out === out && cliOpts.json === true && cliOpts.refresh === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('project operating model: ok');
