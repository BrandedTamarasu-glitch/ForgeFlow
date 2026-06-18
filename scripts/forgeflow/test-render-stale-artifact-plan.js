#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildStaleArtifactPlan, parseArgs, renderMarkdown } = require('./render-stale-artifact-plan');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-stale-artifact-plan-'));
const projectDir = path.join(root, '.forgeflow', path.basename(root));
fs.mkdirSync(path.join(projectDir, 'context', 'latest'), { recursive: true });
const result = buildStaleArtifactPlan({ root, projectDir });
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--json']);

const checks = [
  ['detects refresh need', result.status === 'refresh-needed'],
  ['returns slash-command refresh array', Array.isArray(result.commands) && result.commands.every((command) => command.startsWith('/'))],
  ['returns build aftercare summary', result.build_aftercare.status === 'needed' && result.build_aftercare.commands.length > 0 && markdown.includes('Build aftercare: needed')],
  ['returns post-commit aftercare commands', result.post_commit_aftercare.status === 'needed' && result.post_commit_aftercare.commands[0].startsWith('/')],
  ['renders boundary', markdown.includes('does not refresh')],
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
console.log('stale artifact plan: ok');
