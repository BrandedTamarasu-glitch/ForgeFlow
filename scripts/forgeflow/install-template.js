#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  CODEX_INVENTORY_SOURCE,
  codexInventoryContent,
  assertSafeDestination,
  destinationForTarget,
  isManagedSource,
  manifestEntry,
  managedSources,
} = require('./install-manifest');

const repoRoot = path.resolve(__dirname, '..', '..');
const CLAUDE_SOURCE_DIRS = [
  'agents',
  'commands',
  'forgeflow-patterns',
  'hooks',
  'project-rules',
  'scripts/forgeflow',
  'templates',
];

function usage() {
  console.error('Usage: install-template.js [--target claude|codex|both] [--claude-home <dir>] [--codex-home <dir>] [--dry-run] [--json]');
}

function parseArgs(argv) {
  const opts = {
    target: 'both',
    claudeHome: path.join(os.homedir(), '.claude'),
    codexHome: process.env.CODEX_HOME || path.join(os.homedir(), '.codex'),
    dryRun: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--target') {
      opts.target = argv[++i] || '';
    } else if (arg === '--claude-home') {
      opts.claudeHome = path.resolve(argv[++i] || '');
    } else if (arg === '--codex-home') {
      opts.codexHome = path.resolve(argv[++i] || '');
    } else if (arg === '--dry-run') {
      opts.dryRun = true;
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

  if (!['claude', 'codex', 'both'].includes(opts.target)) {
    console.error(`Invalid target: ${opts.target}`);
    usage();
    process.exit(2);
  }

  return opts;
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file, files);
    else if (entry.isFile()) files.push(file);
  }
  return files;
}

function isRegularSourceFile(file) {
  try {
    const stat = fs.lstatSync(file);
    return stat.isFile() && !stat.isSymbolicLink();
  } catch (_err) {
    return false;
  }
}

function relative(file) {
  return path.relative(repoRoot, file).replace(/\\/g, '/');
}

function copyFile({ source, destination, home, executable = false, dryRun = false }) {
  if (!dryRun) {
    const sourcePath = path.join(repoRoot, source);
    if (!isRegularSourceFile(sourcePath)) {
      throw new Error(`Refusing to copy non-regular source file: ${source}`);
    }
    assertSafeDestination(destination, home);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    assertSafeDestination(destination, home);
    fs.copyFileSync(sourcePath, destination);
    fs.chmodSync(destination, executable ? 0o755 : 0o644);
  }
  return { source, destination };
}

function installClaude({ home, dryRun = false } = {}) {
  const files = managedSources(repoRoot, 'claude');
  const copied = [];
  for (const source of files) {
    const entry = manifestEntry(source, home);
    if (!entry || entry.preserve) continue;
    copied.push(copyFile({
      source,
      destination: entry.destination,
      home,
      executable: entry.executable,
      dryRun,
    }));
  }
  return {
    target: 'claude',
    home,
    copied,
    manual_steps: [
      'Restart Claude Code after installing commands, agents, hooks, and templates.',
      'Wire ~/.claude/settings.json hooks and statusLine manually, then run /forgeflow-health.',
    ],
  };
}

function codexSources() {
  return managedSources(repoRoot, 'codex');
}

function codexDestination(source, home) {
  return destinationForTarget(source, home, 'codex');
}

function installCodex({ home, dryRun = false } = {}) {
  const copied = [];
  const sources = codexSources();
  for (const source of sources) {
    const entry = manifestEntry(source, home, 'codex');
    if (!entry) continue;
    copied.push(copyFile({
      source,
      destination: entry.destination,
      home,
      executable: entry.executable,
      dryRun,
    }));
  }
  const inventoryPath = codexDestination(CODEX_INVENTORY_SOURCE, home);
  if (!dryRun) {
    assertSafeDestination(inventoryPath, home);
    fs.writeFileSync(inventoryPath, codexInventoryContent(sources));
  }
  return {
    target: 'codex',
    home,
    copied,
    agent_names: sources
      .filter((source) => /^\.codex\/agents\/[^/]+\.toml$/.test(source))
      .map((source) => path.basename(source, '.toml')),
    skill_names: sources
      .filter((source) => /^\.agents\/skills\/[^/]+\/SKILL\.md$/.test(source))
      .map((source) => source.split('/')[2]),
    canonical_entrypoints: ['discuss', 'research', 'plan', 'consult', 'implement', 'forge-review', 'audit', 'ship', 'quick', 'create-agent', 'update-forgeflow'],
    manual_steps: [
      'Restart Codex so copied agents and skills are discovered.',
      'Forgeflow runtime helpers are installed under CODEX_HOME/forgeflow for use outside the source checkout.',
      'If needed, merge settings from .codex/config.toml into your Codex config instead of overwriting local settings.',
    ],
  };
}

function installTemplate(opts = {}) {
  const target = opts.target || 'both';
  const results = [];
  if (target === 'claude' || target === 'both') {
    results.push(installClaude({ home: opts.claudeHome || path.join(os.homedir(), '.claude'), dryRun: opts.dryRun }));
  }
  if (target === 'codex' || target === 'both') {
    results.push(installCodex({ home: opts.codexHome || process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), dryRun: opts.dryRun }));
  }
  return {
    schema_version: '1',
    status: 'ok',
    dry_run: Boolean(opts.dryRun),
    results,
  };
}

function renderMarkdown(result) {
  const lines = [
    result.dry_run ? 'Forgeflow template install plan.' : 'Forgeflow template install complete.',
  ];
  for (const item of result.results) {
    lines.push('', `${item.target}: ${item.copied.length} files -> ${item.home}`);
    if (item.target === 'codex') {
      lines.push(`- agents: ${item.agent_names.length}`);
      lines.push(`- skills: ${item.skill_names.length}`);
      lines.push(`- canonical entrypoints: ${item.canonical_entrypoints.join(', ')}`);
    }
    for (const step of item.manual_steps) lines.push(`- ${step}`);
  }
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = installTemplate(opts);
  if (opts.json) console.log(JSON.stringify(result, null, 2));
  else console.log(renderMarkdown(result));
}

if (require.main === module) {
  main();
}

module.exports = {
  codexDestination,
  codexSources,
  installClaude,
  installCodex,
  installTemplate,
  isRegularSourceFile,
  renderMarkdown,
};
