#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildNextWorkRanking, parseArgs, renderMarkdown } = require('./render-next-work-ranking');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-next-work-ranking-'));
const projectDir = path.join(root, '.forgeflow', path.basename(root));
const contextDir = path.join(projectDir, 'context');
fs.mkdirSync(path.join(contextDir, 'latest'), { recursive: true });
fs.writeFileSync(path.join(contextDir, 'project-intelligence-rollup.json'), JSON.stringify({
  schema_version: '1',
  freshness: { failure_digest: 'not-applicable' },
  artifacts: { failure_digest: null },
  hot_files: ['scripts/forgeflow/install-manifest.js (3 signals)'],
  next_work_items: [
    {
      title: 'Review user profile guidance before agent-heavy work',
      priority: 'medium',
      source: 'user-profile',
      why: 'profile guidance is warn',
      evidence_strength: 'medium',
      confidence: { score: 70 },
      start_with: ['scripts/forgeflow/render-profile-review.js'],
      validate_with: ['scripts/forgeflow/check-profile-compliance.js'],
    },
  ],
  review_outcomes: { status: 'missing' },
  agent_feedback: { status: 'missing' },
  next_work_confidence: { status: 'missing' },
  user_profile: { status: 'warn' },
}, null, 2));
fs.writeFileSync(path.join(contextDir, 'latest', 'context-telemetry.json'), JSON.stringify({
  estimated_compact_tokens: 22000,
}, null, 2));

const result = buildNextWorkRanking({ root, projectDir, targetTokens: 16000 });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--target-tokens', '12000', '--json']);

const checks = [
  ['ranks candidates', result.status === 'ranked' && result.candidates.length >= 4],
  ['prioritizes over-budget context', result.candidates[0].title.includes('Split over-budget context')],
  ['includes demotion conditions', result.candidates.every((item) => item.demote_when.length > 0)],
  ['renders boundary', markdown.includes('read-only advisory guidance')],
  ['parses args', opts.root === root && opts.projectDir === projectDir && opts.targetTokens === 12000 && opts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('next work ranking: ok');
