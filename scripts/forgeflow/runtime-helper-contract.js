#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const {
  RUNTIME_HELPERS,
  isManagedSource,
  manifestEntry,
} = require('./install-manifest');
const { expectedInstallSources } = require('./health-check');

function usage() {
  console.error('Usage: runtime-helper-contract.js [--root <repo>] [--home <dir>] [--json]');
}

function parseArgs(argv) {
  const opts = {
    root: path.resolve(__dirname, '..', '..'),
    home: '~/.claude',
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(argv[++i] || '');
    } else if (arg === '--home') {
      opts.home = argv[++i] || '';
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      usage();
      process.exit(2);
    }
  }
  return opts;
}

function walkMarkdown(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walkMarkdown(file, files);
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(file);
  }
  return files;
}

function fencedCodeBlocks(content) {
  const blocks = [];
  const pattern = /```[^\n]*\n([\s\S]*?)```/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

function helperReferencedInBlock(block, source) {
  const basename = path.basename(source);
  const sourceNeedle = source.replace(/\\/g, '/');
  const installedNeedle = `forgeflow/${sourceNeedle}`;
  const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const referencePattern = (value) => new RegExp(`(^|[^A-Za-z0-9_./-])${escapeRegex(value)}($|[^A-Za-z0-9_./-])`);
  const basenamePattern = new RegExp(`(^|[^A-Za-z0-9_.-])${escapeRegex(basename)}($|[^A-Za-z0-9_.-])`);
  return block.split(/\r?\n/).some((line) => {
    const trimmed = line.trim();
    return referencePattern(sourceNeedle).test(trimmed)
      || referencePattern(installedNeedle).test(trimmed)
      || basenamePattern.test(trimmed);
  });
}

function commandReferences(root, source) {
  const commandsDir = path.join(root, 'commands');
  const refs = [];
  for (const file of walkMarkdown(commandsDir)) {
    const content = fs.readFileSync(file, 'utf8');
    if (!fencedCodeBlocks(content).some((block) => helperReferencedInBlock(block, source))) continue;
    refs.push(path.relative(root, file).replace(/\\/g, '/'));
  }
  return refs.sort();
}

function healthRuntimeHelpers(root) {
  const file = path.join(root, 'commands', 'forgeflow-health.md');
  if (!fs.existsSync(file)) return new Set();
  const content = fs.readFileSync(file, 'utf8');
  const match = content.match(/EXPECTED_RUNTIME_HELPERS=\(\s*([\s\S]*?)\n\)/);
  if (!match) return new Set();
  return new Set(match[1].split(/\s+/).map((item) => item.trim()).filter(Boolean));
}

function releaseCheckCoverage(root, source) {
  const releaseCheck = path.join(root, 'commands', 'forgeflow-release-check.md');
  if (!fs.existsSync(releaseCheck)) {
    return {
      covered: false,
      reason: 'release-check-missing',
    };
  }
  const content = fencedCodeBlocks(fs.readFileSync(releaseCheck, 'utf8')).join('\n');
  const basename = path.basename(source, path.extname(source));
  const directTest = `node scripts/forgeflow/test-${basename}.js`;
  if (content.includes(directTest)) {
    return {
      covered: true,
      reason: directTest,
    };
  }
  return {
    covered: false,
    reason: 'no-direct-release-check-reference',
  };
}

function runtimeHelperContract(opts = {}) {
  const root = opts.root || path.resolve(__dirname, '..', '..');
  const home = opts.home || '~/.claude';
  const healthHelpers = healthRuntimeHelpers(root);
  const healthSources = new Set(expectedInstallSources().filter((source) => RUNTIME_HELPERS.includes(source)));
  const entries = RUNTIME_HELPERS
    .filter(isManagedSource)
    .sort()
    .map((source) => {
      const entry = manifestEntry(source, home);
      const release = releaseCheckCoverage(root, source);
      return {
        source,
        destination: entry ? entry.destination : '',
        category: entry ? entry.category : '',
        manifest_owned: Boolean(entry && entry.category === 'runtime-script'),
        executable: Boolean(entry && entry.executable),
        health_visible: healthSources.has(source),
        health_fallback_visible: healthHelpers.has(path.basename(source)),
        command_references: commandReferences(root, source),
        release_check: release,
      };
    });
  return {
    schema_version: '1',
    root,
    home,
    runtime_helpers: entries,
    summary: {
      total: entries.length,
      manifest_owned: entries.filter((entry) => entry.manifest_owned).length,
      executable: entries.filter((entry) => entry.executable).length,
      health_visible: entries.filter((entry) => entry.health_visible).length,
      health_fallback_visible: entries.filter((entry) => entry.health_fallback_visible).length,
      command_referenced: entries.filter((entry) => entry.command_references.length > 0).length,
      release_checked: entries.filter((entry) => entry.release_check.covered).length,
    },
  };
}

function affectedCommandsForSources(sources, opts = {}) {
  const root = opts.root || path.resolve(__dirname, '..', '..');
  const affected = new Map();
  for (const source of sources || []) {
    if (!RUNTIME_HELPERS.includes(source)) continue;
    for (const command of commandReferences(root, source)) {
      if (!affected.has(command)) affected.set(command, []);
      affected.get(command).push(source);
    }
  }
  return Array.from(affected.entries())
    .map(([command, helpers]) => ({
      command,
      helpers: helpers.sort(),
    }))
    .sort((a, b) => a.command.localeCompare(b.command));
}

function renderMarkdown(contract) {
  const lines = [
    '# Forgeflow Runtime Helper Contract',
    '',
    `Runtime helpers: ${contract.summary.total}`,
    `Manifest-owned: ${contract.summary.manifest_owned}`,
    `Executable: ${contract.summary.executable}`,
    `Health-visible: ${contract.summary.health_visible}`,
    `Health fallback-visible: ${contract.summary.health_fallback_visible}`,
    `Command-referenced: ${contract.summary.command_referenced}`,
    `Release-checked: ${contract.summary.release_checked}`,
    '',
    '| Helper | Destination | Command References | Release Check |',
    '|---|---|---|---|',
  ];
  for (const entry of contract.runtime_helpers) {
    lines.push(`| ${entry.source} | ${entry.destination} | ${entry.command_references.join(', ') || '(none)'} | ${entry.release_check.reason} |`);
  }
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const contract = runtimeHelperContract(opts);
  if (opts.json) process.stdout.write(`${JSON.stringify(contract, null, 2)}\n`);
  else console.log(renderMarkdown(contract));
}

if (require.main === module) {
  main();
}

module.exports = {
  affectedCommandsForSources,
  commandReferences,
  fencedCodeBlocks,
  healthRuntimeHelpers,
  releaseCheckCoverage,
  renderMarkdown,
  runtimeHelperContract,
};
