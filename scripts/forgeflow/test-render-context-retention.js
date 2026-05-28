#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildContextRetention, parseArgs, renderMarkdown } = require('./render-context-retention');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-context-retention-'));
const projectDir = path.join(root, '.forgeflow', 'Demo');
const contextDir = path.join(projectDir, 'context');
fs.mkdirSync(path.join(contextDir, 'latest'), { recursive: true });
fs.mkdirSync(path.join(contextDir, 'agent-packets'), { recursive: true });
fs.writeFileSync(path.join(contextDir, 'latest', 'latest-insights-report.json'), JSON.stringify({ status: 'injected' }));
fs.writeFileSync(path.join(contextDir, 'agent-packets', 'smith.md'), 'packet');
fs.writeFileSync(path.join(contextDir, 'code-map-history.jsonl'), Array.from({ length: 4 }, (_, index) => JSON.stringify({ n: index })).join('\n'));
fs.writeFileSync(path.join(projectDir, '..', 'context-advisor-history.jsonl'), `${JSON.stringify({ status: 'pass' })}\n`);

const old = new Date('2026-04-01T00:00:00Z');
fs.utimesSync(path.join(contextDir, 'latest', 'latest-insights-report.json'), old, old);
const result = buildContextRetention({
  root,
  projectDir,
  maxHistory: 2,
  staleDays: 10,
  now: '2026-05-20T00:00:00Z',
});
const markdown = renderMarkdown(result);
const opts = parseArgs(['--root', root, '--project-dir', projectDir, '--max-history', '2', '--stale-days', '10', '--json']);

const checks = [
  ['schema version', result.schema_version === '1'],
  ['read-only status attention', result.status === 'attention' && result.policy.read_only === true],
  ['detects stale bucket', result.recommendations.some((item) => item.action === 'refresh-or-archive-stale-context' && item.target === 'latest')],
  ['detects history overage', result.histories.some((item) => item.name === 'code-map-history' && item.over_by === 2) && result.recommendations.some((item) => item.action === 'trim-history-retention')],
  ['renders markdown', markdown.includes('# Forgeflow Context Retention') && markdown.includes('Context retention review is read-only') && markdown.includes('## Recommendations')],
  ['parses args', opts.root === root && opts.projectDir === projectDir && opts.maxHistory === 2 && opts.staleDays === 10 && opts.json === true],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}
if (failed > 0) process.exit(1);
console.log('context retention: ok');
