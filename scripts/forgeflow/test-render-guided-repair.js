#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildGuidedRepair, renderMarkdown } = require('./render-guided-repair');

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-guided-repair-'));
  const home = path.join(root, 'home');
  fs.mkdirSync(home, { recursive: true });
  const result = await buildGuidedRepair({ root, home, installRoot: home });
  const defaultHome = process.env.HOME;
  process.env.HOME = root;
  const defaultResult = await buildGuidedRepair({ root });
  process.env.HOME = defaultHome;
  const markdown = renderMarkdown(result);

  const checks = [
    ['schema version', result.schema_version === '1'],
    ['status surfaces issues', ['warn', 'fail'].includes(result.status)],
    ['version status included', result.version_status === 'not-installed'],
    ['health status included', ['pass', 'fail'].includes(result.health_status)],
    ['default install root checks local claude home', defaultResult.install_root === path.join(root, '.claude')],
    ['default path reports missing installed runtime helpers', defaultResult.steps.some((step) => step.command === '/update-forgeflow --repair')],
    ['smoke status is explicit follow-up', result.smoke_status === 'not-run'],
    ['install step present', result.steps.some((step) => step.command === '/update-forgeflow')],
    ['health fix step present', result.steps.some((step) => step.command === '/forgeflow-health --fix' || step.command === '/update-forgeflow --repair')],
    ['smoke follow-up present', result.steps.some((step) => step.command === '/forgeflow-smoke')],
    ['health verification present', result.steps.some((step) => step.command === '/forgeflow-health')],
    ['manual settings stays manual', result.steps.some((step) => step.title === 'Manual settings check' && step.action_type === 'manual' && step.command.includes('settings.json'))],
    ['restart guidance present', result.steps.some((step) => step.title === 'Restart the client session' && step.action_type === 'manual')],
    ['markdown renders plan', markdown.includes('# Forgeflow Guided Repair') && markdown.includes('Guided repair is advisory') && markdown.includes('## Repair Plan') && markdown.includes('Action: Open ~/.claude/settings.json') && markdown.includes('Action: Restart Claude Code')],
  ];

  let failed = 0;
  for (const [name, ok] of checks) {
    if (!ok) {
      failed += 1;
      console.error(`FAIL ${name}`);
    }
  }
  if (failed > 0) process.exit(1);
  console.log('guided repair: ok');
})().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
