#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function usage() {
  console.error('Usage: seed-budget-config.js [--root <dir>] [--template <json>] [--out <json>] [--force] [--json]');
}

function parseArgs(argv) {
  const opts = {
    root: '',
    template: '',
    out: '',
    force: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(argv[++i] || '');
    } else if (arg === '--template') {
      opts.template = path.resolve(argv[++i] || '');
    } else if (arg === '--out') {
      opts.out = path.resolve(argv[++i] || '');
    } else if (arg === '--force') {
      opts.force = true;
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

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) return '';
  return result.stdout.trimEnd();
}

function repoRoot(cwd = process.cwd()) {
  return git(['rev-parse', '--show-toplevel'], cwd) || cwd;
}

function helperRoot() {
  return path.resolve(__dirname, '..', '..');
}

function defaultTemplate() {
  return path.join(helperRoot(), 'templates', 'forgeflow-budget.json');
}

function defaultOut(root) {
  return path.join(root, '.forgeflow-budget.json');
}

function seedBudgetConfig(opts = {}) {
  const root = opts.root || repoRoot();
  const template = opts.template || defaultTemplate();
  const out = opts.out || defaultOut(root);

  if (!fs.existsSync(template)) {
    throw new Error(`Budget template not found: ${template}`);
  }
  if (fs.existsSync(out) && !opts.force) {
    return { status: 'exists', out, template, written: false };
  }

  const parsed = JSON.parse(fs.readFileSync(template, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Budget template must be a JSON object');
  }

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(parsed, null, 2)}\n`);
  return { status: fs.existsSync(out) ? 'written' : 'missing', out, template, written: true };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = seedBudgetConfig(opts);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (result.written) {
    console.log(`Seeded Forgeflow budget config: ${result.out}`);
  } else {
    console.log(`Forgeflow budget config already exists: ${result.out}`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = {
  defaultOut,
  defaultTemplate,
  seedBudgetConfig,
};
