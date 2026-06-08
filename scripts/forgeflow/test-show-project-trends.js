#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  failureDigestFreshness,
  latestInsightsFreshness,
  parseArgs,
  parseProjectLearnings,
  projectFreshness,
  renderMarkdown,
  showProjectTrends,
} = require('./show-project-trends');

const repoRoot = path.resolve(__dirname, '..', '..');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-project-trends-'));
const projectDir = path.join(root, '.forgeflow', 'Demo');
const contextDir = path.join(projectDir, 'context');
const latestDir = path.join(contextDir, 'latest');
fs.mkdirSync(contextDir, { recursive: true });
fs.mkdirSync(latestDir, { recursive: true });

fs.writeFileSync(path.join(contextDir, 'code-map-history.jsonl'), [
  JSON.stringify({
    schema_version: '1',
    generated_at: '2026-05-19T00:00:00Z',
    commit_short: 'aaaaaaa',
    dirty: false,
    summary: {
      source_files: 4,
      local_edges: 3,
      unresolved_imports: 0,
      skipped_dynamic_imports: 0,
      sections: 20,
      changed_sections: 1,
      markdown_section_files: 2,
    },
    high_fan_in: [],
    high_fan_out: [],
  }),
  JSON.stringify({
    schema_version: '1',
    generated_at: '2026-05-20T00:00:00Z',
    commit_short: 'bbbbbbb',
    dirty: true,
    summary: {
      source_files: 5,
      local_edges: 5,
      unresolved_imports: 1,
      skipped_dynamic_imports: 0,
      sections: 24,
      changed_sections: 3,
      markdown_section_files: 2,
    },
    high_fan_in: [{ path: 'src/core.ts', fan_in: 4, fan_out: 1 }],
    high_fan_out: [{ path: 'src/app.ts', fan_in: 1, fan_out: 4 }],
  }),
  '',
].join('\n'));
fs.writeFileSync(path.join(contextDir, 'operating-model-history.jsonl'), [
  JSON.stringify({
    schema_version: '1',
    generated_at: '2026-05-19T00:00:00Z',
    commit_short: 'aaaaaaa',
    dirty: false,
    status: 'ready',
    confidence_band: 'medium',
    summary: {
      domains: 1,
      high_care_files: 1,
      risk_zones: 1,
      validation_patterns: 1,
    },
    domains: ['scripts/forgeflow'],
    high_care_files: ['scripts/forgeflow/file-safety.js'],
    risk_zones: ['Release helper reported stale state.'],
    validation_patterns: ['node scripts/forgeflow/test-release-version.js'],
  }),
  JSON.stringify({
    schema_version: '1',
    generated_at: '2026-05-20T00:00:00Z',
    commit_short: 'bbbbbbb',
    dirty: true,
    status: 'ready',
    confidence_band: 'high',
    summary: {
      domains: 2,
      high_care_files: 2,
      risk_zones: 2,
      validation_patterns: 2,
    },
    domains: ['scripts/forgeflow', 'commands'],
    high_care_files: ['scripts/forgeflow/file-safety.js', 'scripts/forgeflow/show-project-trends.js'],
    risk_zones: ['Release helper reported stale state.', 'Context packet exceeded budget.'],
    validation_patterns: ['node scripts/forgeflow/test-release-version.js', 'node scripts/forgeflow/test-show-project-trends.js'],
  }),
  '',
].join('\n'));
fs.writeFileSync(path.join(contextDir, 'code-topology-telemetry.json'), JSON.stringify({
  schema_version: '1',
  kind: 'code-topology',
  baseline_chars: 8000,
  compact_chars: 2000,
  saved_chars: 6000,
  estimated_baseline_tokens: 2000,
  estimated_compact_tokens: 500,
  estimated_saved_tokens: 1500,
  detail: {
    source_files: 5,
    local_edges: 5,
    unresolved_imports: 1,
    skipped_dynamic_imports: 0,
  },
}) + '\n');
fs.writeFileSync(path.join(latestDir, 'context-telemetry.json'), JSON.stringify({
  schema_version: '1',
  kind: 'context-pack',
  baseline_chars: 100000,
  compact_chars: 80000,
  saved_chars: 20000,
  estimated_baseline_tokens: 25000,
  estimated_compact_tokens: 20000,
  estimated_saved_tokens: 5000,
  detail: {},
}) + '\n');
fs.writeFileSync(path.join(contextDir, 'code-topology.json'), JSON.stringify({
  schema_version: '1',
  unresolved: [
    { source: 'src/app.ts', specifier: './missing', kind: 'import' },
  ],
  skipped_dynamic: [
    { source: 'src/routes.ts', expression: '`./pages/${name}`' },
  ],
}, null, 2));
fs.writeFileSync(path.join(projectDir, 'project-learnings.md'), [
  '# Project Learnings',
  '',
  '## Sources',
  '',
  '- Code map history: 2 snapshot(s), trend compared',
  '',
].join('\n'));
fs.writeFileSync(path.join(latestDir, 'latest-insights-report.json'), JSON.stringify({
  schema_version: '1',
  status: 'injected',
  reason: 'quality-check-passing',
  generated_at: '2026-05-20T00:00:00.000Z',
  git: {
    available: false,
    commit_short: '',
    dirty: true,
  },
  check_status: 'pass',
  issue_count: 0,
}, null, 2));
fs.writeFileSync(path.join(latestDir, 'failure-digest.md'), [
  '# Forgeflow Failure Digest',
  '',
  'Generated at: 2026-05-20T00:01:00Z',
  'Git available: yes',
  'Git commit: bbbbbbb',
  'Git dirty: no',
  'Mode: failed-test',
  'Status: compact',
  'Raw required: no',
  'Reason: test failure summarized',
  'Input lines: 120',
  'Output lines: 12',
  'Omitted lines: 108',
  '',
  '## Evidence References',
  '- line 7: FAIL test validates failure digest',
  '',
  '## Compact Output',
  '```text',
  'FAIL test validates failure digest',
  'Expected digest to be surfaced',
  '```',
  '',
].join('\n'));

const result = showProjectTrends({ root, projectDir });
const markdown = renderMarkdown(result);
const splitIndex = markdown.indexOf('Split: Run a narrower context pack');
const budgetIndex = markdown.indexOf('Rebuild context with a smaller --files list');
const nextAdvisorIndex = markdown.indexOf('Code-map history shows 1 new unresolved import');
const cliJson = showProjectTrends(parseArgs([
  '--project-dir',
  projectDir,
  '--json',
], { exitOnError: false }));
let missingValue = { status: 0, stderr: '' };
try {
  parseArgs(['--project-dir'], { exitOnError: false });
} catch (err) {
  missingValue = { status: err.exitCode || 1, stderr: err.message };
}
const parsedLearnings = parseProjectLearnings(fs.readFileSync(path.join(projectDir, 'project-learnings.md'), 'utf8'));
const staleFreshness = projectFreshness({
  current: { available: true, commit_short: 'ccccccc', dirty: true },
  latest: { generated_at: '2026-05-20T00:00:00Z', commit_short: 'bbbbbbb', dirty: false },
  historySnapshots: 2,
  projectLearnings: parsedLearnings,
});
const staleLearningFreshness = projectFreshness({
  current: { available: true, commit_short: 'bbbbbbb', dirty: false },
  latest: { generated_at: '2026-05-20T00:00:00Z', commit_short: 'bbbbbbb', dirty: false },
  historySnapshots: 3,
  projectLearnings: {
    present: true,
    generated_at: '2026-05-20T00:00:00Z',
    consumed_code_map_history_snapshots: 2,
  },
});
const staleFailureDigestFreshness = failureDigestFreshness({
  present: true,
  git: { available: true, commit_short: 'bbbbbbb', dirty: false },
}, { available: true, commit_short: 'ccccccc', dirty: true });
const refreshLagFreshness = projectFreshness({
  current: { available: true, commit_short: 'bbbbbbb', dirty: false },
  latest: { generated_at: '2026-05-20T00:00:00Z', commit_short: 'bbbbbbb', dirty: false },
  historySnapshots: 3,
  projectLearnings: {
    present: true,
    generated_at: '2026-05-20T00:00:00Z',
    consumed_code_map_history_snapshots: 2,
  },
  allowRefreshLag: true,
});
const missingFreshness = projectFreshness({
  current: { available: true, commit_short: 'ccccccc', dirty: false },
  latest: null,
  projectLearnings: { present: false },
});
const staleInsightsFreshness = latestInsightsFreshness({
  git: { available: true, commit_short: 'bbbbbbb', dirty: false },
}, repoRoot);
const staleGuidance = showProjectTrends({ root: repoRoot, projectDir });
const infoProjectDir = path.join(root, '.forgeflow', 'InfoOnly');
const infoContextDir = path.join(infoProjectDir, 'context');
const infoLatestDir = path.join(infoContextDir, 'latest');
fs.mkdirSync(infoLatestDir, { recursive: true });
fs.writeFileSync(path.join(infoContextDir, 'code-map-history.jsonl'), `${JSON.stringify({
  schema_version: '1',
  generated_at: '2026-05-20T00:00:00Z',
  commit_short: '',
  dirty: true,
  summary: {
    source_files: 1,
    local_edges: 0,
    unresolved_imports: 1,
    skipped_dynamic_imports: 0,
    sections: 1,
    changed_sections: 0,
    markdown_section_files: 0,
  },
  high_fan_in: [],
  high_fan_out: [],
})}\n`);
fs.writeFileSync(path.join(infoContextDir, 'code-topology.json'), JSON.stringify({
  schema_version: '1',
  unresolved: [
    { source: 'fixtures/demo/test-app.ts', specifier: './missing', kind: 'import' },
  ],
  skipped_dynamic: [],
}, null, 2));
fs.writeFileSync(path.join(infoProjectDir, 'project-learnings.md'), [
  '# Project Learnings',
  '',
  '## Sources',
  '',
  '- Generated at: 2026-05-20T00:00:00Z',
  '- Code map history: 1 snapshot(s)',
  '',
].join('\n'));
fs.writeFileSync(path.join(infoLatestDir, 'latest-insights-report.json'), JSON.stringify({
  schema_version: '1',
  status: 'injected',
  reason: 'quality-check-passing',
  generated_at: '2026-05-20T00:00:00.000Z',
  git: { available: false, commit_short: '', dirty: true },
  check_status: 'pass',
  issue_count: 0,
}, null, 2));
const infoOnlyGaps = showProjectTrends({ root, projectDir: infoProjectDir });
const missingDigestProjectDir = path.join(root, '.forgeflow', 'MissingDigest');
const missingDigestContextDir = path.join(missingDigestProjectDir, 'context');
const missingDigestLatestDir = path.join(missingDigestContextDir, 'latest');
fs.mkdirSync(missingDigestLatestDir, { recursive: true });
fs.writeFileSync(path.join(missingDigestContextDir, 'code-map-history.jsonl'), `${JSON.stringify({
  schema_version: '1',
  generated_at: '2026-05-20T00:00:00Z',
  commit_short: '',
  dirty: false,
  summary: {
    source_files: 1,
    local_edges: 0,
    unresolved_imports: 0,
    skipped_dynamic_imports: 0,
    sections: 1,
    changed_sections: 0,
    markdown_section_files: 0,
  },
  high_fan_in: [],
  high_fan_out: [],
})}\n`);
fs.writeFileSync(path.join(missingDigestProjectDir, 'project-learnings.md'), [
  '# Project Learnings',
  '',
  '## Sources',
  '',
  '- Generated at: 2026-05-20T00:00:00Z',
  '- Code map history: 1 snapshot(s)',
  '',
].join('\n'));
fs.writeFileSync(path.join(missingDigestLatestDir, 'latest-insights-report.json'), JSON.stringify({
  schema_version: '1',
  status: 'injected',
  reason: 'quality-check-passing',
  generated_at: '2026-05-20T00:00:00.000Z',
  git: { available: false, commit_short: '', dirty: false },
  check_status: 'pass',
  issue_count: 0,
}, null, 2));
const missingDigestResult = showProjectTrends({ root, projectDir: missingDigestProjectDir });
const missingDigestMarkdown = renderMarkdown(missingDigestResult);
const symlinkProjectDir = path.join(root, '.forgeflow', 'SymlinkLearning');
const symlinkContextDir = path.join(symlinkProjectDir, 'context');
const symlinkLatestDir = path.join(symlinkContextDir, 'latest');
fs.mkdirSync(symlinkLatestDir, { recursive: true });
fs.writeFileSync(path.join(symlinkContextDir, 'code-map-history.jsonl'), '');
fs.writeFileSync(path.join(symlinkLatestDir, 'latest-insights-report.json'), JSON.stringify({
  schema_version: '1',
  status: 'injected',
  reason: 'quality-check-passing',
  generated_at: '2026-05-20T00:00:00.000Z',
  git: { available: false, commit_short: '', dirty: true },
  check_status: 'pass',
  issue_count: 0,
}, null, 2));
const outsideLearning = path.join(root, 'outside-project-learnings.md');
fs.writeFileSync(outsideLearning, '# Secret\n\n- SHOULD_NOT_LEAK\n');
fs.symlinkSync(outsideLearning, path.join(symlinkProjectDir, 'project-learnings.md'));
const symlinkLearningResult = showProjectTrends({ root, projectDir: symlinkProjectDir });
const symlinkTopologyProjectDir = path.join(root, '.forgeflow', 'SymlinkTopology');
const symlinkTopologyContextDir = path.join(symlinkTopologyProjectDir, 'context');
const symlinkTopologyLatestDir = path.join(symlinkTopologyContextDir, 'latest');
fs.mkdirSync(symlinkTopologyLatestDir, { recursive: true });
fs.writeFileSync(path.join(symlinkTopologyContextDir, 'code-map-history.jsonl'), '');
fs.writeFileSync(path.join(symlinkTopologyProjectDir, 'project-learnings.md'), [
  '# Project Learnings',
  '',
  '## Sources',
  '',
  '- Generated at: 2026-05-20T00:00:00Z',
  '',
].join('\n'));
fs.writeFileSync(path.join(symlinkTopologyLatestDir, 'latest-insights-report.json'), JSON.stringify({
  schema_version: '1',
  status: 'injected',
  reason: 'quality-check-passing',
  generated_at: '2026-05-20T00:00:00.000Z',
  git: { available: false, commit_short: '', dirty: true },
  check_status: 'pass',
  issue_count: 0,
}, null, 2));
const outsideTopology = path.join(root, 'outside-code-topology.json');
fs.writeFileSync(outsideTopology, JSON.stringify({
  schema_version: '1',
  unresolved: [
    { source: 'src/leak.ts', specifier: './secret', kind: 'import' },
  ],
  skipped_dynamic: [],
}, null, 2));
fs.symlinkSync(outsideTopology, path.join(symlinkTopologyContextDir, 'code-topology.json'));
const symlinkTopologyResult = showProjectTrends({ root, projectDir: symlinkTopologyProjectDir });
const hardlinkTopologyProjectDir = path.join(root, '.forgeflow', 'HardlinkTopology');
const hardlinkTopologyContextDir = path.join(hardlinkTopologyProjectDir, 'context');
const hardlinkTopologyLatestDir = path.join(hardlinkTopologyContextDir, 'latest');
fs.mkdirSync(hardlinkTopologyLatestDir, { recursive: true });
fs.writeFileSync(path.join(hardlinkTopologyContextDir, 'code-map-history.jsonl'), '');
fs.writeFileSync(path.join(hardlinkTopologyProjectDir, 'project-learnings.md'), [
  '# Project Learnings',
  '',
  '## Sources',
  '',
  '- Generated at: 2026-05-20T00:00:00Z',
  '',
].join('\n'));
fs.writeFileSync(path.join(hardlinkTopologyLatestDir, 'latest-insights-report.json'), JSON.stringify({
  schema_version: '1',
  status: 'injected',
  reason: 'quality-check-passing',
  generated_at: '2026-05-20T00:00:00.000Z',
  git: { available: false, commit_short: '', dirty: true },
  check_status: 'pass',
  issue_count: 0,
}, null, 2));
const outsideHardlinkTopology = path.join(root, 'outside-hardlink-code-topology.json');
fs.writeFileSync(outsideHardlinkTopology, JSON.stringify({
  schema_version: '1',
  unresolved: [
    { source: 'src/hardlink-leak.ts', specifier: './secret', kind: 'import' },
  ],
  skipped_dynamic: [],
}, null, 2));
fs.linkSync(outsideHardlinkTopology, path.join(hardlinkTopologyContextDir, 'code-topology.json'));
const hardlinkTopologyResult = showProjectTrends({ root, projectDir: hardlinkTopologyProjectDir });
const symlinkHistoryProjectDir = path.join(root, '.forgeflow', 'SymlinkHistory');
const symlinkHistoryContextDir = path.join(symlinkHistoryProjectDir, 'context');
const symlinkHistoryLatestDir = path.join(symlinkHistoryContextDir, 'latest');
fs.mkdirSync(symlinkHistoryLatestDir, { recursive: true });
fs.writeFileSync(path.join(symlinkHistoryProjectDir, 'project-learnings.md'), '# Project Learnings\n');
fs.writeFileSync(path.join(symlinkHistoryLatestDir, 'latest-insights-report.json'), JSON.stringify({
  schema_version: '1',
  status: 'injected',
  reason: 'quality-check-passing',
  generated_at: '2026-05-20T00:00:00.000Z',
  git: { available: false, commit_short: '', dirty: true },
  check_status: 'pass',
  issue_count: 0,
}, null, 2));
const outsideHistory = path.join(root, 'outside-code-map-history.jsonl');
fs.writeFileSync(outsideHistory, `${JSON.stringify({
  schema_version: '1',
  generated_at: '2026-05-20T00:00:00Z',
  summary: {
    source_files: 99,
    local_edges: 99,
    unresolved_imports: 99,
    skipped_dynamic_imports: 0,
    sections: 99,
    changed_sections: 99,
    markdown_section_files: 0,
  },
  high_fan_in: [{ path: 'src/leaked-history.ts', fan_in: 99, fan_out: 0 }],
  high_fan_out: [],
})}\n`);
fs.symlinkSync(outsideHistory, path.join(symlinkHistoryContextDir, 'code-map-history.jsonl'));
const symlinkHistoryResult = showProjectTrends({ root, projectDir: symlinkHistoryProjectDir });
const symlinkOperatingModelProjectDir = path.join(root, '.forgeflow', 'SymlinkOperatingModelHistory');
const symlinkOperatingModelContextDir = path.join(symlinkOperatingModelProjectDir, 'context');
const symlinkOperatingModelLatestDir = path.join(symlinkOperatingModelContextDir, 'latest');
fs.mkdirSync(symlinkOperatingModelLatestDir, { recursive: true });
fs.writeFileSync(path.join(symlinkOperatingModelContextDir, 'code-map-history.jsonl'), '');
fs.writeFileSync(path.join(symlinkOperatingModelProjectDir, 'project-learnings.md'), '# Project Learnings\n');
fs.writeFileSync(path.join(symlinkOperatingModelLatestDir, 'latest-insights-report.json'), JSON.stringify({
  schema_version: '1',
  status: 'injected',
  reason: 'quality-check-passing',
  generated_at: '2026-05-20T00:00:00.000Z',
  git: { available: false, commit_short: '', dirty: true },
  check_status: 'pass',
  issue_count: 0,
}, null, 2));
const outsideOperatingModelHistory = path.join(root, 'outside-operating-model-history.jsonl');
fs.writeFileSync(outsideOperatingModelHistory, `${JSON.stringify({
  schema_version: '1',
  generated_at: '2026-05-20T00:00:00Z',
  domains: ['src/leaked-operating-domain'],
  high_care_files: ['src/leaked-operating-model.ts'],
  risk_zones: [],
  validation_patterns: [],
})}\n`);
fs.symlinkSync(outsideOperatingModelHistory, path.join(symlinkOperatingModelContextDir, 'operating-model-history.jsonl'));
const symlinkOperatingModelResult = showProjectTrends({ root, projectDir: symlinkOperatingModelProjectDir });
const invalidOperatingModelProjectDir = path.join(root, '.forgeflow', 'InvalidOperatingModelHistory');
const invalidOperatingModelContextDir = path.join(invalidOperatingModelProjectDir, 'context');
const invalidOperatingModelLatestDir = path.join(invalidOperatingModelContextDir, 'latest');
fs.mkdirSync(invalidOperatingModelLatestDir, { recursive: true });
fs.writeFileSync(path.join(invalidOperatingModelContextDir, 'code-map-history.jsonl'), '');
fs.writeFileSync(path.join(invalidOperatingModelProjectDir, 'project-learnings.md'), '# Project Learnings\n');
fs.writeFileSync(path.join(invalidOperatingModelLatestDir, 'latest-insights-report.json'), JSON.stringify({
  schema_version: '1',
  status: 'injected',
  reason: 'quality-check-passing',
  generated_at: '2026-05-20T00:00:00.000Z',
  git: { available: false, commit_short: '', dirty: true },
  check_status: 'pass',
  issue_count: 0,
}, null, 2));
fs.writeFileSync(path.join(invalidOperatingModelContextDir, 'operating-model-history.jsonl'), [
  JSON.stringify({
    schema_version: '1',
    generated_at: '2026-05-20T00:00:00Z',
    domains: ['scripts/forgeflow'],
    high_care_files: [],
    risk_zones: [],
    validation_patterns: [],
  }),
  'not-json',
  '',
].join('\n'));
const invalidOperatingModelResult = showProjectTrends({ root, projectDir: invalidOperatingModelProjectDir });
const symlinkProjectTargetDir = path.join(root, 'outside-symlink-project-target');
const symlinkRootProjectDir = path.join(root, '.forgeflow', 'SymlinkProjectRoot');
fs.mkdirSync(symlinkProjectTargetDir, { recursive: true });
fs.symlinkSync(symlinkProjectTargetDir, symlinkRootProjectDir);
let symlinkProjectBlocked = false;
try {
  showProjectTrends({ root, projectDir: symlinkRootProjectDir });
} catch (err) {
  symlinkProjectBlocked = err.message.includes('symlinked directory');
}
const customProjectDir = path.join(root, 'custom-forgeflow-state');
const customContextDir = path.join(customProjectDir, 'context');
const customLatestDir = path.join(customContextDir, 'latest');
fs.mkdirSync(customLatestDir, { recursive: true });
fs.writeFileSync(path.join(customContextDir, 'code-map-history.jsonl'), '');
fs.writeFileSync(path.join(customProjectDir, 'project-learnings.md'), '# Project Learnings\n');
fs.writeFileSync(path.join(customLatestDir, 'latest-insights-report.json'), JSON.stringify({
  schema_version: '1',
  status: 'injected',
  reason: 'quality-check-passing',
  generated_at: '2026-05-20T00:00:00.000Z',
  git: { available: true, commit_short: 'stale', dirty: false },
  check_status: 'pass',
  issue_count: 0,
}, null, 2));
const customProjectResult = showProjectTrends({ root: repoRoot, projectDir: customProjectDir });
const refreshCliJson = showProjectTrends(parseArgs([
  '--project-dir',
  projectDir,
  '--refresh',
  '--json',
], { exitOnError: false }));

const checks = [
  ['summarizes history count', result.code_map.history_snapshots === 2],
  ['compares code map trend', result.code_map.trend.status === 'compared' && result.code_map.trend.unresolved_imports_delta === 1],
  ['compares operating model drift', result.operating_model.history_status === 'present' && result.operating_model.history_snapshots === 2 && result.operating_model.trend.status === 'drift' && result.operating_model.trend.severity === 'attention' && result.operating_model.trend.domains.added.includes('commands') && result.operating_model.trend.high_care_files.added.includes('scripts/forgeflow/show-project-trends.js') && result.operating_model.trend.risk_zones.added.includes('Context packet exceeded budget.') && result.operating_model.trend.validation_patterns.added.includes('node scripts/forgeflow/test-show-project-trends.js')],
  ['summarizes living project map', result.code_map.living_project_map.status === 'attention' && result.code_map.living_project_map.categories.some((item) => item.category === 'new-hotspot' && item.paths.includes('src/core.ts')) && result.code_map.living_project_map.categories.some((item) => item.category === 'import-gap-growth') && result.code_map.living_project_map.categories.some((item) => item.category === 'changed-section-churn')],
  ['reports new hotspots', result.code_map.new_high_fan_in.includes('src/core.ts') && result.code_map.new_high_fan_out.includes('src/app.ts')],
  ['summarizes import gaps', result.import_gaps.status === 'attention' && result.import_gaps.unresolved_total === 1 && result.import_gaps.skipped_dynamic_total === 1 && result.recommendations.some((item) => item.command === 'forgeflow-code-map')],
  ['summarizes import gap triage', result.import_gaps.triage.expected_total === 1 && result.import_gaps.triage.needs_review_total === 1 && result.import_gaps.triage.categories.some((item) => item.category === 'local-module-missing')],
  ['keeps test fixture import gaps informational', infoOnlyGaps.import_gaps.status === 'info' && infoOnlyGaps.import_gaps.production_total === 0 && infoOnlyGaps.import_gaps.test_fixture_total === 1 && !infoOnlyGaps.recommendations.some((item) => item.command === 'forgeflow-code-map')],
  ['symlink project learnings not read', symlinkLearningResult.project_learnings.present === false && !JSON.stringify(symlinkLearningResult).includes('SHOULD_NOT_LEAK')],
  ['symlink topology not read', symlinkTopologyResult.import_gaps.status === 'missing' && !JSON.stringify(symlinkTopologyResult).includes('src/leak.ts')],
  ['hardlink topology not read', hardlinkTopologyResult.import_gaps.status === 'missing' && !JSON.stringify(hardlinkTopologyResult).includes('src/hardlink-leak.ts')],
  ['symlink history not read', symlinkHistoryResult.code_map.history_snapshots === 0 && !JSON.stringify(symlinkHistoryResult).includes('src/leaked-history.ts')],
  ['symlink operating model history not read', symlinkOperatingModelResult.operating_model.history_snapshots === 0 && symlinkOperatingModelResult.operating_model.history_status === 'invalid' && symlinkOperatingModelResult.operating_model.trend.status === 'invalid' && !JSON.stringify(symlinkOperatingModelResult).includes('src/leaked-operating-model.ts')],
  ['invalid operating model history surfaces invalid', invalidOperatingModelResult.operating_model.history_status === 'invalid' && invalidOperatingModelResult.operating_model.invalid_lines === 1 && invalidOperatingModelResult.operating_model.trend.status === 'invalid' && invalidOperatingModelResult.operating_model.trend.boundary.includes('Invalid history') && invalidOperatingModelResult.recommendations.some((item) => item.command === 'forgeflow-project-model --refresh' && item.reason.includes('invalid'))],
  ['symlink project root blocked', symlinkProjectBlocked],
  ['custom project dir uses caller root for insights freshness', customProjectResult.latest_insights.freshness.current_commit !== '' && customProjectResult.latest_insights.freshness.issues.some((item) => item.code === 'latest-insights-commit-stale')],
  ['detects learning consumption', result.project_learnings.consumed_code_map_trend === true && parsedLearnings.consumed_code_map_trend === true && parsedLearnings.consumed_code_map_history_snapshots === 2 && parsedLearnings.generated_at === ''],
  ['summarizes freshness', result.freshness.status === 'attention' && result.freshness.issues.some((item) => item.code === 'project-learnings-generated-at-missing')],
  ['recommends refresh for stale artifacts', staleGuidance.recommendations.some((item) => item.command === 'forgeflow-trends --refresh')],
  ['summarizes latest insights', result.latest_insights.status === 'injected' && result.latest_insights.check_status === 'pass' && result.latest_insights.freshness.status === 'current'],
  ['summarizes latest failure digest', result.failure_digest.status === 'compact' && result.failure_digest.mode === 'failed-test' && result.failure_digest.git.commit_short === 'bbbbbbb' && result.failure_digest.git.dirty === false && result.failure_digest.freshness.status === 'current' && result.failure_digest.triage.state === 'usable' && result.failure_digest.triage.confidence === 'high' && result.failure_digest.omitted_lines === 108 && result.failure_digest.summary.includes('FAIL test validates failure digest')],
  ['explains first-run missing failure digest without recommending action', missingDigestResult.failure_digest.first_run === true && missingDigestResult.failure_digest.triage.state === 'first-run' && missingDigestResult.failure_digest.first_run_guidance.includes('/forgeflow-failure-digest') && !missingDigestResult.recommendations.some((item) => item.command === 'forgeflow-failure-digest') && missingDigestMarkdown.includes('First run: yes') && missingDigestMarkdown.includes('First-run guidance: Run /forgeflow-failure-digest')],
  ['detects stale failure digest freshness', staleFailureDigestFreshness.status === 'attention' && staleFailureDigestFreshness.issues.some((item) => item.code === 'failure-digest-commit-stale') && staleFailureDigestFreshness.issues.some((item) => item.code === 'failure-digest-dirty-stale')],
  ['detects stale latest insights', staleInsightsFreshness.status === 'attention' && staleInsightsFreshness.issues.some((item) => item.code === 'latest-insights-commit-stale')],
  ['detects stale code map freshness', staleFreshness.status === 'attention' && staleFreshness.issues.some((item) => item.code === 'code-map-commit-stale') && staleFreshness.issues.some((item) => item.code === 'code-map-dirty-stale')],
  ['detects stale project learning code-map consumption', staleLearningFreshness.status === 'attention' && staleLearningFreshness.issues.some((item) => item.code === 'project-learnings-code-map-stale')],
  ['allows refresh smoke code-map lag', refreshLagFreshness.status === 'current'],
  ['detects missing freshness inputs', missingFreshness.status === 'missing' && missingFreshness.issues.some((item) => item.code === 'code-map-missing') && missingFreshness.issues.some((item) => item.code === 'project-learnings-missing')],
  ['summarizes advisor', result.advisor.budget_status === 'warn' && result.advisor.code_map_trends_status === 'attention' && result.advisor.recommendations.some((item) => item.action === 'trim-budget-violation' && item.evidence && item.clears && item.split_suggestion && item.split_suggestion.strategy === 'split-before-review')],
  ['advisor split stays with parent recommendation', budgetIndex >= 0 && splitIndex > budgetIndex && (nextAdvisorIndex === -1 || splitIndex < nextAdvisorIndex)],
  ['renders markdown', markdown.includes('# Forgeflow Project Trends') && markdown.includes('## Recommendations') && markdown.includes('Evidence:') && markdown.includes('Clears:') && markdown.includes('Unresolved imports delta: 1') && markdown.includes('## Operating Model Drift') && markdown.includes('High-care added: scripts/forgeflow/show-project-trends.js') && markdown.includes('Operating-model drift is advisory') && markdown.includes('## Living Project Map') && markdown.includes('new-hotspot') && markdown.includes('graph-growth: score') && markdown.includes('Deltas: source files') && markdown.includes('Static JS/TS import and section trend only') && markdown.includes('## Import Gaps') && markdown.includes('Needs review: 1') && markdown.includes('forgeflow-code-map') && markdown.includes('## Latest Insights') && markdown.includes('## Latest Failure Digest') && markdown.includes('Git: bbbbbbb clean') && markdown.includes('Freshness: current') && markdown.includes('Triage state: usable') && markdown.includes('FAIL test validates failure digest') && markdown.includes('Rebuild context with a smaller --files list') && markdown.includes('Cleared when the generated packet is under the configured context budget') && markdown.includes('Split: Run a narrower context pack')],
  ['cli json works', cliJson.code_map.trend.status === 'compared' && cliJson.operating_model.trend.status === 'drift' && cliJson.code_map.living_project_map.status === 'attention' && cliJson.project_learnings.consumed_code_map_trend === true && Boolean(cliJson.freshness) && cliJson.latest_insights.status === 'injected' && cliJson.failure_digest.status === 'compact' && cliJson.failure_digest.freshness.status === 'attention' && cliJson.failure_digest.triage.state === 'stale' && cliJson.recommendations.some((item) => item.command === 'forgeflow-failure-digest') && cliJson.import_gaps.status === 'attention'],
  ['refresh cli works', refreshCliJson.refresh && refreshCliJson.refresh.check_status === 'pass'],
  ['missing option value exits usage', missingValue.status === 2 && missingValue.stderr.includes('Missing value for --project-dir')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

if (failed > 0) {
  process.exit(1);
}

console.log('project trends: ok');
