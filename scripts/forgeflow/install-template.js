#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  legacyAgentCandidates,
  CODEX_INVENTORY_SOURCE,
  codexInventoryContent,
  assertSafeDestination,
  destinationForTarget,
  isManagedSource,
  manifestEntry,
  managedSources,
} = require('./install-manifest');

const { setupEmber } = require('./ember-setup');
const { setupRtk } = require('./rtk-setup');

const repoRoot = path.resolve(__dirname, '..', '..');
const CLAUDE_SOURCE_DIRS = [
  'agents',
  'commands',
  'forgeflow-patterns',
  'hooks',
  'project-rules',
  'scripts/forgeflow',
  'templates',
  'services/dashboard',
  'services/agent-chat',
];

function usage() {
  console.error('Usage: install-template.js [--target claude|codex|both] [--claude-home <dir>] [--codex-home <dir>] [--install-rtk] [--dry-run] [--json]');
}

function parseArgs(argv) {
  const opts = {
    target: 'both',
    claudeHome: path.join(os.homedir(), '.claude'),
    codexHome: process.env.CODEX_HOME || path.join(os.homedir(), '.codex'),
    dryRun: false,
    installRtk: false,
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
    } else if (arg === '--install-rtk') {
      opts.installRtk = true;
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

function installSourcePlan({ home, target, sources, dryRun }) {
  const { createBackup, rollbackForgeflow, readCurrentVersion } = require('./update-forgeflow');
  const candidates = legacyAgentCandidates(home, target, sources);
  const retired = candidates.filter((item) => item.verified);
  const preserved_legacy = candidates.filter((item) => !item.verified).map((item) => item.source);
  const planned = sources.filter((source) => !manifestEntry(source, home, target)?.preserve);
  const current = readCurrentVersion(home);
  const snapshotPath = path.join(home, 'forgeflow/backups/previous/manifest.json');
  assertSafeDestination(snapshotPath, home);
  const pending = fs.existsSync(snapshotPath) && JSON.parse(fs.readFileSync(snapshotPath, 'utf8')).pending;
  // An identical reinstall must not consume the only migration recovery point.
  const unchanged = planned.every((source) => {
    const entry = manifestEntry(source, home, target);
    if (!entry) return true;
    assertSafeDestination(entry.destination, home);
    const stat = fs.lstatSync(entry.destination, { throwIfNoEntry: false });
    const sourcePath = path.join(repoRoot, source);
    return isRegularSourceFile(sourcePath) && stat?.isFile()
      && (stat.mode & 0o777) === (entry.executable ? 0o755 : 0o644)
      && fs.readFileSync(sourcePath).equals(fs.readFileSync(entry.destination));
  });
  const inventoryPath = target === 'codex' ? codexDestination(CODEX_INVENTORY_SOURCE, home) : null;
  if (inventoryPath) assertSafeDestination(inventoryPath, home);
  const inventoryUnchanged = !inventoryPath || (fs.existsSync(inventoryPath)
    && fs.readFileSync(inventoryPath, 'utf8') === codexInventoryContent(sources));
  if (!pending && unchanged && inventoryUnchanged && retired.length === 0) {
    return { copied: [], retired: [], preserved_legacy };
  }
  const backup = createBackup({ home, target, current, latest: current,
    files: [...planned, ...retired.map((item) => item.source), ...(target === 'codex' ? [CODEX_INVENTORY_SOURCE] : [])], dryRun });
  const copied = [];
  try {
    for (const source of planned) {
      const entry = manifestEntry(source, home, target);
      if (entry) copied.push(copyFile({ ...entry, home, dryRun }));
    }
    if (!dryRun) {
      for (const item of retired) {
        assertSafeDestination(item.destination, home);
        fs.unlinkSync(item.destination);
      }
      if (target === 'codex') {
        const inventoryPath = codexDestination(CODEX_INVENTORY_SOURCE, home);
        assertSafeDestination(inventoryPath, home);
        fs.writeFileSync(inventoryPath, codexInventoryContent(sources));
      }
      const snapshotPath = path.join(backup.path, 'manifest.json');
      const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
      snapshot.pending = false;
      fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
    }
  } catch (err) {
    const rollback = rollbackForgeflow({ home, target });
    if (rollback.failed.length) err.message += `; rollback failed: ${JSON.stringify(rollback.failed)}`;
    throw err;
  }
  return { copied, retired: retired.map((item) => item.source), preserved_legacy };
}

function installClaude({ home, dryRun = false } = {}) {
  const files = managedSources(repoRoot, 'claude');
  const { copied, retired, preserved_legacy } = installSourcePlan({ home, target: 'claude', sources: files, dryRun });
  return {
    target: 'claude',
    home,
    copied, retired, preserved_legacy,
    manual_steps: [
      'Restart Claude Code after installing commands, agents, hooks, and templates.',
      'The Ember prompt hook is configured automatically; other hooks and statusLine remain under your control.',
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
  const sources = codexSources();
  const { copied, retired, preserved_legacy } = installSourcePlan({ home, target: 'codex', sources, dryRun });
  return {
    target: 'codex',
    home,
    copied, retired, preserved_legacy,
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
  for (const result of results) {
    result.ember = (opts.emberSetup || setupEmber)({ home: result.home, target: result.target, dryRun: Boolean(opts.dryRun) });
  }
  const rtk = setupRtk({ install: Boolean(opts.installRtk), dryRun: Boolean(opts.dryRun), run: opts.rtkRun });
  return {
    schema_version: '1',
    status: opts.installRtk && !['ready', 'planned'].includes(rtk.status) ? 'attention' : 'ok',
    rtk,
    dry_run: Boolean(opts.dryRun),
    results,
  };
}

function renderMarkdown(result) {
  const lines = [
    result.dry_run ? 'Forgeflow template install plan.' : result.status === 'ok' ? 'Forgeflow template install complete.' : 'Forgeflow files installed; optional RTK setup needs attention.',
  ];
  lines.push(`RTK (optional): ${result.rtk.status}. ${result.rtk.action}`);
  if (result.rtk.command) lines.push(`RTK install command: ${result.rtk.command.join(' ')}`);
  if (result.rtk.status === 'missing') lines.push('To install RTK with Cargo, rerun with --install-rtk; preview with --install-rtk --dry-run.');
  for (const item of result.results) {
    lines.push('', `${item.target}: ${item.copied.length} files -> ${item.home}`);
    if (item.retired.length) lines.push(`- Retired old managed files: ${item.retired.length}`);
    for (const source of item.preserved_legacy) lines.push(`- Preserved edited or unverified file: ${source}`);
    if (item.target === 'codex') {
      lines.push(`- agents: ${item.agent_names.length}`);
      lines.push(`- skills: ${item.skill_names.length}`);
      lines.push(`- canonical entrypoints: ${item.canonical_entrypoints.join(', ')}`);
    }
    lines.push(`- Ember: ${item.ember.status}. ${item.ember.action || ''}`);
    for (const check of item.ember.checks || []) if (check.action && check.status !== 'ready') lines.push(`  ${check.name}: ${check.status}. ${check.action}`);
    for (const step of item.manual_steps) lines.push(`- ${step}`);
  }
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = installTemplate(opts);
  if (opts.json) console.log(JSON.stringify(result, null, 2));
  else console.log(renderMarkdown(result));
  if (result.status !== 'ok') process.exitCode = 1;
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
  parseArgs,
  renderMarkdown,
};
