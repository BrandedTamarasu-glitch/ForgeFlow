#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildContextPack, buildLatestInsights, buildLatestInsightsResult, compactProjectCodeMap } = require('./build-context-pack');

const repoRoot = path.resolve(__dirname, '..', '..');
const repoProjectContextDir = path.join(repoRoot, '.forgeflow', path.basename(repoRoot), 'context');
fs.mkdirSync(repoProjectContextDir, { recursive: true });
const seededProjectCodeMapPath = path.join(repoProjectContextDir, 'project-code-map.md');
const seededTopologyPath = path.join(repoProjectContextDir, 'code-topology.json');
const previousProjectCodeMap = fs.existsSync(seededProjectCodeMapPath)
  ? fs.readFileSync(seededProjectCodeMapPath, 'utf8')
  : null;
const previousTopology = fs.existsSync(seededTopologyPath)
  ? fs.readFileSync(seededTopologyPath, 'utf8')
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
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-pack-'));
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
const cli = spawnSync(path.join(repoRoot, 'scripts/forgeflow/build-context-pack.js'), [
  '--files',
  path.join(repoRoot, 'fixtures/context-pack/review.files'),
  '--lines',
  '80',
  '--task',
  'Review login flow token load context packing',
  '--out',
  cliOutDir,
  '--json',
], {
  cwd: repoRoot,
  encoding: 'utf8',
});
const cliJson = cli.status === 0 ? JSON.parse(cli.stdout) : null;

const route = JSON.parse(fs.readFileSync(path.join(outDir, 'route.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'file-manifest.json'), 'utf8'));
const synthesis = JSON.parse(fs.readFileSync(path.join(outDir, 'synthesis-input.json'), 'utf8'));
const telemetry = JSON.parse(fs.readFileSync(path.join(outDir, 'context-telemetry.json'), 'utf8'));
const insightsReport = JSON.parse(fs.readFileSync(path.join(outDir, 'latest-insights-report.json'), 'utf8'));
const topology = JSON.parse(fs.readFileSync(path.join(outDir, 'code-topology.json'), 'utf8'));
const noisyManifest = JSON.parse(fs.readFileSync(path.join(noisyOutDir, 'file-manifest.json'), 'utf8'));
const wardenPacket = fs.readFileSync(path.join(repoRoot, synthesis.agent_packets.warden_reviewer), 'utf8');
const compactMap = compactProjectCodeMap(repoRoot);
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
  ['code topology written', fs.existsSync(path.join(outDir, 'code-topology.json'))],
  ['code topology review focus written', fs.existsSync(path.join(outDir, 'code-topology-review-focus.md'))],
  ['code topology telemetry written', fs.existsSync(path.join(outDir, 'code-topology-telemetry.json'))],
  ['diff summary written', fs.existsSync(path.join(outDir, 'diff-summary.md'))],
  ['telemetry written', fs.existsSync(path.join(outDir, 'context-telemetry.json'))],
  ['telemetry linked', synthesis.context_telemetry_path.endsWith('context-telemetry.json')],
  ['latest insights linked', synthesis.latest_insights_path.endsWith('latest-insights.md')],
  ['latest insights report linked', synthesis.latest_insights_report_path.endsWith('latest-insights-report.json')],
  ['project code map linked to current pack', synthesis.project_code_map_path === path.relative(repoRoot, path.join(outDir, 'project-code-map.md'))],
  ['project code topology linked to current pack', synthesis.project_code_topology_path === synthesis.code_topology_path],
  ['code topology linked', synthesis.code_topology_path.endsWith('code-topology.json')],
  ['code topology review focus linked', synthesis.code_topology_review_focus_path.endsWith('code-topology-review-focus.md')],
  ['code topology provenance linked', synthesis.code_topology_provenance && synthesis.code_topology_provenance.source === 'build-context-pack'],
  ['code topology summary linked', synthesis.code_topology_summary.available === true && synthesis.code_topology_summary.paths.review_focus.endsWith('code-topology-review-focus.md')],
  ['code topology summary has provenance', synthesis.code_topology_summary.provenance && synthesis.code_topology_summary.provenance.source === 'build-context-pack'],
  ['code topology summary has hotspots', synthesis.code_topology_summary.high_fan_in.length > 0 && synthesis.code_topology_summary.high_fan_out.length > 0],
  ['code topology summary has neighbor list', Array.isArray(synthesis.code_topology_summary.changed_file_neighbors)],
  ['code topology summary has section count', Number.isInteger(synthesis.code_topology_summary.summary.sections)],
  ['code topology summary has changed section count', Number.isInteger(synthesis.code_topology_summary.summary.changed_sections)],
  ['code topology summary has section ranges', synthesis.code_topology_summary.changed_file_neighbors.every((item) => (item.sections || []).every((section) => Number.isInteger(section.end_line)))],
  ['agent packet includes latest insights', wardenPacket.includes('## Latest Insights')],
  ['agent packet latest insights omit stale topology', !wardenPacket.includes('legacy/stale-topology.js')],
  ['agent packet includes current project code map', wardenPacket.includes('## Project Code Map') && wardenPacket.includes('Artifact:') && wardenPacket.includes('code-topology.json')],
  ['agent packet includes provenance', wardenPacket.includes('## Provenance') && wardenPacket.includes('Provenance:')],
  ['agent packet omits stale project code map', !wardenPacket.includes('Sections mapped: 12')],
  ['agent packet includes code topology', wardenPacket.includes('## Code Topology') && wardenPacket.includes('sections') && wardenPacket.includes('static JS/TS import graph only')],
  ['agent packet escapes markdown paths', wardenPacket.includes('src/auth/session\\.ts')],
  ['telemetry token estimate', Number.isInteger(telemetry.estimated_compact_tokens)],
  ['code topology includes changed files', topology.changed_files.includes('src/auth/session.ts')],
  ['code topology context uses compact scope', topology.scope === 'changed-neighborhood'],
  ['latest insights report has status', ['injected', 'missing', 'blocked', 'error'].includes(insightsReport.status)],
  ['noisy manifest sanitized', noisyManifest.files.length === 3],
  ['no noisy decoration in manifest', !noisyManifest.files.some((file) => file.path.includes('Changes') || file.path.includes('|'))],
  ['noisy result full mode', noisyResult.route.mode === 'full-mode'],
  ['passing insights include project guidance', passingInsights.includes('Check docs drift before release.')],
  ['passing insights report injected', passingInsightsResult.report.status === 'injected' && passingInsightsResult.report.check_status === 'pass'],
  ['blocked insights use quality gate', blockedInsights.includes('Quality Gate') && blockedInsights.includes('quality check returned FAIL')],
  ['blocked insights report explains reason', blockedInsightsResult.report.status === 'blocked' && blockedInsightsResult.report.issues.some((issue) => issue.code === 'candidate-category-invalid')],
  ['blocked insights omit malformed candidate body', !blockedInsights.includes('This malformed candidate should block injection.')],
  ['compact project code map renders', compactMap.includes('Sections mapped: 12')],
  ['cli json exposes code topology', cli.status === 0 && cliJson.code_topology.available === true && cliJson.code_topology.paths.graph.endsWith('code-topology.json')],
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
