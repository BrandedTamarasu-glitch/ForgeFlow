#!/usr/bin/env node
const path = require('path');
const {
  buildLeanAdapterSmoke,
  parseArgs,
  renderMarkdown,
} = require('./render-lean-adapter-smoke');

(async () => {
  const root = path.resolve(__dirname, '..', '..');
  const result = await buildLeanAdapterSmoke({ root });
  const markdown = renderMarkdown(result);
  const opts = parseArgs(['--root', root, '--json']);
  const checks = [
    ['adapter smoke passes', result.status === 'pass' && result.summary.checks >= 6],
    ['opencode smoke covered', result.checks.some((item) => item.name === 'OpenCode plugin smoke loads' && item.status === 'pass')],
    ['copilot smoke covered', result.checks.some((item) => item.name === 'Copilot plugin manifest parses' && item.status === 'pass')],
    ['renders markdown', markdown.includes('# Forgeflow Lean Adapter Smoke') && markdown.includes('local and structural')],
    ['parses args', opts.root === root && opts.json],
  ];
  let failed = 0;
  for (const [name, ok] of checks) {
    if (!ok) {
      failed += 1;
      console.error(`FAIL ${name}`);
    }
  }
  if (failed > 0) process.exit(1);
  console.log('lean adapter smoke: ok');
})();
