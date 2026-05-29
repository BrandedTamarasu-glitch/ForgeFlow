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
  healthInventory,
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
