const fs = require('fs');
const path = require('path');
const { RUNTIME_HELPERS, STATIC_FILES, isManagedSource } = require('./install-manifest');

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function repoRelative(root, file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function commandNameFromSource(source) {
  return String(source || '').replace(/^commands\//, '').replace(/\.md$/, '').replace(/\//g, ':');
}

function installedCommandNameFromSource(source) {
  return commandNameFromSource(source).replace(':', '/');
}

function commandSources(root) {
  return walk(path.join(root, 'commands'))
    .filter((file) => file.endsWith('.md'))
    .map((file) => repoRelative(root, file))
    .sort();
}

function commandNames(root) {
  return commandSources(root).map(installedCommandNameFromSource).sort();
}

function managedRuntimeHelpers() {
  return RUNTIME_HELPERS.filter(isManagedSource).sort();
}

function managedStaticFiles() {
  return Array.from(STATIC_FILES).sort();
}

function helperGroupForSource(source) {
  const file = path.basename(String(source || ''));
  if (/^(install-|update-|health-|forgeflow-version|runtime-|render-update-|render-guided-repair|render-post-release-install-verify)/.test(file)) {
    return 'install-update-health';
  }
  if (/^(build-|check-context|context-|compact-|capture-|failure-|advise-|seed-budget|render-context|render-stale|render-validation|show-code|show-project-trends)/.test(file)) {
    return 'context-intelligence';
  }
  if (/^(record-|rollup-|show-learning|show-project-learnings|show-user-profile|user-profile|learning-|render-profile|render-outcome|render-first|render-pattern|render-efficiency|render-insight|render-first-useful)/.test(file)) {
    return 'learning-evidence';
  }
  if (/^(render-release|render-ship|ship-|smoke-|render-support|render-pilot|render-adoption|render-evaluation|summarize-)/.test(file)) {
    return 'release-shipping';
  }
  if (/^(agent-chat|check-agent|check-codex-agent|generate-codex|explain-review|classify-review|render-review|check-review|guidance-|next-action|output-|privacy-|command-args|index-memory|build-memory|build-scope)/.test(file)) {
    return 'agent-workflow';
  }
  if (/^(command-wrapper-contract|render-command-wrapper-batch)/.test(file)) {
    return 'command-wrapper';
  }
  return 'runtime-core';
}

function groupRuntimeHelpers(helpers) {
  const groups = {};
  for (const helper of helpers || []) {
    const source = typeof helper === 'string' ? helper : helper.source;
    const group = helper.helper_group || helperGroupForSource(source);
    if (!groups[group]) groups[group] = { group, count: 0, sources: [] };
    groups[group].count += 1;
    groups[group].sources.push(source);
  }
  return Object.values(groups)
    .map((item) => ({ ...item, sources: item.sources.sort() }))
    .sort((a, b) => b.count - a.count || a.group.localeCompare(b.group));
}

function runtimeHelperEntries() {
  return managedRuntimeHelpers().map((source) => ({
    source,
    helper_group: helperGroupForSource(source),
    installed_name: path.basename(source),
  }));
}

function inventorySummary(root) {
  const commands = commandSources(root);
  const runtimeHelpers = runtimeHelperEntries();
  const staticFiles = managedStaticFiles();
  const commandNamesList = commandNames(root);
  return {
    schema_version: '1',
    root,
    command_count: commands.length,
    runtime_helper_count: runtimeHelpers.length,
    static_file_count: staticFiles.length,
    commands,
    command_names: commandNamesList,
    runtime_helpers: runtimeHelpers,
    helper_groups: groupRuntimeHelpers(runtimeHelpers),
    coordination_pressure: coordinationPressure(runtimeHelpers),
    static_files: staticFiles,
    managed_registry: {
      commands: commands.length,
      command_names: commandNamesList.length,
      runtime_helpers: runtimeHelpers.length,
      static_files: staticFiles.length,
      install_manifest_sources: runtimeHelpers.length + staticFiles.length,
    },
  };
}

function coordinationPressure(runtimeHelpers) {
  const groups = groupRuntimeHelpers(runtimeHelpers);
  const hotFiles = [
    {
      path: 'scripts/forgeflow/install-manifest.js',
      reason: 'managed source registry for install, update, release, and runtime helper tests',
    },
    {
      path: 'commands/forgeflow-health.md',
      reason: 'installed command/helper inventory surface for user health checks',
    },
    {
      path: 'commands/forgeflow-release-check.md',
      reason: 'release gate command list mirrored by release docs',
    },
  ];
  return {
    status: 'watch',
    shared_registry: 'scripts/forgeflow/runtime-inventory.js',
    helper_group_count: groups.length,
    largest_helper_group: groups[0] ? { group: groups[0].group, count: groups[0].count } : null,
    hot_files: hotFiles,
    next_safe_slice: 'Prefer adding read-only inventory summaries before editing install/update behavior.',
    boundary: 'Runtime inventory pressure is advisory. It does not install, repair, update, edit manifests, or change release gates.',
  };
}

function parityStatus(root) {
  const summary = inventorySummary(root);
  const health = healthInventory(root);
  const releaseCheck = releaseCheckCommands(root);
  const releaseGate = releaseCheckCommands(root, path.join('docs', 'wiki', 'Release-Gate.md'));
  const releaseProcess = releaseCheckCommands(root, path.join('docs', 'wiki', 'Release-Process.md'));
  const helperNames = summary.runtime_helpers.map((helper) => helper.installed_name).sort();
  const healthHelperNames = health.runtime_helpers.map((helper) => path.basename(helper)).sort();
  const healthCommandsMatch = summary.command_names.length === health.commands.length
    && summary.command_names.every((name, index) => name === health.commands[index]);
  const healthRuntimeHelpersMatch = helperNames.length === healthHelperNames.length
    && helperNames.every((name, index) => name === healthHelperNames[index]);
  const releaseGateMatches = releaseCheck.length === releaseGate.length
    && releaseCheck.every((command, index) => command === releaseGate[index]);
  const releaseProcessMatches = releaseCheck.length === releaseProcess.length
    && releaseCheck.every((command, index) => command === releaseProcess[index]);
  return {
    schema_version: '1',
    status: healthCommandsMatch && healthRuntimeHelpersMatch && releaseCheck.length > 0 && releaseGateMatches && releaseProcessMatches
      ? 'pass'
      : 'attention',
    command_count: summary.command_count,
    runtime_helper_count: summary.runtime_helper_count,
    health_command_count: health.commands.length,
    health_runtime_helper_count: health.runtime_helpers.length,
    release_check_count: releaseCheck.length,
    release_gate_check_count: releaseGate.length,
    release_process_check_count: releaseProcess.length,
    checks: {
      health_commands_match: healthCommandsMatch,
      health_runtime_helpers_match: healthRuntimeHelpersMatch,
      release_check_present: releaseCheck.length > 0,
      release_gate_matches: releaseGateMatches,
      release_process_matches: releaseProcessMatches,
    },
    release_checks: releaseCheck,
    coordination_pressure: summary.coordination_pressure,
    boundary: 'Runtime inventory parity is read-only. It compares canonical command/helper discovery with health and release surfaces but does not edit docs or install files.',
  };
}

function parseShellArray(markdown, name) {
  const block = String(markdown || '').match(new RegExp(`${name}=\\(\\n([\\s\\S]*?)\\n\\)`));
  if (!block) return [];
  return block[1].split(/\s+/).map((item) => item.trim()).filter(Boolean).sort();
}

function parseInlineShellArray(markdown, name) {
  const block = String(markdown || '').match(new RegExp(`${name}=\\(([^)]*)\\)`));
  if (!block) return [];
  return block[1].split(/\s+/).map((item) => item.trim()).filter(Boolean).sort();
}

function healthInventory(root) {
  const health = fs.readFileSync(path.join(root, 'commands', 'forgeflow-health.md'), 'utf8');
  return {
    commands: [
      ...parseShellArray(health, 'EXPECTED_COMMANDS'),
      ...parseInlineShellArray(health, 'EXPECTED_SUBDIR_COMMANDS'),
    ].sort(),
    runtime_helpers: parseShellArray(health, 'EXPECTED_RUNTIME_HELPERS'),
  };
}

function releaseCheckCommandsFromText(markdown) {
  return String(markdown || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^node scripts\/forgeflow\/test-[A-Za-z0-9._-]+\.js$/.test(line))
    .sort();
}

function releaseCheckCommands(root, file = path.join('commands', 'forgeflow-release-check.md')) {
  const markdown = fs.readFileSync(path.join(root, file), 'utf8');
  return releaseCheckCommandsFromText(markdown);
}

module.exports = {
  commandNameFromSource,
  commandNames,
  commandSources,
  coordinationPressure,
  groupRuntimeHelpers,
  healthInventory,
  helperGroupForSource,
  installedCommandNameFromSource,
  inventorySummary,
  managedRuntimeHelpers,
  managedStaticFiles,
  parseInlineShellArray,
  parseShellArray,
  parityStatus,
  releaseCheckCommands,
  releaseCheckCommandsFromText,
  repoRelative,
  runtimeHelperEntries,
  walk,
};
