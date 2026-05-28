#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildProfileReview, parseArgs, renderCommands, renderMarkdown } = require('./render-profile-review');
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
const commandMarkdown = renderCommands(review);
const opts = parseArgs(['--commands-only', '--json']);

const checks = [
  ['review warns', review.status === 'warn'],
  ['has conflict action', review.actions.resolve_conflicts.some((item) => item.action === 'resolve-conflict' && item.follow_up.includes('superseded'))],
  ['has move action', review.actions.move_scope.some((item) => item.action === 'move-then-supersede' && item.accept_command && item.supersede_command && item.follow_up.includes('accept command'))],
  ['ask actions keep explicit boundary', review.actions.ask_user.every((item) => item.acceptance_boundary && item.acceptance_boundary.includes('Ask the user first'))],
  ['confirmation prompts are explicit', review.confirmation_prompts.length >= 2 && review.confirmation_prompts.every((item) => item.question && item.boundary.includes('Ask the user first')) && review.confirmation_prompts.some((item) => item.supersede_command)],
  ['markdown renders templates', markdown.includes('Template:') && markdown.includes('Follow-up:') && markdown.includes('Supersede:')],
  ['markdown groups actions', markdown.includes('## Resolve Conflicts') && markdown.includes('## Move Scope') && review.action_count >= 2],
  ['markdown renders resolution flow', markdown.includes('## Resolution Flow') && markdown.includes('Rerun forgeflow-profile-review')],
  ['markdown renders confirmation prompts', markdown.includes('## Confirmation Prompts') && markdown.includes('Reject:') && markdown.includes('Boundary: Ask the user first')],
  ['copy ready commands render', review.apply_commands.length > 0 && markdown.includes('## Copy-Ready Commands') && commandMarkdown.includes('Forgeflow Profile Review Commands') && commandMarkdown.includes('## Confirm First')],
  ['commands only parses', opts.commandsOnly === true && opts.json === true],
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
