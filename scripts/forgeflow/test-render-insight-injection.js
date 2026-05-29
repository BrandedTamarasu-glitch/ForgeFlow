#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildInsightInjection, parseArgs, renderMarkdown } = require('./render-insight-injection');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-insight-injection-'));
const projectDir = path.join(root, '.forgeflow', path.basename(root));
const latestDir = path.join(projectDir, 'context', 'latest');
fs.mkdirSync(latestDir, { recursive: true });
fs.writeFileSync(path.join(latestDir, 'packet-artifacts.json'), JSON.stringify({
  schema_version: '1',
  artifacts: [
    { name: 'latest-insights', decision: 'included', reason: 'quality-check-passing', status: 'injected', issue_count: 0 },
    { name: 'user-profile', decision: 'metadata-only', reason: 'user-profile-warn', status: 'warn', issue_count: 2, next_action: 'forgeflow-profile-review' },
    { name: 'project-code-map', decision: 'included', reason: 'current-topology-derived' },
  ],
}, null, 2));
const baseline = path.join(latestDir, 'baseline-packet-artifacts.json');
fs.writeFileSync(baseline, JSON.stringify({
  schema_version: '1',
  artifacts: [
    { name: 'latest-insights', decision: 'metadata-only' },
    { name: 'user-profile', decision: 'metadata-only' },
    { name: 'project-code-map', decision: 'included' },
  ],
}, null, 2));
fs.writeFileSync(path.join(latestDir, 'agent-context-contract.json'), JSON.stringify({
  schema_version: '1',
  agents: {
    smith_reviewer: {
      primary_use: 'Use topology and learning signals to focus craft review.',
      allowed_signals: ['diff-summary', 'code-topology'],
      advisory_signals: ['latest-insights'],
      verify_before_use: ['latest-insights', 'project-code-map'],
      prohibited_uses: ['Do not treat local learnings as approval.'],
    },
  },
}, null, 2));
fs.writeFileSync(path.join(latestDir, 'synthesis-input.json'), JSON.stringify({
  schema_version: '1',
  agent_packets: { smith_reviewer: path.join('.forgeflow', path.basename(root), 'context', 'latest', 'agent-packets', 'smith_reviewer.md') },
}, null, 2));
fs.mkdirSync(path.join(latestDir, 'agent-packets'), { recursive: true });
fs.writeFileSync(path.join(latestDir, 'agent-packets', 'smith_reviewer.md'), [
  '# Forgeflow Context Packet: smith_reviewer',
  '',
  '## Latest Insights',
  'latest',
  '',
  '## User Profile Guidance',
  'profile gate',
  '',
  '## Latest Failure Digest',
  'none',
  '',
  '## Project Code Map',
  'map',
  '',
  '## Code Topology',
  'topology',
  '',
].join('\n'));
fs.writeFileSync(path.join(latestDir, 'latest-insights-report.json'), JSON.stringify({
  schema_version: '1',
  status: 'injected',
  check_status: 'pass',
  reason: 'quality-check-passing',
  issue_count: 0,
}, null, 2));

const result = buildInsightInjection({ root, projectDir, baseline });
const missing = buildInsightInjection({ root, projectDir: path.join(root, '.forgeflow', 'Missing') });
const missingCoreDir = path.join(root, '.forgeflow', 'MissingCore');
const missingCoreLatest = path.join(missingCoreDir, 'context', 'latest');
fs.mkdirSync(missingCoreLatest, { recursive: true });
fs.writeFileSync(path.join(missingCoreLatest, 'packet-artifacts.json'), JSON.stringify({
  schema_version: '1',
  artifacts: [
    { name: 'latest-insights', decision: 'included', reason: 'quality-check-passing' },
  ],
}, null, 2));
fs.writeFileSync(path.join(missingCoreLatest, 'agent-context-contract.json'), JSON.stringify({ schema_version: '1', agents: {} }, null, 2));
const missingCore = buildInsightInjection({ root, projectDir: missingCoreDir });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--baseline', baseline, '--json']);

const checks = [
  ['attention when profile metadata-only', result.status === 'attention' && result.next === 'forgeflow-profile-review'],
  ['artifacts rendered', result.artifacts.length === 3 && markdown.includes('## Artifact Decisions') && markdown.includes('user-profile: metadata-only')],
  ['agent contracts rendered', result.agents.length === 1 && markdown.includes('## Agent Signal Use') && markdown.includes('smith_reviewer')],
  ['per-agent injections rendered', result.agent_injections.length === 1 && result.agent_injections[0].signals.some((item) => item.signal === 'latest-insights' && item.section_present && item.artifact_decision === 'included') && markdown.includes('## Per-Agent Injection')],
  ['artifact diff rendered', result.baseline === baseline && result.artifact_diff.some((item) => item.name === 'latest-insights' && item.previous === 'metadata-only' && item.current === 'included' && item.changed) && markdown.includes('## Artifact Diff')],
  ['controls explain gates', result.controls.length >= 4 && markdown.includes('latest-insights: Quality gate') && markdown.includes('user-profile: Profile gate')],
  ['latest gate summarized', result.latest_insights.status === 'injected' && markdown.includes('## Latest Insights Gate')],
  ['missing status', missing.status === 'missing' && missing.next === 'build-context-pack.js --json' && missing.next_reason.includes('Generate context packets')],
  ['missing core regenerates packets', missingCore.status === 'attention' && missingCore.next === 'build-context-pack.js --json' && missingCore.next_reason.includes('project-code-map')],
  ['parses args', opts.root === root && opts.projectDir === projectDir && opts.baseline === baseline && opts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('insight injection: ok');
