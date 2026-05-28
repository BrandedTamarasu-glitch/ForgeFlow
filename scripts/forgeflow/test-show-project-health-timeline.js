#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildProjectHealthTimeline, parseArgs, renderMarkdown } = require('./show-project-health-timeline');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-health-timeline-'));
const projectDir = path.join(root, '.forgeflow', path.basename(root));
const contextDir = path.join(projectDir, 'context');
fs.mkdirSync(path.join(contextDir, 'latest'), { recursive: true });
fs.writeFileSync(path.join(contextDir, 'code-map-history.jsonl'), `${JSON.stringify({
  summary: {
    generated_at: '2026-05-28T00:00:00Z',
    provenance: { commit_short: 'abc1234', dirty: false },
    summary: { source_files: 4, local_edges: 3, changed_sections: 1 },
  },
})}\n${JSON.stringify({
  summary: {
    generated_at: '2026-05-28T00:02:00Z',
    provenance: { commit_short: 'def5678', dirty: false },
    summary: { source_files: 5, local_edges: 4, changed_sections: 0 },
  },
})}\n`);
fs.writeFileSync(path.join(projectDir, 'project-learnings.md'), [
  '# Forgeflow Project Learnings',
  '',
  'Project learnings are guidance only. Verify current code, tests, and review artifacts before relying on them.',
  '',
  '## Recurring Pitfalls',
  '- Watch release doc drift.',
  '',
  '## Stable Decisions',
  '- Keep timeline local.',
  '',
  '## Risk Areas',
  '- Timeline freshness can be stale.',
  '',
  '## Validation Patterns',
  '- Run timeline tests.',
  '',
  '## Hot Files And Modules',
  '- scripts/forgeflow/show-project-health-timeline.js',
  '',
  '## Repeated Follow-ups',
  '- Recheck docs.',
  '',
  '## Recommended Approach For Next Work',
  '- Use advisory timeline only.',
  '',
].join('\n'));
fs.writeFileSync(path.join(projectDir, 'project-learning-candidates.jsonl'), [
  { category: 'recurring-pitfall', learning: 'Watch release doc drift.' },
  { category: 'stable-decision', learning: 'Keep timeline local.' },
  { category: 'risk-area', learning: 'Timeline freshness can be stale.' },
  { category: 'validation-pattern', learning: 'Run timeline tests.' },
  { category: 'hot-file', learning: 'scripts/forgeflow/show-project-health-timeline.js' },
  { category: 'repeated-follow-up', learning: 'Recheck docs.' },
  { category: 'recommended-approach', learning: 'Use advisory timeline only.' },
].map((item) => JSON.stringify(item)).join('\n') + '\n');
fs.writeFileSync(path.join(contextDir, 'latest', 'latest-insights-report.json'), JSON.stringify({
  schema_version: '1',
  generated_at: '2026-05-28T00:01:00Z',
  status: 'injected',
  reason: 'quality-check-passing',
  issue_count: 0,
}, null, 2));

const result = buildProjectHealthTimeline({ root, projectDir });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--json']);

const checks = [
  ['schema version', result.schema_version === '1'],
  ['timeline has events', result.event_count >= 3 && result.events.some((event) => event.kind === 'code-map') && result.events.some((event) => event.kind === 'learning-status')],
  ['timeline has deltas', result.deltas.some((item) => item.kind === 'code-map')],
  ['renders markdown', markdown.includes('# Forgeflow Project Health Timeline') && markdown.includes('## Deltas') && markdown.includes('advisory') && markdown.includes('code-map')],
  ['parses args', opts.root === root && opts.projectDir === projectDir && opts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('project health timeline: ok');
