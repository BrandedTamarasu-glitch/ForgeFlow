#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  getVersionStatus,
  readInstalledVersion,
  renderMarkdown,
  shortSha,
} = require('./forgeflow-version');

async function main() {
  const missingHome = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-version-missing-'));
  const installedHome = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-version-installed-'));
  const corruptHome = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-version-corrupt-'));
  const sha = '0123456789abcdef0123456789abcdef01234567';

  fs.mkdirSync(path.join(installedHome, 'forgeflow', 'scripts', 'forgeflow'), { recursive: true });
  fs.mkdirSync(path.join(installedHome, 'commands'), { recursive: true });
  fs.mkdirSync(path.join(installedHome, 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(installedHome, 'forgeflow-version'), `${sha}\n`);
  fs.writeFileSync(path.join(installedHome, 'forgeflow', 'scripts', 'forgeflow', 'update-forgeflow.js'), 'helper\n');
  fs.writeFileSync(path.join(installedHome, 'forgeflow', 'scripts', 'forgeflow', 'forgeflow-version.js'), 'helper\n');
  fs.writeFileSync(path.join(installedHome, 'commands', 'update-forgeflow.md'), 'command\n');
  fs.writeFileSync(path.join(installedHome, 'commands', 'forgeflow-version.md'), 'command\n');
  fs.writeFileSync(path.join(installedHome, 'hooks', 'forgeflow-statusline.js'), 'hook\n');

  fs.writeFileSync(path.join(corruptHome, 'forgeflow-version'), 'not-a-sha\n');

  const missing = await getVersionStatus({ home: missingHome, offline: true });
  const installed = await getVersionStatus({ home: installedHome, offline: true });
  const corrupt = await getVersionStatus({ home: corruptHome, offline: true });
  const markdown = renderMarkdown(installed);

  const checks = [
    ['short sha', shortSha(sha) === '0123456'],
    ['missing read status', readInstalledVersion(missingHome).status === 'missing'],
    ['corrupt read status', readInstalledVersion(corruptHome).status === 'corrupt'],
    ['missing action', missing.status === 'not-installed'],
    ['installed offline status', installed.status === 'installed-offline'],
    ['installed helper path exists', installed.paths.helper_root.exists === true],
    ['installed command path exists', installed.paths.version_command.exists === true],
    ['corrupt status', corrupt.status === 'corrupt-version'],
    ['markdown includes next step', markdown.includes('## Next Step')],
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
