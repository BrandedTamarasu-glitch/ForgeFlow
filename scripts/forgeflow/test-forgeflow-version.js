#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  getVersionStatus,
  readInstalledVersion,
  renderMarkdown,
  runtimeHelperInventory,
  saveVersionSnapshot,
  shortSha,
  versionSnapshotPath,
} = require('./forgeflow-version');
const { manifestEntry, RUNTIME_HELPERS } = require('./install-manifest');

function writeRuntimeHelpers(home, sources = RUNTIME_HELPERS) {
  for (const source of sources) {
    const entry = manifestEntry(source, home);
    fs.mkdirSync(path.dirname(entry.destination), { recursive: true });
    fs.writeFileSync(entry.destination, 'helper\n');
  }
}

async function main() {
  const missingHome = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-version-missing-'));
  const installedHome = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-version-installed-'));
  const corruptHome = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-version-corrupt-'));
  const partialHome = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-version-partial-'));
  const oneMissingHome = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-version-one-missing-'));
  const invalidHelperHome = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-version-invalid-helper-'));
  const sha = '0123456789abcdef0123456789abcdef01234567';

  fs.mkdirSync(path.join(installedHome, 'forgeflow', 'scripts', 'forgeflow'), { recursive: true });
  fs.mkdirSync(path.join(installedHome, 'commands'), { recursive: true });
  fs.mkdirSync(path.join(installedHome, 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(installedHome, 'forgeflow-version'), `${sha}\n`);
  writeRuntimeHelpers(installedHome);
  fs.writeFileSync(path.join(installedHome, 'commands', 'update-forgeflow.md'), 'command\n');
  fs.writeFileSync(path.join(installedHome, 'commands', 'forgeflow-version.md'), 'command\n');
  fs.writeFileSync(path.join(installedHome, 'hooks', 'forgeflow-statusline.js'), 'hook\n');

  fs.writeFileSync(path.join(corruptHome, 'forgeflow-version'), 'not-a-sha\n');
  fs.writeFileSync(path.join(partialHome, 'forgeflow-version'), `${sha}\n`);
  for (const home of [oneMissingHome, invalidHelperHome]) {
    fs.mkdirSync(path.join(home, 'commands'), { recursive: true });
    fs.mkdirSync(path.join(home, 'hooks'), { recursive: true });
    fs.writeFileSync(path.join(home, 'forgeflow-version'), `${sha}\n`);
    fs.writeFileSync(path.join(home, 'commands', 'update-forgeflow.md'), 'command\n');
    fs.writeFileSync(path.join(home, 'commands', 'forgeflow-version.md'), 'command\n');
    fs.writeFileSync(path.join(home, 'hooks', 'forgeflow-statusline.js'), 'hook\n');
  }
  const omittedSource = 'scripts/forgeflow/smoke-check.js';
  writeRuntimeHelpers(oneMissingHome, RUNTIME_HELPERS.filter((source) => source !== omittedSource));
  const invalidSource = 'scripts/forgeflow/show-code-map.js';
  writeRuntimeHelpers(invalidHelperHome, RUNTIME_HELPERS.filter((source) => source !== invalidSource));
  fs.mkdirSync(manifestEntry(invalidSource, invalidHelperHome).destination, { recursive: true });

  const missing = await getVersionStatus({ home: missingHome, offline: true });
  const installed = await getVersionStatus({ home: installedHome, offline: true });
  const savedInstalled = saveVersionSnapshot(await getVersionStatus({ home: installedHome, offline: true }));
  const corrupt = await getVersionStatus({ home: corruptHome, offline: true });
  const partial = await getVersionStatus({ home: partialHome, offline: true });
  const oneMissing = await getVersionStatus({ home: oneMissingHome, offline: true });
  const invalidHelper = await getVersionStatus({ home: invalidHelperHome, offline: true });
  const markdown = renderMarkdown(installed);
  const partialMarkdown = renderMarkdown(partial);
  const oneMissingMarkdown = renderMarkdown(oneMissing);
  const partialInventory = runtimeHelperInventory(partialHome);

  const checks = [
    ['short sha', shortSha(sha) === '0123456'],
    ['missing read status', readInstalledVersion(missingHome).status === 'missing'],
    ['corrupt read status', readInstalledVersion(corruptHome).status === 'corrupt'],
    ['missing action', missing.status === 'not-installed'],
    ['installed offline status', installed.status === 'installed-offline'],
    ['installed helper path exists', installed.paths.helper_root.exists === true],
    ['installed snapshot path exposed', installed.snapshot.path === versionSnapshotPath(installedHome) && installed.snapshot.saved === false],
    ['snapshot writes support artifact', savedInstalled.snapshot.saved === true && fs.existsSync(savedInstalled.snapshot.path) && JSON.parse(fs.readFileSync(savedInstalled.snapshot.path, 'utf8')).runtime_helpers.present === RUNTIME_HELPERS.length],
    ['installed command path exists', installed.paths.version_command.exists === true],
    ['installed runtime inventory complete', installed.runtime_helpers.status === 'complete' && installed.runtime_helpers.present === RUNTIME_HELPERS.length],
    ['partial install asks repair with fallback', partial.status === 'repair-needed' && partial.action === 'Run scripts/forgeflow/update-forgeflow.js --repair from a local Forgeflow checkout.'],
    ['partial install records missing paths', partial.path_status.missing_required.some((item) => item.name === 'updater')],
    ['partial install records missing runtime helpers', partialInventory.missing.some((item) => item.source === 'scripts/forgeflow/update-forgeflow.js')],
    ['partial markdown lists missing paths', partialMarkdown.includes('## Missing Required Paths')],
    ['partial markdown lists missing helper sources', partialMarkdown.includes('## Missing Runtime Helpers') && partialMarkdown.includes('scripts/forgeflow/update-forgeflow.js') && partialMarkdown.includes('local Forgeflow checkout')],
    ['one missing helper independently asks repair', oneMissing.status === 'repair-needed' && oneMissing.action === 'Run /update-forgeflow --repair.' && oneMissing.runtime_helpers.missing.length === 1],
    ['one missing helper records source and path', oneMissing.runtime_helpers.missing[0].source === omittedSource && oneMissing.runtime_helpers.missing[0].path.endsWith('/forgeflow/scripts/forgeflow/smoke-check.js')],
    ['one missing markdown lists exact helper', oneMissingMarkdown.includes(omittedSource) && oneMissingMarkdown.includes('/update-forgeflow --repair')],
    ['invalid helper path asks repair', invalidHelper.status === 'repair-needed' && invalidHelper.runtime_helpers.missing.some((item) => item.source === invalidSource && item.issue === 'not-regular-file')],
    ['corrupt status', corrupt.status === 'corrupt-version'],
    ['markdown includes next step', markdown.includes('## Next Step') && markdown.includes('Snapshot:')],
  ];

  let failed = 0;
  for (const [name, ok] of checks) {
    if (!ok) {
      failed += 1;
      console.error(`FAIL ${name}`);
    }
  }

  if (failed > 0) process.exit(1);
  console.log('forgeflow version: ok');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
