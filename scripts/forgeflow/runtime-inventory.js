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
  groupRuntimeHelpers,
  healthInventory,
  helperGroupForSource,
  installedCommandNameFromSource,
  managedRuntimeHelpers,
  managedStaticFiles,
  parseInlineShellArray,
  parseShellArray,
  releaseCheckCommands,
  releaseCheckCommandsFromText,
  repoRelative,
  walk,
};
