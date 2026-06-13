#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  buildContextPack,
  buildLatestInsights,
  buildLatestInsightsResult,
  compactProjectCodeMap,
  jsonSummary,
} = require('./build-context-pack');

const repoRoot = path.resolve(__dirname, '..', '..');
const repoProjectContextDir = path.join(repoRoot, '.forgeflow', path.basename(repoRoot), 'context');
fs.mkdirSync(repoProjectContextDir, { recursive: true });
const seededProjectCodeMapPath = path.join(repoProjectContextDir, 'project-code-map.md');
const seededTopologyPath = path.join(repoProjectContextDir, 'code-topology.json');
const seededArchitecturePath = path.join(repoProjectContextDir, 'architecture.json');
const seededOwnershipPath = path.join(repoProjectContextDir, 'ownership-map.json');
const seededInvocationPath = path.join(repoProjectContextDir, 'invocation-hints.json');
const seededLeanDecisionPath = path.join(repoProjectContextDir, 'lean-decision.json');
const seededLeanPolicyPath = path.join(repoProjectContextDir, 'lean-policy.json');
const seededLeanReportPath = path.join(repoProjectContextDir, 'lean-report.json');
const previousProjectCodeMap = fs.existsSync(seededProjectCodeMapPath)
  ? fs.readFileSync(seededProjectCodeMapPath, 'utf8')
  : null;
const previousTopology = fs.existsSync(seededTopologyPath)
  ? fs.readFileSync(seededTopologyPath, 'utf8')
  : null;
const previousArchitecture = fs.existsSync(seededArchitecturePath)
  ? fs.readFileSync(seededArchitecturePath, 'utf8')
  : null;
const previousOwnership = fs.existsSync(seededOwnershipPath)
  ? fs.readFileSync(seededOwnershipPath, 'utf8')
  : null;
const previousInvocation = fs.existsSync(seededInvocationPath)
  ? fs.readFileSync(seededInvocationPath, 'utf8')
  : null;
const previousLeanDecision = fs.existsSync(seededLeanDecisionPath)
  ? fs.readFileSync(seededLeanDecisionPath, 'utf8')
  : null;
const previousLeanPolicy = fs.existsSync(seededLeanPolicyPath)
  ? fs.readFileSync(seededLeanPolicyPath, 'utf8')
  : null;
const previousLeanReport = fs.existsSync(seededLeanReportPath)
  ? fs.readFileSync(seededLeanReportPath, 'utf8')
  : null;
fs.writeFileSync(seededProjectCodeMapPath, [
  '# Forgeflow Project Code Map',
  '',
  '## Summary',
  '',
  '- Source files: 5',
  '- Local edges: 4',
  '- Sections mapped: 12',
  '- Changed sections: 2',
  '',
  '## High Fan-In',
  '',
  '- scripts/forgeflow/build-context-pack.js (fan-in 3, fan-out 2)',
  '',
  '## Limits',
  '',
  '- Static JS/TS import graph only.',
  '',
].join('\n'));
fs.writeFileSync(seededTopologyPath, JSON.stringify({
  schema_version: '1',
  summary: {
    source_files: 1,
    local_edges: 0,
    sections: 1,
    changed_sections: 1,
  },
  high_fan_in: [{ path: 'legacy/stale-topology.js', fan_in: 9, fan_out: 0 }],
  high_fan_out: [],
  changed_sections: {
    'legacy/stale-topology.js': [{ kind: 'function', name: 'stale', line: 1, end_line: 1, changed_lines: [1] }],
  },
}, null, 2));
fs.writeFileSync(seededArchitecturePath, JSON.stringify({
  status: 'ready',
  entrypoints: [{ path: 'src/auth/session.ts', evidence: 'test entrypoint' }],
  validation_norms: [{ command_or_pattern: 'npm test' }],
  gaps: [{ kind: 'static-import-gap', action: 'verify dynamic imports manually' }],
}, null, 2));
fs.writeFileSync(seededOwnershipPath, JSON.stringify({
  status: 'ready',
  high_care_files: [{ path: 'src/auth/session.ts', recommended_lane: 'Warden', owner_surface: 'security', reasons: ['auth high-care'] }],
  coverage_gaps: [{ path: 'src/auth/session.ts', owner_surface: 'security', recommended_lane: 'Warden', reason: 'no CODEOWNERS coverage' }],
}, null, 2));
fs.writeFileSync(seededInvocationPath, JSON.stringify({
  status: 'ready',
  invocation_hints: [{ kind: 'package-script', path: 'package.json', suggested_invocation: 'npm test', evidence: 'scripts.test' }],
  gaps: [],
}, null, 2));
fs.writeFileSync(seededLeanDecisionPath, JSON.stringify({
  schema_version: '1',
  decision: {
    decision: 'simplify',
    reuse_candidates: ['existing helper'],
    avoid_first: ['new dependency'],
    validation_minimum: ['context-pack test'],
    do_not_simplify: ['security'],
  },
}, null, 2));
fs.writeFileSync(seededLeanPolicyPath, JSON.stringify({
  schema_version: '1',
  profile: 'strict',
  enabled: true,
  max_guidance_tokens: 1800,
}, null, 2));
fs.writeFileSync(seededLeanReportPath, JSON.stringify({
  schema_version: '1',
  status: 'ready',
  lean_decision: 'continue-dogfood',
  signals: {
    lean_decision: {
      reuse_candidates: 1,
      avoid_first_items: 1,
      validation_minimum_items: 1,
      do_not_simplify_items: 1,
    },
    implementation_notes: {
      ceiling_notes: 1,
      validation_mentions: 2,
    },
    lean_review: {
      findings_count: 0,
    },
    output_contract: {
      lean_warning_count: 0,
    },
    diff: {
      files_changed: 2,
      lines_added: 12,
      lines_removed: 3,
    },
    telemetry: {
      status: 'ready',
      evidence_score: 100,
    },
    context_tokens: {
      estimated_saved_tokens: 9000,
    },
  },
}, null, 2));
const compactMap = compactProjectCodeMap(repoRoot);
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-pack-'));
fs.writeFileSync(path.join(outDir, 'failure-digest.md'), [
  '# Forgeflow Failure Digest',
  '',
  'Generated at: 2026-05-20T00:01:00Z',
  'Git available: yes',
  'Git commit: 0000000',
  'Git dirty: no',
  'Mode: failed-test',
  'Status: compact',
  'Raw required: no',
  'Reason: context packet fixture failure summarized',
  'Input lines: 80',
  'Output lines: 8',
  'Omitted lines: 72',
  '',
  '## Evidence References',
  '- line 2: FAIL context packet fixture',
  '',
  '## Compact Output',
  '```text',
  'FAIL context packet fixture',
  'Expected agent packet to carry failure digest',
  '```',
  '',
].join('\n'));
const result = buildContextPack({
  filesPath: path.join(repoRoot, 'fixtures/context-pack/review.files'),
  linesChanged: 80,
  task: 'Review login flow token load context packing',
  out: outDir,
  modeOverride: '',
  calibrationPath: '',
  ci: false,
  maxMemoryChars: 12000,
  maxDiffChars: 18000,
});
const noisyOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-pack-noisy-'));
const noisyResult = buildContextPack({
  filesPath: path.join(repoRoot, 'fixtures/review-route/noisy.files'),
  linesChanged: 20,
  task: 'Review noisy file list handling',
  out: noisyOutDir,
  modeOverride: '',
  calibrationPath: '',
  ci: false,
  maxMemoryChars: 12000,
  maxDiffChars: 18000,
});
const explicitRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-pack-explicit-root-'));
spawnSync('git', ['init'], { cwd: explicitRoot, encoding: 'utf8' });
spawnSync('git', ['config', 'user.email', 'forgeflow@example.invalid'], { cwd: explicitRoot, encoding: 'utf8' });
spawnSync('git', ['config', 'user.name', 'Forgeflow Test'], { cwd: explicitRoot, encoding: 'utf8' });
fs.mkdirSync(path.join(explicitRoot, 'src'), { recursive: true });
fs.writeFileSync(path.join(explicitRoot, 'README.md'), '# Explicit Root\n');
fs.writeFileSync(path.join(explicitRoot, 'src/app.ts'), [
  'export function app() {',
  '  return 1;',
  '}',
  '',
].join('\n'));
spawnSync('git', ['add', 'README.md', 'src/app.ts'], { cwd: explicitRoot, encoding: 'utf8' });
spawnSync('git', ['commit', '-m', 'init'], { cwd: explicitRoot, encoding: 'utf8' });
fs.writeFileSync(path.join(explicitRoot, 'src/app.ts'), [
  'export function app() {',
  '  return 2;',
  '}',
  '',
].join('\n'));
fs.writeFileSync(path.join(explicitRoot, 'src/new.ts'), 'export const newValue = 1;\n');
fs.writeFileSync(path.join(explicitRoot, 'review.files'), 'src/app.ts\nsrc/new.ts\n');
const unrelatedCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-pack-unrelated-cwd-'));
const previousCwd = process.cwd();
process.chdir(unrelatedCwd);
let explicitRootResult = null;
try {
  explicitRootResult = buildContextPack({
    root: explicitRoot,
    out: path.join(explicitRoot, '.forgeflow', path.basename(explicitRoot), 'context', 'latest'),
    task: 'Review explicit root context pack',
    modeOverride: '',
    calibrationPath: '',
    ci: false,
    maxMemoryChars: 4000,
    maxDiffChars: 8000,
  });
} finally {
  process.chdir(previousCwd);
}
const topologyGuidanceOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-pack-topology-guidance-'));
const topologyGuidanceFiles = path.join(topologyGuidanceOutDir, 'review.files');
fs.writeFileSync(topologyGuidanceFiles, [
  'scripts/forgeflow/build-context-pack.js',
  '',
].join('\n'));
const topologyGuidanceResult = buildContextPack({
  filesPath: topologyGuidanceFiles,
  linesChanged: 40,
  task: 'Review context-pack topology guidance',
  out: topologyGuidanceOutDir,
  modeOverride: '',
  calibrationPath: '',
  ci: false,
  maxMemoryChars: 12000,
  maxDiffChars: 18000,
});
const insightsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-latest-insights-'));
const insightsProjectDir = path.join(insightsRoot, '.forgeflow', path.basename(insightsRoot));
fs.mkdirSync(insightsProjectDir, { recursive: true });
fs.writeFileSync(path.join(insightsProjectDir, 'project-learnings.md'), [
  '# Project Learnings',
  '',
  'These learnings are guidance only. Verify current code, tests, and review artifacts before relying on them.',
  '',
  '## Recurring Pitfalls',
  '- Check docs drift before release.',
  '',
  '## Stable Decisions',
  '- Keep project learnings local.',
  '',
  '## Risk Areas',
  '- Context packets can overrun budgets.',
  '',
  '## Validation Patterns',
  '- Run context pack tests before release checks.',
  '',
  '## Hot Files And Modules',
  '- scripts/forgeflow/build-context-pack.js',
  '',
  '## Repeated Follow-ups',
  '- Recheck generated reviewer packets.',
  '',
  '## Recommended Approach For Next Work',
  '- Gate agent guidance before injection.',
  '',
].join('\n'));
fs.writeFileSync(path.join(insightsProjectDir, 'project-learning-candidates.jsonl'), [
  { category: 'recurring-pitfall', learning: 'Check docs drift before release.' },
  { category: 'stable-decision', learning: 'Keep project learnings local.' },
  { category: 'risk-area', learning: 'Context packets can overrun budgets.' },
  { category: 'validation-pattern', learning: 'Run context pack tests before release checks.' },
  { category: 'hot-file', learning: 'scripts/forgeflow/build-context-pack.js' },
  { category: 'repeated-follow-up', learning: 'Recheck generated reviewer packets.' },
  { category: 'recommended-approach', learning: 'Gate agent guidance before injection.' },
].map((item) => JSON.stringify(item)).join('\n') + '\n');
const passingInsights = buildLatestInsights(insightsRoot);
const passingInsightsResult = buildLatestInsightsResult(insightsRoot);
fs.writeFileSync(path.join(insightsProjectDir, 'project-learning-candidates.jsonl'), JSON.stringify({
  category: 'unknown-category',
  learning: 'This malformed candidate should block injection.',
}) + '\n');
fs.writeFileSync(path.join(insightsProjectDir, 'project-learnings.md'), [
  '# Project Learnings',
  '',
  '## Recurring Pitfalls',
  '- No repeated pattern recorded yet.',
  '',
  '## Stable Decisions',
  '- No repeated pattern recorded yet.',
  '',
  '## Risk Areas',
  '- No repeated pattern recorded yet.',
  '',
  '## Validation Patterns',
  '- No repeated pattern recorded yet.',
  '',
  '## Hot Files And Modules',
  '- No repeated pattern recorded yet.',
  '',
  '## Repeated Follow-ups',
  '- No repeated pattern recorded yet.',
  '',
  '## Recommended Approach For Next Work',
  '- No repeated pattern recorded yet.',
  '',
].join('\n'));
const blockedInsights = buildLatestInsights(insightsRoot);
const blockedInsightsResult = buildLatestInsightsResult(insightsRoot);
const cliOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-pack-cli-'));
const cliResult = buildContextPack({
  filesPath: path.join(repoRoot, 'fixtures/context-pack/review.files'),
  linesChanged: 80,
  task: 'Review login flow token load context packing',
  out: cliOutDir,
  maxMemoryChars: 12000,
  maxDiffChars: 18000,
});
const cliJson = jsonSummary(cliResult);
const explicitRootCliOutDir = path.join(explicitRoot, '.forgeflow', path.basename(explicitRoot), 'context', 'cli-root');
process.chdir(unrelatedCwd);
let explicitRootCliResult = null;
try {
  explicitRootCliResult = buildContextPack({
    root: explicitRoot,
    filesPath: 'review.files',
    linesChanged: 3,
    trackedLines: 2,
    untrackedLines: 1,
    out: path.relative(explicitRoot, explicitRootCliOutDir),
    task: 'Review explicit root context pack',
    maxMemoryChars: 4000,
    maxDiffChars: 8000,
  });
} finally {
  process.chdir(previousCwd);
}
const explicitRootCliJson = explicitRootCliResult ? {
  root: explicitRootCliResult.root,
  files: explicitRootCliResult.route.files,
  lines_changed: explicitRootCliResult.route.lines_changed,
  tracked_lines: explicitRootCliResult.route.tracked_lines,
  untracked_lines: explicitRootCliResult.route.untracked_lines,
} : null;
const untrackedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-pack-untracked-'));
spawnSync('git', ['init'], { cwd: untrackedRoot, encoding: 'utf8' });
fs.writeFileSync(path.join(untrackedRoot, 'untracked-helper.js'), 'export const value = 1;\n');
const untrackedOutDir = path.join(untrackedRoot, '.forgeflow', path.basename(untrackedRoot), 'context', 'latest');
let untrackedCli = { status: 0 };
process.chdir(untrackedRoot);
try {
  buildContextPack({ out: untrackedOutDir });
} catch (err) {
  untrackedCli = { status: 1, stderr: err.message };
} finally {
  process.chdir(previousCwd);
}
const untrackedDiffSummary = fs.existsSync(path.join(untrackedOutDir, 'diff-summary.md'))
  ? fs.readFileSync(path.join(untrackedOutDir, 'diff-summary.md'), 'utf8')
  : '';
const budgetRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-pack-budget-'));
spawnSync('git', ['init'], { cwd: budgetRoot, encoding: 'utf8' });
fs.writeFileSync(path.join(budgetRoot, 'big-change.js'), `${'const value = 1;\n'.repeat(200)}`);
fs.writeFileSync(path.join(budgetRoot, '.forgeflow-budget.json'), JSON.stringify({
  max_compact_tokens: 1,
  warn_only: false,
}, null, 2));
let budgetCli = { status: 0, stderr: '' };
process.chdir(budgetRoot);
try {
  buildContextPack({
    out: path.join(budgetRoot, '.forgeflow', path.basename(budgetRoot), 'context', 'latest'),
    ci: true,
  });
} catch (err) {
  budgetCli = { status: 1, stderr: err.message };
} finally {
  process.chdir(previousCwd);
}
const symlinkOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-pack-symlink-'));
const outsideDiff = path.join(symlinkOutDir, 'outside-diff.md');
const symlinkDiff = path.join(symlinkOutDir, 'diff-summary.md');
fs.writeFileSync(outsideDiff, 'do not overwrite\n');
let symlinkPackBlocked = true;
try {
  fs.symlinkSync(outsideDiff, symlinkDiff);
  buildContextPack({
    filesPath: path.join(repoRoot, 'fixtures/context-pack/review.files'),
    linesChanged: 80,
    out: symlinkOutDir,
    ci: false,
    maxMemoryChars: 12000,
    maxDiffChars: 18000,
  });
  symlinkPackBlocked = false;
} catch (err) {
  symlinkPackBlocked = err.message.includes('symlinked file');
}
const symlinkMemoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-pack-memory-symlink-'));
spawnSync('git', ['init'], { cwd: symlinkMemoryRoot, encoding: 'utf8' });
fs.writeFileSync(path.join(symlinkMemoryRoot, 'src-auth-session.js'), 'export const session = true;\n');
const symlinkMemoryProject = path.join(symlinkMemoryRoot, '.forgeflow', path.basename(symlinkMemoryRoot));
fs.mkdirSync(symlinkMemoryProject, { recursive: true });
const outsideMemory = path.join(symlinkMemoryRoot, 'outside-memory.md');
fs.writeFileSync(outsideMemory, '# Secret Memory\n\n- TOP_SECRET_MARKER session token leak\n');
fs.symlinkSync(outsideMemory, path.join(symlinkMemoryProject, 'project-learnings.md'));
const symlinkMemoryOut = path.join(symlinkMemoryProject, 'context', 'latest');
let symlinkMemoryCli = { status: 0 };
let symlinkMemoryResult = {};
process.chdir(symlinkMemoryRoot);
try {
  symlinkMemoryResult = buildContextPack({
    out: symlinkMemoryOut,
    task: 'Review session token behavior',
  });
} catch (err) {
  symlinkMemoryCli = { status: 1, stderr: err.message };
} finally {
  process.chdir(previousCwd);
}
const symlinkMemorySynthesis = JSON.parse(fs.readFileSync(path.join(symlinkMemoryOut, 'synthesis-input.json'), 'utf8'));
const symlinkMemoryHits = fs.readFileSync(path.join(symlinkMemoryOut, 'memory-hits.md'), 'utf8');
const symlinkMemoryPackets = Object.values(symlinkMemorySynthesis.agent_packets)
  .map((packet) => fs.readFileSync(path.join(symlinkMemoryRoot, packet), 'utf8'))
  .join('\n');
const symlinkIndexRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-pack-index-symlink-'));
spawnSync('git', ['init'], { cwd: symlinkIndexRoot, encoding: 'utf8' });
fs.writeFileSync(path.join(symlinkIndexRoot, 'src-auth-session.js'), 'export const session = true;\n');
const symlinkIndexProject = path.join(symlinkIndexRoot, '.forgeflow', path.basename(symlinkIndexRoot));
const symlinkIndexDir = path.join(symlinkIndexProject, 'index');
fs.mkdirSync(symlinkIndexDir, { recursive: true });
const outsideIndex = path.join(symlinkIndexRoot, 'outside-memory-index.json');
fs.writeFileSync(outsideIndex, JSON.stringify({
  schema_version: '1',
  records: [
    {
      source: 'outside',
      text: 'TOP_SECRET_INDEX_MARKER session token leak',
      keywords: ['session'],
    },
  ],
}, null, 2));
fs.symlinkSync(outsideIndex, path.join(symlinkIndexDir, 'memory-index.json'));
const symlinkIndexOut = path.join(symlinkIndexProject, 'context', 'latest');
let symlinkIndexCli = { status: 0 };
process.chdir(symlinkIndexRoot);
try {
  buildContextPack({
    out: symlinkIndexOut,
    task: 'Review session token behavior',
    memoryIndex: false,
  });
} catch (err) {
  symlinkIndexCli = { status: 1, stderr: err.message };
} finally {
  process.chdir(previousCwd);
}
const symlinkIndexHits = symlinkIndexCli.status === 0 && fs.existsSync(path.join(symlinkIndexOut, 'memory-hits.md'))
  ? fs.readFileSync(path.join(symlinkIndexOut, 'memory-hits.md'), 'utf8')
  : '';
const symlinkProjectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-pack-project-root-symlink-'));
spawnSync('git', ['init'], { cwd: symlinkProjectRoot, encoding: 'utf8' });
fs.writeFileSync(path.join(symlinkProjectRoot, 'src-auth-session.js'), 'export const session = true;\n');
fs.mkdirSync(path.join(symlinkProjectRoot, '.forgeflow'), { recursive: true });
const symlinkProjectTarget = path.join(symlinkProjectRoot, 'outside-project-target');
const symlinkProjectLink = path.join(symlinkProjectRoot, '.forgeflow', path.basename(symlinkProjectRoot));
fs.mkdirSync(symlinkProjectTarget, { recursive: true });
fs.writeFileSync(path.join(symlinkProjectTarget, 'project-learnings.md'), [
  '# Project Learnings',
  '',
  '## Recurring Pitfalls',
  '- TOP_SECRET_PROJECT_ROOT_MARKER',
  '',
].join('\n'));
fs.symlinkSync(symlinkProjectTarget, symlinkProjectLink);
const symlinkProjectOut = path.join(symlinkProjectRoot, 'safe-out', 'context', 'latest');
let symlinkProjectCli = { status: 0 };
process.chdir(symlinkProjectRoot);
try {
  buildContextPack({
    out: symlinkProjectOut,
    task: 'Review session token behavior',
  });
} catch (err) {
  symlinkProjectCli = { status: 1, stderr: err.message };
} finally {
  process.chdir(previousCwd);
}
const symlinkProjectLatest = symlinkProjectCli.status === 0 && fs.existsSync(path.join(symlinkProjectOut, 'latest-insights.md'))
  ? fs.readFileSync(path.join(symlinkProjectOut, 'latest-insights.md'), 'utf8')
  : '';
const symlinkProjectHits = symlinkProjectCli.status === 0 && fs.existsSync(path.join(symlinkProjectOut, 'memory-hits.md'))
  ? fs.readFileSync(path.join(symlinkProjectOut, 'memory-hits.md'), 'utf8')
  : '';
const symlinkProjectSynthesis = symlinkProjectCli.status === 0 && fs.existsSync(path.join(symlinkProjectOut, 'synthesis-input.json'))
  ? JSON.parse(fs.readFileSync(path.join(symlinkProjectOut, 'synthesis-input.json'), 'utf8'))
  : { agent_packets: {} };
const symlinkProjectPackets = Object.values(symlinkProjectSynthesis.agent_packets || {})
  .map((packet) => fs.readFileSync(path.join(symlinkProjectRoot, packet), 'utf8'))
  .join('\n');
const symlinkOutRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-pack-out-symlink-'));
spawnSync('git', ['init'], { cwd: symlinkOutRoot, encoding: 'utf8' });
fs.writeFileSync(path.join(symlinkOutRoot, 'review.js'), 'export const value = 1;\n');
const symlinkOutTarget = path.join(symlinkOutRoot, 'outside-out-target');
const symlinkOutLink = path.join(symlinkOutRoot, '.forgeflow-link');
fs.mkdirSync(symlinkOutTarget, { recursive: true });
fs.symlinkSync(symlinkOutTarget, symlinkOutLink);
let symlinkOutCli = { status: 0, stderr: '' };
process.chdir(symlinkOutRoot);
try {
  buildContextPack({
    out: path.join(symlinkOutLink, 'context', 'latest'),
  });
} catch (err) {
  symlinkOutCli = { status: 1, stderr: err.message };
} finally {
  process.chdir(previousCwd);
}
const invalidDigestOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-pack-invalid-digest-'));
const invalidDigestOutside = path.join(invalidDigestOutDir, 'outside-failure-digest.md');
fs.writeFileSync(invalidDigestOutside, '# Forgeflow Failure Digest\n\nStatus: compact\n');
fs.symlinkSync(invalidDigestOutside, path.join(invalidDigestOutDir, 'failure-digest.md'));
const invalidDigestResult = buildContextPack({
  filesPath: path.join(repoRoot, 'fixtures/context-pack/review.files'),
  linesChanged: 80,
  task: 'Review unreadable failure digest handling',
  out: invalidDigestOutDir,
  modeOverride: '',
  calibrationPath: '',
  ci: false,
  maxMemoryChars: 12000,
  maxDiffChars: 18000,
});
const invalidDigestSynthesis = invalidDigestResult.synthesis_input;
const invalidDigestPacket = Object.values(invalidDigestSynthesis.agent_packets)
  .map((packet) => fs.readFileSync(path.join(repoRoot, packet), 'utf8'))
  .join('\n');
const rawDigestOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-pack-raw-digest-'));
fs.writeFileSync(path.join(rawDigestOutDir, 'failure-digest.md'), [
  '# Forgeflow Failure Digest',
  '',
  'Generated at: 2026-05-20T00:01:00Z',
  'Git available: yes',
  `Git commit: ${spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).stdout.trim()}`,
  'Git dirty: yes',
  'Mode: failed-test',
  'Status: compact',
  'Raw required: yes',
  'Reason: raw fixture requires inspection',
  'Input lines: 10',
  'Output lines: 10',
  'Omitted lines: 0',
  '',
  '## Evidence References',
  '- line 1: RAW_SECRET_PACKET_MARKER',
  '',
  '## Compact Output',
  '```text',
  'RAW_SECRET_PACKET_MARKER',
  '```',
  '',
].join('\n'));
const rawDigestResult = buildContextPack({
  filesPath: path.join(repoRoot, 'fixtures/context-pack/review.files'),
  linesChanged: 80,
  task: 'Review raw-required failure digest handling',
  out: rawDigestOutDir,
  modeOverride: '',
  calibrationPath: '',
  ci: false,
  maxMemoryChars: 12000,
  maxDiffChars: 18000,
});
const rawDigestSynthesis = rawDigestResult.synthesis_input;
const rawDigestPacket = Object.values(rawDigestSynthesis.agent_packets)
  .map((packet) => fs.readFileSync(path.join(repoRoot, packet), 'utf8'))
  .join('\n');

const route = JSON.parse(fs.readFileSync(path.join(outDir, 'route.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'file-manifest.json'), 'utf8'));
const synthesis = JSON.parse(fs.readFileSync(path.join(outDir, 'synthesis-input.json'), 'utf8'));
const telemetry = JSON.parse(fs.readFileSync(path.join(outDir, 'context-telemetry.json'), 'utf8'));
const insightsReport = JSON.parse(fs.readFileSync(path.join(outDir, 'latest-insights-report.json'), 'utf8'));
const userProfile = fs.readFileSync(path.join(outDir, 'user-profile.md'), 'utf8');
const projectOperatingModel = fs.readFileSync(path.join(outDir, 'project-operating-model.md'), 'utf8');
const leanGuidance = fs.readFileSync(path.join(outDir, 'lean-guidance.md'), 'utf8');
const artifactManifest = JSON.parse(fs.readFileSync(path.join(outDir, 'packet-artifacts.json'), 'utf8'));
const artifactManifestMarkdown = fs.readFileSync(path.join(outDir, 'packet-artifacts.md'), 'utf8');
const agentContextContract = JSON.parse(fs.readFileSync(path.join(outDir, 'agent-context-contract.json'), 'utf8'));
const topology = JSON.parse(fs.readFileSync(path.join(outDir, 'code-topology.json'), 'utf8'));
const topologyGuidanceSynthesis = JSON.parse(fs.readFileSync(path.join(topologyGuidanceOutDir, 'synthesis-input.json'), 'utf8'));
const topologyGuidancePacket = Object.values(topologyGuidanceSynthesis.agent_packets || {})
  .map((packet) => fs.readFileSync(path.join(repoRoot, packet), 'utf8'))
  .join('\n');
const codeMapHistoryPath = path.join(outDir, 'code-map-history.jsonl');
const noisyManifest = JSON.parse(fs.readFileSync(path.join(noisyOutDir, 'file-manifest.json'), 'utf8'));
const wardenPacket = fs.readFileSync(path.join(repoRoot, synthesis.agent_packets.warden_reviewer), 'utf8');
if (previousProjectCodeMap === null) {
  fs.unlinkSync(seededProjectCodeMapPath);
} else {
  fs.writeFileSync(seededProjectCodeMapPath, previousProjectCodeMap);
}
if (previousTopology === null) {
  fs.unlinkSync(seededTopologyPath);
} else {
  fs.writeFileSync(seededTopologyPath, previousTopology);
}
if (previousArchitecture === null) {
  fs.unlinkSync(seededArchitecturePath);
} else {
  fs.writeFileSync(seededArchitecturePath, previousArchitecture);
}
if (previousOwnership === null) {
  fs.unlinkSync(seededOwnershipPath);
} else {
  fs.writeFileSync(seededOwnershipPath, previousOwnership);
}
if (previousInvocation === null) {
  fs.unlinkSync(seededInvocationPath);
} else {
  fs.writeFileSync(seededInvocationPath, previousInvocation);
}
if (previousLeanDecision === null) {
  fs.unlinkSync(seededLeanDecisionPath);
} else {
  fs.writeFileSync(seededLeanDecisionPath, previousLeanDecision);
}
if (previousLeanPolicy === null) {
  fs.unlinkSync(seededLeanPolicyPath);
} else {
  fs.writeFileSync(seededLeanPolicyPath, previousLeanPolicy);
}
if (previousLeanReport === null) {
  fs.unlinkSync(seededLeanReportPath);
} else {
  fs.writeFileSync(seededLeanReportPath, previousLeanReport);
}

const checks = [
  ['result out dir', result.out_dir === outDir],
  ['deep mode for auth path', route.mode === 'deep-mode'],
  ['aegis included', route.agents.included.includes('aegis')],
  ['manifest has three files', manifest.files.length === 3],
  ['security kind detected', manifest.files.some((file) => file.kind === 'security')],
  ['frontend kind detected', manifest.files.some((file) => file.kind === 'frontend')],
  ['warden packet exists', Boolean(synthesis.agent_packets.warden_reviewer)],
  ['aegis packet exists', Boolean(synthesis.agent_packets.aegis)],
  ['memory hits written', fs.existsSync(path.join(outDir, 'memory-hits.md'))],
  ['latest insights written', fs.existsSync(path.join(outDir, 'latest-insights.md'))],
  ['latest insights report written', fs.existsSync(path.join(outDir, 'latest-insights-report.json'))],
  ['user profile written', fs.existsSync(path.join(outDir, 'user-profile.md'))],
  ['project operating model written', fs.existsSync(path.join(outDir, 'project-operating-model.md'))],
  ['lean guidance written', fs.existsSync(path.join(outDir, 'lean-guidance.md'))],
  ['code topology written', fs.existsSync(path.join(outDir, 'code-topology.json'))],
  ['code topology review focus written', fs.existsSync(path.join(outDir, 'code-topology-review-focus.md'))],
  ['code topology telemetry written', fs.existsSync(path.join(outDir, 'code-topology-telemetry.json'))],
  ['code map history written', fs.existsSync(codeMapHistoryPath) && fs.readFileSync(codeMapHistoryPath, 'utf8').trim().split(/\r?\n/).length === 1],
  ['diff summary written', fs.existsSync(path.join(outDir, 'diff-summary.md'))],
  ['telemetry written', fs.existsSync(path.join(outDir, 'context-telemetry.json'))],
  ['telemetry linked', synthesis.context_telemetry_path.endsWith('context-telemetry.json')],
  ['latest insights linked', synthesis.latest_insights_path.endsWith('latest-insights.md')],
  ['latest insights report linked', synthesis.latest_insights_report_path.endsWith('latest-insights-report.json')],
  ['user profile linked', synthesis.user_profile_path.endsWith('user-profile.md') && synthesis.user_profile_report && typeof synthesis.user_profile_report.injected === 'boolean'],
  ['project operating model linked', synthesis.project_operating_model_path.endsWith('project-operating-model.md') && synthesis.project_operating_model_report && synthesis.project_operating_model_report.status],
  ['architecture intelligence linked', synthesis.architecture_intelligence_path.endsWith('architecture-intelligence.md') && synthesis.architecture_intelligence_report && synthesis.architecture_intelligence_report.architecture.status === 'present' && synthesis.architecture_intelligence_report.ownership.status === 'present' && synthesis.architecture_intelligence_report.invocation.status === 'present'],
  ['lean guidance linked', synthesis.lean_guidance_path.endsWith('lean-guidance.md') && synthesis.lean_guidance_report && synthesis.lean_guidance_report.injected === true && synthesis.lean_guidance_report.gates.telemetry_ready === true],
  ['lean policy profile linked', synthesis.lean_guidance_report.policy && synthesis.lean_guidance_report.policy.profile === 'strict' && synthesis.lean_guidance_report.gates.lean_policy_allows_guidance === true],
  ['lean guidance names mode', leanGuidance.includes('Lean mode: strict (lean-policy).')],
  ['latest failure digest linked', synthesis.latest_failure_digest_path && synthesis.latest_failure_digest_path.endsWith('failure-digest.md')],
  ['latest failure digest freshness linked', synthesis.latest_failure_digest_freshness && synthesis.latest_failure_digest_freshness.status === 'attention'],
  ['latest failure digest triage linked', synthesis.latest_failure_digest_triage && synthesis.latest_failure_digest_triage.state === 'stale' && synthesis.latest_failure_digest_triage.usefulness === 'limited'],
  ['packet artifact manifest linked', synthesis.packet_artifact_manifest_path && synthesis.packet_artifact_manifest_path.endsWith('packet-artifacts.json')],
  ['agent context contract linked', synthesis.agent_context_contract_path && synthesis.agent_context_contract_path.endsWith('agent-context-contract.json')],
  ['agent context contract written', agentContextContract.agents && agentContextContract.agents.warden_reviewer && agentContextContract.agents.warden_reviewer.prohibited_uses.length > 0],
  ['agent context contracts in synthesis', synthesis.agent_context_contracts && synthesis.agent_context_contracts.warden_reviewer && synthesis.agent_context_contracts.warden_reviewer.allowed_signals.includes('latest-failure-digest')],
  ['agent context contracts verify operating model', synthesis.agent_context_contracts.warden_reviewer.verify_before_use.includes('project-operating-model')],
  ['agent context contracts verify architecture intelligence', synthesis.agent_context_contracts.warden_reviewer.verify_before_use.includes('architecture-intelligence') && synthesis.agent_context_contracts.warden_reviewer.advisory_signals.includes('architecture-intelligence')],
  ['agent context contracts verify lean guidance', synthesis.agent_context_contracts.warden_reviewer.verify_before_use.includes('lean-guidance') && synthesis.agent_context_contracts.warden_reviewer.advisory_signals.includes('lean-guidance')],
  ['packet artifact manifest written', artifactManifest.artifacts.some((item) => item.name === 'latest-failure-digest' && item.decision === 'metadata-only' && item.reason === 'digest-stale')],
  ['packet artifact manifest markdown written', artifactManifestMarkdown.includes('| latest-failure-digest | metadata-only | digest-stale | forgeflow-failure-digest |')],
  ['packet artifact manifest covers latest insights', artifactManifest.artifacts.some((item) => item.name === 'latest-insights' && item.decision === 'included' && item.status === 'injected')],
  ['packet artifact manifest covers user profile', artifactManifest.artifacts.some((item) => item.name === 'user-profile' && ['included', 'metadata-only'].includes(item.decision) && item.status)],
  ['packet artifact manifest covers operating model', artifactManifest.artifacts.some((item) => item.name === 'project-operating-model' && item.decision === 'included' && item.confidence)],
  ['packet artifact manifest covers architecture intelligence', artifactManifest.artifacts.some((item) => item.name === 'architecture-intelligence' && item.decision === 'included' && item.reason === 'architecture-intelligence-3-of-3-present')],
  ['packet artifact manifest covers lean guidance', artifactManifest.artifacts.some((item) => item.name === 'lean-guidance' && item.decision === 'included' && item.reason === 'lean-guidance-quality-gates-passing')],
  ['packet artifact manifest covers topology provenance', artifactManifest.artifacts.some((item) => item.name === 'code-topology' && item.decision === 'included' && item.provenance && item.provenance.source === 'build-context-pack')],
  ['project code map linked to current pack', synthesis.project_code_map_path === path.relative(repoRoot, path.join(outDir, 'project-code-map.md'))],
  ['project code topology linked to current pack', synthesis.project_code_topology_path === synthesis.code_topology_path],
  ['code topology linked', synthesis.code_topology_path.endsWith('code-topology.json')],
  ['code topology review focus linked', synthesis.code_topology_review_focus_path.endsWith('code-topology-review-focus.md')],
  ['code topology provenance linked', synthesis.code_topology_provenance && synthesis.code_topology_provenance.source === 'build-context-pack'],
  ['code topology history linked', synthesis.code_topology_history && synthesis.code_topology_history.recorded === true && synthesis.code_topology_history.path.endsWith('code-map-history.jsonl')],
  ['code topology summary linked', synthesis.code_topology_summary.available === true && synthesis.code_topology_summary.paths.review_focus.endsWith('code-topology-review-focus.md')],
  ['living map guidance linked', synthesis.living_map_guidance && synthesis.living_map_guidance.status && synthesis.living_map_guidance.caveat.includes('Static JS/TS import') && Array.isArray(synthesis.living_map_guidance.categories)],
  ['code topology summary has provenance', synthesis.code_topology_summary.provenance && synthesis.code_topology_summary.provenance.source === 'build-context-pack'],
  ['code topology summary has history', synthesis.code_topology_summary.history && synthesis.code_topology_summary.history.recorded === true],
  ['code topology summary has hotspots', synthesis.code_topology_summary.high_fan_in.length > 0 && synthesis.code_topology_summary.high_fan_out.length > 0],
  ['code topology summary has neighbor list', Array.isArray(synthesis.code_topology_summary.changed_file_neighbors)],
  ['code topology summary has route guidance', topologyGuidanceSynthesis.code_topology_summary.changed_file_neighbors.some((item) => item.review_guidance && item.review_guidance.route_hints.length > 0)],
  ['code topology summary has section count', Number.isInteger(synthesis.code_topology_summary.summary.sections)],
  ['code topology summary has changed section count', Number.isInteger(synthesis.code_topology_summary.summary.changed_sections)],
  ['code topology summary has section ranges', synthesis.code_topology_summary.changed_file_neighbors.every((item) => (item.sections || []).every((section) => Number.isInteger(section.end_line)))],
  ['agent packet includes latest insights', wardenPacket.includes('## Latest Insights')],
  ['agent packet includes user profile guidance', wardenPacket.includes('## User Profile Guidance') && userProfile.includes('Forgeflow User Profile')],
  ['agent packet includes operating model guidance', wardenPacket.includes('## Project Operating Model') && projectOperatingModel.includes('High-care files:') && projectOperatingModel.includes('Proof boundary:') && wardenPacket.includes('project-operating-model')],
  ['agent packet includes architecture intelligence', wardenPacket.includes('## Architecture Intelligence') && wardenPacket.includes('Proof boundary: Advisory static architecture') && wardenPacket.includes('src/auth/session.ts') && wardenPacket.includes('run hint: npm test')],
  ['agent packet includes lean guidance', wardenPacket.includes('## Lean Guidance') && wardenPacket.includes('Advisory lean delivery guidance only') && leanGuidance.includes('context saved tokens: 9000')],
  ['agent packet includes artifact trust manifest', wardenPacket.includes('## Packet Artifact Trust') && wardenPacket.includes('| latest-failure-digest | metadata-only | digest-stale | forgeflow-failure-digest |')],
  ['agent packet includes context contract', wardenPacket.includes('## Agent Context Contract') && wardenPacket.includes('Do not override current user instructions')],
  ['agent packet gates stale failure digest body', wardenPacket.includes('## Latest Failure Digest') && wardenPacket.includes('Freshness: attention') && wardenPacket.includes('Triage state: stale') && wardenPacket.includes('Digest body skipped') && !wardenPacket.includes('FAIL context packet fixture')],
  ['agent packet latest insights omit stale topology', !wardenPacket.includes('legacy/stale-topology.js')],
  ['agent packet includes current project code map', wardenPacket.includes('## Project Code Map') && wardenPacket.includes('Artifact:') && wardenPacket.includes('code-topology.json')],
  ['agent packet includes living map guidance', wardenPacket.includes('## Living Map Guidance') && wardenPacket.includes('prioritize review attention only') && wardenPacket.includes('not findings') && wardenPacket.includes('not a runtime call graph')],
  ['agent packet includes provenance', wardenPacket.includes('Provenance:')],
  ['agent packet omits stale project code map', !wardenPacket.includes('Sections mapped: 12')],
  ['agent packet includes code topology', wardenPacket.includes('## Code Topology') && wardenPacket.includes('sections') && wardenPacket.includes('static JS/TS import graph only')],
  ['agent packet includes topology-guided review focus', topologyGuidancePacket.includes('## Code Topology') && topologyGuidancePacket.includes('topology-guided focus') && topologyGuidancePacket.includes('topology hint')],
  ['agent packet escapes markdown paths', wardenPacket.includes('src/auth/session\\.ts')],
  ['telemetry token estimate', Number.isInteger(telemetry.estimated_compact_tokens)],
  ['code topology includes changed files', topology.changed_files.includes('src/auth/session.ts')],
  ['code topology context uses compact scope', topology.scope === 'changed-neighborhood'],
  ['latest insights report has status', ['injected', 'missing', 'blocked', 'error'].includes(insightsReport.status)],
  ['latest insights report has provenance', insightsReport.generated_at && insightsReport.git && insightsReport.git.available === true && typeof insightsReport.git.commit_short === 'string'],
  ['noisy manifest sanitized', noisyManifest.files.length === 3],
  ['no noisy decoration in manifest', !noisyManifest.files.some((file) => file.path.includes('Changes') || file.path.includes('|'))],
  ['noisy result full mode', noisyResult.route.mode === 'full-mode'],
  ['explicit root preserved from unrelated cwd', explicitRootResult.root === explicitRoot && explicitRootResult.synthesis_input.repo_root === explicitRoot],
  ['explicit root reports project dir', explicitRootResult.project_dir === path.join(explicitRoot, '.forgeflow', path.basename(explicitRoot)) && explicitRootResult.synthesis_input.project_dir === explicitRootResult.project_dir],
  ['explicit root changed files captured', explicitRootResult.route.files.includes('src/app.ts') && explicitRootResult.route.files.includes('src/new.ts')],
  ['explicit root untracked lines captured', explicitRootResult.route.untracked_lines > 0],
  ['explicit root manifest resolves files', explicitRootResult.manifest.some((file) => file.path === 'src/new.ts' && file.exists === true)],
  ['explicit root explicit line sources preserved', explicitRootCliJson && explicitRootCliJson.lines_changed === 3 && explicitRootCliJson.tracked_lines === 2 && explicitRootCliJson.untracked_lines === 1],
  ['passing insights include project guidance', passingInsights.includes('Check docs drift before release.')],
  ['passing insights report injected', passingInsightsResult.report.status === 'injected' && passingInsightsResult.report.check_status === 'pass'],
  ['blocked insights use quality gate', blockedInsights.includes('Quality Gate') && blockedInsights.includes('quality check returned FAIL')],
  ['blocked insights report explains reason', blockedInsightsResult.report.status === 'blocked' && blockedInsightsResult.report.issues.some((issue) => issue.code === 'candidate-category-invalid')],
  ['blocked insights omit malformed candidate body', !blockedInsights.includes('This malformed candidate should block injection.')],
  ['compact project code map renders', compactMap.includes('Sections mapped: 12')],
  ['cli json exposes code topology', cliJson.code_topology.available === true && cliJson.code_topology.paths.graph.endsWith('code-topology.json')],
  ['cli root override works from unrelated cwd', explicitRootCliJson.root === explicitRoot && explicitRootCliJson.files.includes('src/app.ts') && explicitRootCliJson.files.includes('src/new.ts')],
  ['untracked file included in diff summary', untrackedCli.status === 0 && untrackedDiffSummary.includes('?? untracked-helper.js')],
  ['ci budget violation fails predictably', budgetCli.status === 1 && budgetCli.stderr.includes('Context pack budget exceeded')],
  ['symlink context pack destination blocked', symlinkPackBlocked && fs.readFileSync(outsideDiff, 'utf8') === 'do not overwrite\n'],
  ['symlink memory fallback does not leak', symlinkMemoryCli.status === 0 && !symlinkMemoryHits.includes('TOP_SECRET_MARKER') && !symlinkMemoryPackets.includes('TOP_SECRET_MARKER') && symlinkMemorySynthesis.memory_index_path === null && symlinkMemoryResult.route && symlinkMemoryResult.route.mode],
  ['symlink memory index does not leak', symlinkIndexCli.status === 0 && !symlinkIndexHits.includes('TOP_SECRET_INDEX_MARKER')],
  ['symlink project root latest insights does not leak', symlinkProjectCli.status === 0 && !symlinkProjectLatest.includes('TOP_SECRET_PROJECT_ROOT_MARKER')],
  ['symlink project root memory does not leak', symlinkProjectCli.status === 0 && !symlinkProjectHits.includes('TOP_SECRET_PROJECT_ROOT_MARKER') && !symlinkProjectPackets.includes('TOP_SECRET_PROJECT_ROOT_MARKER')],
  ['symlink out ancestor blocked', symlinkOutCli.status === 1 && symlinkOutCli.stderr.includes('symlinked directory')],
  ['invalid failure digest triage linked', invalidDigestSynthesis.latest_failure_digest_triage && invalidDigestSynthesis.latest_failure_digest_triage.state === 'invalid' && invalidDigestSynthesis.latest_failure_digest_triage.usefulness === 'not-usable'],
  ['invalid failure digest artifact metadata-only', invalidDigestSynthesis.packet_artifacts.some((item) => item.name === 'latest-failure-digest' && item.decision === 'metadata-only' && item.reason === 'digest-invalid')],
  ['invalid failure digest packet includes triage', invalidDigestPacket.includes('Triage state: invalid') && invalidDigestPacket.includes('Usefulness: not-usable')],
  ['raw-required failure digest artifact metadata-only', rawDigestSynthesis.packet_artifacts.some((item) => item.name === 'latest-failure-digest' && item.decision === 'metadata-only' && item.reason === 'digest-raw-required' && item.next_action === 'inspect-raw-failure-output')],
  ['raw-required failure digest body not injected', rawDigestPacket.includes('Triage state: raw-required') && rawDigestPacket.includes('Digest body skipped') && !rawDigestPacket.includes('RAW_SECRET_PACKET_MARKER')],
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

console.log('context pack: ok');
