#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildGuidedRepair, renderMarkdown } = require('./render-guided-repair');
const { RUNTIME_HELPERS, manifestEntry } = require('./install-manifest');

const repoRoot = path.resolve(__dirname, '..', '..');

function installLiveHelpers(home) {
  for (const source of RUNTIME_HELPERS) {
    const entry = manifestEntry(source, home);
    fs.mkdirSync(path.dirname(entry.destination), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, source), entry.destination);
  }
}

function withEnv(name, value, fn) {
  const prior = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    return fn();
  } finally {
    if (prior === undefined) delete process.env[name];
    else process.env[name] = prior;
  }
}

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-guided-repair-'));
  const home = path.join(root, 'home');
  fs.mkdirSync(home, { recursive: true });
  const result = await buildGuidedRepair({ root, home, installRoot: home });
  const installedHome = path.join(root, 'installed-home');
  installLiveHelpers(installedHome);
  const installedResult = await buildGuidedRepair({ root, home: installedHome, installRoot: installedHome });
  const skippedResult = await buildGuidedRepair({ root, home: installedHome, installRoot: installedHome, liveInstall: false });
  const preloadMarker = path.join(root, 'node-options-preload-marker');
  const preloadFile = path.join(root, 'node-options-preload.js');
  fs.writeFileSync(preloadFile, `require('fs').writeFileSync(${JSON.stringify(preloadMarker)}, 'executed\\n');\n`);
  const sanitizedEnvResult = await withEnv('NODE_OPTIONS', `--require ${preloadFile}`, () => (
    buildGuidedRepair({ root, home: installedHome, installRoot: installedHome })
  ));
  const symlinkHome = path.join(root, 'symlink-home');
  const symlinkTarget = path.join(root, 'outside-install-scripts');
  installLiveHelpers(symlinkHome);
  fs.mkdirSync(symlinkTarget, { recursive: true });
  fs.renameSync(path.join(symlinkHome, 'forgeflow', 'scripts'), path.join(symlinkTarget, 'scripts'));
  fs.symlinkSync(path.join(symlinkTarget, 'scripts'), path.join(symlinkHome, 'forgeflow', 'scripts'));
  const symlinkResult = await buildGuidedRepair({ root, home: symlinkHome, installRoot: symlinkHome });
  fs.writeFileSync(manifestEntry('scripts/forgeflow/show-code-map.js', installedHome).destination, 'function broken syntax\n');
  const brokenResult = await buildGuidedRepair({ root, home: installedHome, installRoot: installedHome });
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
    ['installed runtime status included', result.installed_runtime_status === 'fail' && result.installed_runtime.failures.length > 0],
    ['installed runtime checks all manifest helpers', installedResult.installed_runtime.checked === RUNTIME_HELPERS.length],
    ['installed runtime passes with copied helpers', installedResult.installed_runtime_status === 'pass'],
    ['installed runtime can be skipped', skippedResult.installed_runtime_status === 'skipped'],
    ['installed runtime strips node options', sanitizedEnvResult.installed_runtime_status === 'pass' && !fs.existsSync(preloadMarker)],
    ['installed runtime rejects symlinked ancestors', symlinkResult.installed_runtime_status === 'fail' && symlinkResult.installed_runtime.failures.some((item) => item.name === 'helper-root' && item.reason.includes('symlinked directory'))],
    ['installed runtime catches non-sampled syntax errors', brokenResult.installed_runtime_status === 'fail' && brokenResult.installed_runtime.failures.some((item) => item.source === 'scripts/forgeflow/show-code-map.js')],
    ['broken runtime recommends repair', brokenResult.steps.some((step) => step.command === '/update-forgeflow --repair' && step.reason.includes('installed runtime helper'))],
    ['runtime repair step stays canonical', result.steps.filter((step) => step.command === '/update-forgeflow --repair').length === 1],
    ['default install root checks local claude home', defaultResult.install_root === path.join(root, '.claude')],
    ['default path reports missing installed runtime helpers', defaultResult.steps.some((step) => step.command === '/update-forgeflow --repair')],
    ['smoke status is explicit follow-up', result.smoke_status === 'not-run'],
    ['install step present', result.steps.some((step) => step.command === '/update-forgeflow')],
    ['health fix step present', result.steps.some((step) => step.command === '/forgeflow-health --fix' || step.command === '/update-forgeflow --repair')],
    ['smoke follow-up present', result.steps.some((step) => step.command === '/forgeflow-smoke')],
    ['health verification present', result.steps.some((step) => step.command === '/forgeflow-health')],
    ['manual settings stays manual', result.steps.some((step) => step.title === 'Manual settings check' && step.action_type === 'manual' && step.command.includes('settings.json'))],
    ['restart guidance present', result.steps.some((step) => step.title === 'Restart the client session' && step.action_type === 'manual')],
    ['markdown renders plan', markdown.includes('# Forgeflow Guided Repair') && markdown.includes('Installed runtime: fail') && markdown.includes('Guided repair is advisory') && markdown.includes('## Repair Plan') && markdown.includes('Action: Open ~/.claude/settings.json') && markdown.includes('Action: Restart Claude Code')],
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
