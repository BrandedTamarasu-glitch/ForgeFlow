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
    checksRepoLocalFile: markdown.includes(`! -f "\${HELPER_DIR}/${helperName}"`),
    fallsBackToInstalledHelper: markdown.includes('HELPER_DIR="$HOME/.claude/forgeflow/scripts/forgeflow"'),
    invokesHelperWithSafeArgs: markdown.includes(`"\${HELPER_DIR}/${helperName}" "\${SAFE_ARGS[@]}"`),
    scrubsNodeEnvironment: markdown.includes('env -u NODE_OPTIONS -u NODE_PATH node'),
    helperExecutable: executable(helperRel),
  };
}

const contextRetention = helperWrapper('commands/forgeflow-context-retention.md', 'render-context-retention.js');
const efficiencyGaps = helperWrapper('commands/forgeflow-efficiency-gaps.md', 'render-efficiency-gap-plan.js');
const postRelease = helperWrapper('commands/forgeflow-post-release-install-verify.md', 'render-post-release-install-verify.js');
const wrapperBatch = helperWrapper('commands/forgeflow-command-wrapper-batch.md', 'render-command-wrapper-batch.js');
const telemetryQuality = helperWrapper('commands/forgeflow-telemetry-quality.md', 'render-telemetry-quality.js');
const workflowEnding = helperWrapper('commands/forgeflow-workflow-ending-capture.md', 'render-workflow-ending-capture.js');
const learningAction = helperWrapper('commands/forgeflow-learning-action.md', 'render-learning-action-router.js');
const firstRunSimulator = helperWrapper('commands/forgeflow-first-run-simulator.md', 'render-first-run-simulator.js');

const checks = [
  ['context retention wrapper references helper', contextRetention.referencesHelper],
  ['context retention wrapper checks regular helper file', contextRetention.checksRepoLocalFile],
  ['context retention wrapper falls back safely', contextRetention.fallsBackToInstalledHelper],
  ['context retention wrapper invokes helper with safe args', contextRetention.invokesHelperWithSafeArgs],
  ['context retention wrapper supports preview cleanup', contextRetention.markdown.includes('--preview-cleanup') && contextRetention.markdown.includes('SAFE_ARGS+=("$arg")')],
  ['efficiency gaps wrapper references helper', efficiencyGaps.referencesHelper],
  ['efficiency gaps wrapper checks executable helper', efficiencyGaps.checksRepoLocalExecutable && efficiencyGaps.helperExecutable],
  ['efficiency gaps wrapper falls back safely', efficiencyGaps.fallsBackToInstalledHelper],
  ['efficiency gaps wrapper preserves raw arguments', efficiencyGaps.markdown.includes('SAFE_ARGS+=(--args "${ARGUMENTS}")')],
  ['post-release wrapper references helper', postRelease.referencesHelper],
  ['post-release wrapper checks executable helper', postRelease.checksRepoLocalExecutable && postRelease.helperExecutable],
  ['post-release wrapper falls back safely', postRelease.fallsBackToInstalledHelper],
  ['post-release wrapper invokes helper with safe args', postRelease.invokesHelperWithSafeArgs],
  ['post-release wrapper only accepts json', postRelease.markdown.includes('Only `--json` is supported') && postRelease.markdown.includes('--json) SAFE_ARGS+=(--json)')],
  ['command wrapper batch rejects unsupported args', wrapperBatch.referencesHelper && wrapperBatch.markdown.includes('Unsupported arguments for /forgeflow-command-wrapper-batch') && wrapperBatch.markdown.includes('SAFE_ARGS+=(--limit "$value")')],
  ['telemetry quality rejects unsupported args', telemetryQuality.referencesHelper && telemetryQuality.markdown.includes('Unsupported arguments for /forgeflow-telemetry-quality')],
  ['workflow ending rejects unsupported args', workflowEnding.referencesHelper && workflowEnding.markdown.includes('Unsupported arguments for /forgeflow-workflow-ending-capture') && workflowEnding.markdown.includes('review|next-work|agent-feedback|auto)')],
  ['learning action wrapper checks regular helper file', learningAction.referencesHelper && learningAction.checksRepoLocalFile && learningAction.fallsBackToInstalledHelper],
  ['learning action wrapper scrubs node env and safe args', learningAction.scrubsNodeEnvironment && learningAction.invokesHelperWithSafeArgs && learningAction.markdown.includes('Unsupported arguments for /forgeflow-learning-action')],
  ['learning action wrapper only accepts json', learningAction.markdown.includes('Only `--json` is supported') && learningAction.markdown.includes('--json) SAFE_ARGS+=(--json)')],
  ['first-run simulator wrapper checks regular helper file', firstRunSimulator.referencesHelper && firstRunSimulator.checksRepoLocalFile && firstRunSimulator.fallsBackToInstalledHelper],
  ['first-run simulator wrapper scrubs node env and safe args', firstRunSimulator.scrubsNodeEnvironment && firstRunSimulator.invokesHelperWithSafeArgs && firstRunSimulator.markdown.includes('Unsupported arguments for /forgeflow-first-run-simulator')],
  ['first-run simulator wrapper validates runtime', firstRunSimulator.markdown.includes('claude-code|codex) SAFE_ARGS+=(--runtime "$runtime")') && firstRunSimulator.markdown.includes('--skip-smoke) SAFE_ARGS+=(--skip-smoke)')],
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
