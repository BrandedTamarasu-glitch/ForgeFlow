#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

function executable(rel) {
  return (fs.statSync(path.join(repoRoot, rel)).mode & 0o111) !== 0;
}

function helperWrapper(commandRel, helperName) {
  const markdown = read(commandRel);
  const helperRel = `scripts/forgeflow/${helperName}`;
  return {
    commandRel,
    helperRel,
    markdown,
    helperName,
    referencesHelper: markdown.includes(helperName),
    checksRepoLocalExecutable: markdown.includes(`! -x "\${HELPER_DIR}/${helperName}"`),
    fallsBackToInstalledHelper: markdown.includes('HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"'),
    invokesHelperWithSafeArgs: markdown.includes(`"\${HELPER_DIR}/${helperName}" "\${SAFE_ARGS[@]}"`),
    helperExecutable: executable(helperRel),
  };
}

const contextRetention = helperWrapper('commands/forgeflow-context-retention.md', 'render-context-retention.js');
const postRelease = helperWrapper('commands/forgeflow-post-release-install-verify.md', 'render-post-release-install-verify.js');

const checks = [
  ['context retention wrapper references helper', contextRetention.referencesHelper],
  ['context retention wrapper checks executable helper', contextRetention.checksRepoLocalExecutable && contextRetention.helperExecutable],
  ['context retention wrapper falls back safely', contextRetention.fallsBackToInstalledHelper],
  ['context retention wrapper invokes helper with safe args', contextRetention.invokesHelperWithSafeArgs],
  ['context retention wrapper supports preview cleanup', contextRetention.markdown.includes('--preview-cleanup') && contextRetention.markdown.includes('SAFE_ARGS+=("$arg")')],
  ['post-release wrapper references helper', postRelease.referencesHelper],
  ['post-release wrapper checks executable helper', postRelease.checksRepoLocalExecutable && postRelease.helperExecutable],
  ['post-release wrapper falls back safely', postRelease.fallsBackToInstalledHelper],
  ['post-release wrapper invokes helper with safe args', postRelease.invokesHelperWithSafeArgs],
  ['post-release wrapper only accepts json', postRelease.markdown.includes('Only `--json` is supported') && postRelease.markdown.includes('--json) SAFE_ARGS+=(--json)')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

if (failed > 0) process.exit(1);
console.log('command wrapper smoke: ok');
