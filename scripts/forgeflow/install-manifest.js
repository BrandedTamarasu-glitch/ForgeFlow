#!/usr/bin/env node
const path = require('path');

const SCRIPT_EXTENSIONS = new Set(['.js', '.sh']);
const STATIC_FILES = new Set([
  'templates/ship-presentation.html',
  'templates/forgeflow-budget.json',
  'hooks/forgeflow-gate.js',
  'hooks/forgeflow-context-monitor.js',
  'hooks/forgeflow-statusline.js',
  'hooks/forgeflow-telemetry.js',
]);
const RUNTIME_HELPERS = [
  'scripts/forgeflow/advise-context.js',
  'scripts/forgeflow/agent-chat-off.sh',
  'scripts/forgeflow/agent-chat-on.sh',
  'scripts/forgeflow/build-code-topology.js',
  'scripts/forgeflow/build-context-pack.js',
  'scripts/forgeflow/build-memory-context.js',
  'scripts/forgeflow/build-scope-manifest.js',
  'scripts/forgeflow/check-codex-agent-drift.js',
  'scripts/forgeflow/check-context-budget.js',
  'scripts/forgeflow/check-implementation-notes.js',
  'scripts/forgeflow/check-project-learnings.js',
  'scripts/forgeflow/context-telemetry.js',
  'scripts/forgeflow/ensure-forgeflow-state.sh',
  'scripts/forgeflow/explain-review-route.js',
  'scripts/forgeflow/forgeflow-version.js',
  'scripts/forgeflow/generate-codex-agent-stubs.js',
  'scripts/forgeflow/health-check.js',
  'scripts/forgeflow/index-memory.js',
  'scripts/forgeflow/install-template.js',
  'scripts/forgeflow/install-manifest.js',
  'scripts/forgeflow/record-pilot-evidence.js',
  'scripts/forgeflow/record-project-learning.js',
  'scripts/forgeflow/record-review-outcome.js',
  'scripts/forgeflow/record-implementation-notes.js',
  'scripts/forgeflow/render-ship-presentation.js',
  'scripts/forgeflow/render-evaluation-report.js',
  'scripts/forgeflow/rollup-pilot-evidence.js',
  'scripts/forgeflow/rollup-project-learnings.js',
  'scripts/forgeflow/seed-budget-config.js',
  'scripts/forgeflow/show-code-map.js',
  'scripts/forgeflow/show-project-learnings.js',
  'scripts/forgeflow/ship-ci-status.sh',
  'scripts/forgeflow/ship-open-pr.sh',
  'scripts/forgeflow/ship-prepare.sh',
  'scripts/forgeflow/summarize-calibration.js',
  'scripts/forgeflow/summarize-context-telemetry.js',
  'scripts/forgeflow/update-forgeflow.js',
];

function usage() {
  console.error('Usage: install-manifest.js [--source <path>] [--dest <home>] [--json]');
}

function parseArgs(argv) {
  const opts = {
    source: '',
    home: '',
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--source') {
      opts.source = argv[++i] || '';
    } else if (arg === '--dest') {
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

function normalize(file) {
  return String(file || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function categoryFor(source) {
  const file = normalize(source);
  if (/^agents\/[^/]+\.md$/.test(file)) return 'agent';
  if (/^agents\/_shared\/[^/]+\.md$/.test(file)) return 'shared-agent';
  if (/^commands\/[^/]+(?:\/[^/]+)?\.md$/.test(file)) return 'command';
  if (/^project-rules\/[^/]+\.md$/.test(file)) return 'project-rule';
  if (/^forgeflow-patterns\/[^/]+\.md$/.test(file)) return 'pattern';
  if (STATIC_FILES.has(file)) return file.split('/')[0].slice(0, -1);
  if (RUNTIME_HELPERS.includes(file) && SCRIPT_EXTENSIONS.has(path.extname(file))) return 'runtime-script';
  return '';
}

function isManagedSource(source) {
  return categoryFor(source) !== '';
}

function shouldPreserveDestination(source) {
  const file = normalize(source);
  return /^agents\/custom-[^/]+\.md$/.test(file);
}

function destinationFor(source, home = '~/.claude') {
  const file = normalize(source);
  if (!isManagedSource(file)) return '';
  if (/^agents\/[^/]+\.md$/.test(file)) return path.posix.join(home, file);
  if (/^agents\/_shared\/[^/]+\.md$/.test(file)) return path.posix.join(home, file);
  if (/^commands\/[^/]+(?:\/[^/]+)?\.md$/.test(file)) return path.posix.join(home, file);
  if (/^project-rules\/[^/]+\.md$/.test(file)) return path.posix.join(home, file);
  if (/^forgeflow-patterns\/[^/]+\.md$/.test(file)) return path.posix.join(home, file);
  if (/^templates\/[^/]+$/.test(file)) return path.posix.join(home, file);
  if (/^hooks\/[^/]+$/.test(file)) return path.posix.join(home, file);
  if (/^scripts\/forgeflow\/[^/]+$/.test(file)) {
    return path.posix.join(home, 'forgeflow', file);
  }
  return '';
}

function manifestEntry(source, home = '~/.claude') {
  const file = normalize(source);
  const category = categoryFor(file);
  if (!category) return null;
  return {
    source: file,
    destination: destinationFor(file, home),
    category,
    preserve: shouldPreserveDestination(file),
    executable: category === 'runtime-script',
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.source) {
    usage();
    process.exit(2);
  }
  const entry = manifestEntry(opts.source, opts.home || '~/.claude');
  if (!entry) {
    process.exit(1);
  }
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(entry, null, 2)}\n`);
  } else {
    console.log(entry.destination);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  RUNTIME_HELPERS,
  STATIC_FILES,
  categoryFor,
  destinationFor,
  isManagedSource,
  manifestEntry,
  shouldPreserveDestination,
};
