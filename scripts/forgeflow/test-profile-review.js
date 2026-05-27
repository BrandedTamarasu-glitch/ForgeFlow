#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildProfileReview, renderMarkdown } = require('./render-profile-review');
const { recordUserProfile } = require('./user-profile');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-profile-review-'));
const home = path.join(tmp, 'home');
const projectDir = path.join(tmp, 'repo', '.forgeflow', 'Demo');
fs.mkdirSync(projectDir, { recursive: true });
recordUserProfile({ home, projectDir, scope: 'global', category: 'communication', preference: 'Use concise updates.', confidence: 'low' });
recordUserProfile({ home, projectDir, scope: 'global', category: 'communication', preference: 'Use detailed updates.', confidence: 'low' });
recordUserProfile({ home, projectDir, scope: 'global', category: 'ui', preference: 'Use dense project screens.' });
const review = buildProfileReview({ home, projectDir });
const markdown = renderMarkdown(review);

const checks = [
  ['review warns', review.status === 'warn'],
  ['has conflict action', review.actions.resolve_conflicts.some((item) => item.action === 'resolve-conflict' && item.follow_up.includes('superseded'))],
  ['has move action', review.actions.move_scope.some((item) => item.action === 'move-then-supersede')],
  ['markdown renders templates', markdown.includes('Template:') && markdown.includes('Follow-up:')],
  ['markdown groups actions', markdown.includes('## Resolve Conflicts') && markdown.includes('## Move Scope') && review.action_count >= 2],
];
let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('profile review: ok');
