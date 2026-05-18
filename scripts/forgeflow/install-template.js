#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  isManagedSource,
  manifestEntry,
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

function relative(file) {
  return path.relative(repoRoot, file).replace(/\\/g, '/');
}

function copyFile({ source, destination, executable = false, dryRun = false }) {
  if (!dryRun) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, source), destination);
    fs.chmodSync(destination, executable ? 0o755 : 0o644);
  }
  return { source, destination };
}

function installClaude({ home, dryRun = false } = {}) {
  const files = CLAUDE_SOURCE_DIRS.flatMap((dir) => walk(path.join(repoRoot, dir)))
    .map(relative)
    .filter(isManagedSource)
    .sort();
  const copied = [];
  for (const source of files) {
    const entry = manifestEntry(source, home);
    if (!entry || entry.preserve) continue;
    copied.push(copyFile({
      source,
      destination: entry.destination,
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
  const agents = walk(path.join(repoRoot, '.codex', 'agents'))
    .map(relative)
    .filter((source) => /^\.codex\/agents\/[^/]+\.toml$/.test(source));
  const skills = walk(path.join(repoRoot, '.agents', 'skills'))
    .map(relative)
    .filter((source) => /^\.agents\/skills\/[^/]+\/.+/.test(source));
  const support = ['.codex/agent-canonical-map.json'];
  return [...agents, ...skills, ...support.filter((source) => fs.existsSync(path.join(repoRoot, source)))].sort();
}

function codexDestination(source, home) {
  if (source.startsWith('.codex/agents/')) {
    return path.join(home, 'agents', path.basename(source));
  }
  if (source.startsWith('.agents/skills/')) {
    return path.join(home, 'skills', source.replace(/^\.agents\/skills\//, ''));
  }
  if (source === '.codex/agent-canonical-map.json') {
    return path.join(home, 'forgeflow', 'agent-canonical-map.json');
  }
  return '';
}

function installCodex({ home, dryRun = false } = {}) {
  const copied = [];
  for (const source of codexSources()) {
    copied.push(copyFile({
      source,
      destination: codexDestination(source, home),
      dryRun,
    }));
  }
  return {
    target: 'codex',
    home,
    copied,
    manual_steps: [
      'Restart Codex so copied agents and skills are discovered.',
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
  renderMarkdown,
};
