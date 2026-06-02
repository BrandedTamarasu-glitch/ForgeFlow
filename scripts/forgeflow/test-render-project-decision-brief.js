#!/usr/bin/env node
const path = require('path');
const {
  buildProjectDecisionBrief,
  firstMarkdownBullets,
  parseArgs,
  renderMarkdown,
  topologySummary,
} = require('./render-project-decision-brief');

const learningsText = `# Project Learnings

## Stable Decisions

- Keep command wrappers strict.

## Risk Areas

- Broad review command argument parsing.

## Validation Patterns

- Run wrapper contract after command edits.
`;
const ready = buildProjectDecisionBrief({
  root: '.',
  projectDir: '.forgeflow/Demo',
  learningsText,
  latestInsights: { status: 'injected' },
  topology: { source_files: 12, local_edges: 4, central_files: [{ file: 'commands/review.md' }] },
  healthTimeline: { status: 'present' },
});
const withRecentHealth = buildProjectDecisionBrief({
  root: '.',
  projectDir: '.forgeflow/Demo',
  learningsText,
  latestInsights: { status: 'injected' },
  topology: { source_files: 12, local_edges: 4, central_files: [{ file: 'commands/review.md' }] },
  healthTimeline: { status: 'present', events: [{ status: 'pass', command: '/forgeflow-health' }] },
});
const withRecentTopology = buildProjectDecisionBrief({
  root: '.',
  projectDir: '.forgeflow/Demo',
  learningsText,
  latestInsights: { status: 'injected' },
  topology: {
    source_files: 12,
    local_edges: 4,
    changed_sections: { 'scripts/forgeflow/foo.js': [{ name: 'buildFoo', line: 10 }] },
    changed_files: ['scripts/forgeflow/bar.js'],
  },
  healthTimeline: { status: 'present' },
});
const withChangedFiles = buildProjectDecisionBrief({
  root: '.',
  projectDir: '.forgeflow/Demo',
  learningsText,
  latestInsights: { status: 'injected' },
  topology: { source_files: 12, local_edges: 4, changed_files: ['scripts/forgeflow/bar.js'] },
  healthTimeline: { status: 'present' },
});
const missing = buildProjectDecisionBrief({
  root: '.',
  projectDir: '.forgeflow/Demo',
  learningsText: '',
  latestInsights: null,
  topology: null,
  healthTimeline: null,
});
const healthOnlyMissing = buildProjectDecisionBrief({
  root: '.',
  projectDir: '.forgeflow/Demo',
  learningsText,
  latestInsights: { status: 'injected' },
  topology: { summary: { source_files: 9, local_edges: 3 }, high_fan_in: [{ file: 'scripts/forgeflow/render-project-decision-brief.js' }] },
  healthTimeline: null,
});
const markdown = renderMarkdown(ready);
const opts = parseArgs(['--root', '.', '--project-dir', '.forgeflow/Demo', '--json']);

const checks = [
  ['extracts section bullets', firstMarkdownBullets(learningsText, 'Risk Areas')[0].includes('Broad review')],
  ['summarizes topology', topologySummary({ source_files: 1, local_edges: 2, central_files: ['a.js'] }).hot_files[0] === 'a.js'],
  ['summarizes nested topology summary', topologySummary({ summary: { source_files: 9, local_edges: 3 }, high_fan_in: [{ file: 'hub.js' }] }).summary === '9 source files, 3 local edges.' && topologySummary({ summary: { source_files: 9, local_edges: 3 }, high_fan_in: [{ file: 'hub.js' }] }).hot_files[0] === 'hub.js'],
  ['ready brief uses local signals', ready.status === 'ready' && ready.recommendations.some((item) => item.includes('commands/review.md'))],
  ['adds explicit decision guidance', ready.decision_brief.avoid_first[0].includes('Broad review') && ready.validate_first[0].includes('wrapper contract') && ready.care_files[0] === 'commands/review.md'],
  ['summarizes recent health changes', withRecentHealth.recent_changes[0] === 'pass: /forgeflow-health'],
  ['falls back to topology changes', withRecentTopology.recent_changes[0].includes('scripts/forgeflow/foo.js')],
  ['falls back to changed files', withChangedFiles.recent_changes[0].includes('scripts/forgeflow/bar.js')],
  ['missing artifacts warn', missing.status === 'attention' && missing.next_command === '/forgeflow-trends --refresh'],
  ['health timeline alone warns', healthOnlyMissing.status === 'attention' && healthOnlyMissing.warnings.includes('health-timeline-missing')],
  ['renders markdown', markdown.includes('# Forgeflow Project Decision Brief') && markdown.includes('## Avoid First') && markdown.includes('## Care Files')],
  ['parses args', opts.root === path.resolve('.') && opts.projectDir === path.resolve('.forgeflow/Demo') && opts.json === true],
  ['boundary read-only', ready.boundary.includes('read-only') && ready.boundary.includes('does not refresh')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('project decision brief: ok');
