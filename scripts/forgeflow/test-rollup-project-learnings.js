#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  buildRollup,
  containsSensitiveContent,
  parseImplementationNotes,
  rollupProjectLearnings,
} = require('./rollup-project-learnings');

const repoRoot = path.resolve(__dirname, '..', '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-project-learnings-'));
const projectDir = path.join(tmp, '.forgeflow', 'Demo');
const shipDir = path.join(projectDir, 'ship');
const contextDir = path.join(projectDir, 'context');
fs.mkdirSync(shipDir, { recursive: true });
fs.mkdirSync(contextDir, { recursive: true });

fs.writeFileSync(path.join(projectDir, 'implementation-notes.md'), [
  '# Implementation Notes',
  '',
  '## Decisions',
  '',
  '- 2026-05-19T00:00:00Z | Atlas | decision | Markdown stays canonical Why: local state should stay editable',
  '',
  '## Spec Gaps',
  '',
  '- 2026-05-19T00:00:00Z | Compass | spec-gap | Release-helper changes needed matching manifest and docs updates',
  '- None. (Compass stale read was resolved before integration.)',
  '- token: SHOULD_NOT_RENDER',
  '',
  '## Tradeoffs',
  '',
  '- Manual rollups are deterministic instead of model-generated',
  '',
  '## Deviations',
  '',
  '- Ship metadata was missing for one trial',
  '- None from the design.',
  '',
  '## Follow-ups',
  '',
  '- Keep README and wiki entry points aligned',
  '',
  '## Validation Notes',
  '',
  '- Run focused helper tests plus the release-check equivalent',
  '',
].join('\n'));

fs.writeFileSync(path.join(projectDir, 'review-outcomes.jsonl'), `${JSON.stringify({
  schema_version: '1',
  change_id: 'one',
  review: {
    mode: 'full-mode',
    workflow: 'forgeflow',
    agents_used: ['smith'],
    verifier_decisions: [],
  },
  outcome: {
    findings_total: 2,
    findings_confirmed: 2,
    findings_rejected: 0,
    review_minutes: 15,
    auto_fix_success: false,
    post_merge_regression: false,
    finding_classes: [
      { class: 'docs-drift', total: 2, confirmed: 2, rejected: 0 },
    ],
  },
})}\n`);
fs.writeFileSync(path.join(projectDir, 'project-learning-candidates.jsonl'), [
  JSON.stringify({
    schema_version: '1',
    category: 'validation-pattern',
    learning: 'Record structured candidates before refreshing project learnings',
    source: 'Atlas',
    confidence: 'high',
    evidence_count: 2,
    application_guidance: 'Use this before release readiness claims.',
  }),
  JSON.stringify({
    schema_version: '1',
    category: 'recommended-approach',
    learning: 'Review structured candidates before expanding learning automation',
    source: 'Arbiter',
    confidence: 'low',
    evidence_count: 1,
    application_guidance: 'Treat as planning guidance until it repeats.',
  }),
  JSON.stringify({
    schema_version: '1',
    category: 'hot-file',
    learning: 'scripts/forgeflow/rollup-project-learnings.js',
    source: 'Atlas',
    confidence: 'medium',
    evidence_count: 3,
  }),
  JSON.stringify({
    schema_version: '1',
    category: 'recommended-approach',
    learning: 'Use the old context heuristic before planning',
    source: 'Atlas',
    confidence: 'high',
    evidence_count: 4,
    status: 'superseded',
    superseded_by: 'Use project intelligence rollup guidance instead.',
  }),
  JSON.stringify({
    schema_version: '1',
    category: 'risk-area',
    learning: 'Obsolete review-risk signal',
    source: 'Atlas',
    confidence: 'medium',
    evidence_count: 5,
    status: 'stale',
  }),
  JSON.stringify({
    schema_version: '1',
    category: 'recommended-approach',
    learning: 'Invalid lifecycle candidate should not guide agents',
    source: 'Atlas',
    confidence: 'medium',
    evidence_count: 6,
    status: 'retired',
  }),
  '',
].join('\n'));

fs.writeFileSync(path.join(shipDir, 'ship-summary.json'), JSON.stringify({
  files: [
    { status: 'M', path: 'scripts/forgeflow/install-manifest.js' },
    { status: 'M', path: 'scripts/forgeflow/install-manifest.js' },
    { status: 'M', path: 'README.md' },
  ],
}, null, 2));
fs.writeFileSync(path.join(contextDir, 'code-topology.json'), JSON.stringify({
  schema_version: '1',
  summary: {
    source_files: 3,
    local_edges: 2,
    sections: 12,
    changed_sections: 2,
  },
  high_fan_in: [
    { path: 'scripts/forgeflow/build-context-pack.js', fan_in: 5, fan_out: 2 },
  ],
  high_fan_out: [
    { path: 'scripts/forgeflow/show-code-map.js', fan_in: 1, fan_out: 4 },
  ],
  changed_sections: {
    'scripts/forgeflow/show-code-map.js': [
      { kind: 'function', name: 'showCodeMap', line: 180, end_line: 205, changed_lines: [190] },
    ],
  },
}, null, 2));
fs.writeFileSync(path.join(contextDir, 'code-map-history.jsonl'), [
  JSON.stringify({
    schema_version: '1',
    generated_at: '2026-05-19T00:00:00Z',
    summary: {
      source_files: 3,
      local_edges: 1,
      unresolved_imports: 0,
      skipped_dynamic_imports: 0,
      sections: 10,
      changed_sections: 1,
      markdown_section_files: 0,
    },
    high_fan_in: [],
    high_fan_out: [],
  }),
  JSON.stringify({
    schema_version: '1',
    generated_at: '2026-05-20T00:00:00Z',
    summary: {
      source_files: 3,
      local_edges: 2,
      unresolved_imports: 1,
      skipped_dynamic_imports: 0,
      sections: 12,
      changed_sections: 2,
      markdown_section_files: 0,
    },
    high_fan_in: [
      { path: 'scripts/forgeflow/build-context-pack.js', fan_in: 5, fan_out: 2 },
    ],
    high_fan_out: [
      { path: 'scripts/forgeflow/show-code-map.js', fan_in: 1, fan_out: 4 },
    ],
  }),
  '',
].join('\n'));

const notes = parseImplementationNotes(fs.readFileSync(path.join(projectDir, 'implementation-notes.md'), 'utf8'));
const out = path.join(projectDir, 'project-learnings.md');
const result = rollupProjectLearnings({ projectDir, out });
const rendered = fs.readFileSync(out, 'utf8');
const manual = buildRollup({
  notes,
  reviewOutcomes: [],
  shipSummary: {},
  hasImplementationNotes: true,
  hasShipSummary: false,
}, { maxItems: 2, generatedAt: '2026-05-20T00:00:00Z' });
const cliJson = spawnSync(path.join(repoRoot, 'scripts/forgeflow/rollup-project-learnings.js'), [
  '--project-dir',
  projectDir,
  '--json',
], { encoding: 'utf8' });
const missingValue = spawnSync(path.join(repoRoot, 'scripts/forgeflow/rollup-project-learnings.js'), [
  '--project-dir',
], { encoding: 'utf8' });
const cliResult = cliJson.status === 0 ? JSON.parse(cliJson.stdout) : {};

const checks = [
  ['parses decision pipe metadata', notes.decisions[0] === 'Markdown stays canonical - local state should stay editable'],
  ['redacts sensitive implementation note', !notes.spec_gaps.some((line) => line.includes('SHOULD_NOT_RENDER'))],
  ['detects sensitive content', containsSensitiveContent('token: SHOULD_NOT_RENDER')],
  ['detects private urls', containsSensitiveContent('ssh://git.internal/team/private.git') && containsSensitiveContent('git@github.com:private/repo.git')],
  ['rolls up sources', result.sources.implementation_notes === true && result.sources.review_outcomes === 1 && result.sources.ship_summary === true],
  ['rolls up code map source', result.sources.code_map === true && result.sources.code_map_sections === 12 && result.sources.code_map_changed_sections === 2],
  ['rolls up code map history source', result.sources.code_map_history === 2 && result.sources.code_map_trend === 'compared'],
  ['records generated timestamp', Boolean(result.generated_at) && rendered.includes('- Generated at: ')],
  ['preserves total learning candidates source', result.sources.learning_candidates === 6],
  ['counts active inactive and invalid learning candidates', result.sources.learning_candidates_active === 3 && result.sources.learning_candidates_inactive === 2 && result.sources.learning_candidates_invalid === 1],
  ['summarizes inactive lifecycle metadata', result.sources.learning_candidates_inactive_examples.some((item) => item.status === 'superseded' && item.superseded_by.includes('project intelligence')) && rendered.includes('replace with: Use project intelligence rollup guidance instead.')],
  ['captures recurring pitfall', result.recurring_pitfalls.some((line) => line.includes('Release-helper changes'))],
  ['omits non-guidance notes', !result.recurring_pitfalls.some((line) => /^None\b/.test(line)) && !rendered.includes('None from the design')],
  ['captures review risk area', result.risk_areas.some((item) => item.name === 'docs-drift' && item.count === 2)],
  ['captures auto-fix risk area', result.risk_areas.some((item) => item.name === 'auto-fix-failed')],
  ['captures topology trend risk area', result.risk_areas.some((item) => item.name === 'unresolved-import-growth' && item.count === 1)],
  ['weights hot files by evidence count', result.hot_files_and_modules[0].includes('scripts/forgeflow/rollup-project-learnings.js')],
  ['adds code map hotspots to hot files', result.hot_files_and_modules.some((line) => line.includes('scripts/forgeflow/show-code-map.js')) && result.hot_files_and_modules.some((line) => line.includes('scripts/forgeflow/build-context-pack.js'))],
  ['captures validation pattern', result.validation_patterns.some((line) => line.includes('focused helper tests'))],
  ['captures structured validation pattern', result.validation_patterns.some((line) => line.includes('structured candidates'))],
  ['renders candidate confidence metadata', result.validation_patterns.some((line) => line.includes('[confidence: high, evidence: 2, apply: Use this before release readiness claims.]'))],
  ['writes markdown artifact', rendered.includes('# Project Learnings') && rendered.includes('## Recommended Approach For Next Work')],
  ['captures structured recommendation', result.recommended_approach_for_next_work.some((line) => line.includes('expanding learning automation') && line.includes('[confidence: low, evidence: 1, apply: Treat as planning guidance until it repeats.]'))],
  ['omits inactive and invalid candidates from guidance', !result.recommended_approach_for_next_work.some((line) => line.includes('old context heuristic') || line.includes('Invalid lifecycle candidate')) && !result.risk_areas.some((item) => item.name.includes('Obsolete review-risk signal'))],
  ['recommends changed code-map sections', result.recommended_approach_for_next_work.some((line) => line.includes('changed code-map section'))],
  ['recommends topology trend risk', result.recommended_approach_for_next_work.some((line) => line.includes('new unresolved import'))],
  ['markdown omits sensitive note', !rendered.includes('SHOULD_NOT_RENDER')],
  ['manual rollup uses notes', manual.stable_decisions.some((line) => line.includes('Markdown stays canonical'))],
  ['manual rollup accepts generated timestamp', manual.generated_at === '2026-05-20T00:00:00Z'],
  ['cli emits json', cliJson.status === 0 && cliResult.out === out],
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

console.log('project learnings rollup: ok');
