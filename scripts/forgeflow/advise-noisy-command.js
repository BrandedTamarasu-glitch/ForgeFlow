#!/usr/bin/env node
const fs = require('fs');

const RULES = [
  { pattern: /\bgit\s+diff\b.*--name-(only|status)\b/, severity: 'attention', action: 'keep-exact-file-list-raw', suggestion: 'Exact file lists are correctness-critical; keep this output raw and do not compact it.' },
  { pattern: /\bgit\s+status\b.*--porcelain\b/, severity: 'attention', action: 'keep-porcelain-status-raw', suggestion: 'Porcelain status is machine-readable exact output; keep it raw and do not compact it.' },
  { pattern: /\bgit\s+diff\b(?![^|]*--stat)/, severity: 'info', action: 'prefer-git-diff-stat-first', suggestion: 'Use git diff --stat first; request exact diff only when needed.' },
  { pattern: /\bfind\b(?=.*(?:^|\s)\.(?:\s|$))(?![^|]*-maxdepth)/, severity: 'attention', action: 'bound-find-depth', suggestion: 'Use find with -maxdepth and exclude generated directories.' },
  { pattern: /\btree\b(?![^|]*-L\s+\d+)/, severity: 'attention', action: 'bound-tree-depth', suggestion: 'Use tree -L <depth> and exclude node_modules/.git/dist/build.' },
  { pattern: /(^|\s)(ls|du)\b.*(^|\s)-R(\s|$)/, severity: 'attention', action: 'avoid-recursive-dump', suggestion: 'Use targeted paths or depth-limited listing instead of recursive dumps.' },
  { pattern: /\b(jest|vitest|playwright|npm\s+test|pnpm\s+test)\b(?![^|]*(tail|run\s+\S+|[^\s]+\.(test|spec)\.[cm]?[jt]sx?))/, severity: 'info', action: 'capture-failure-tail', suggestion: 'For long test runs, capture failures and keep a short tail of raw output.' },
  { pattern: /\b(tsc|next\s+build)\b(?![^|]*(pretty\s+false|grep|tail))/, severity: 'info', action: 'filter-build-errors', suggestion: 'Prefer no-color or pretty=false output and keep errors/warnings only.' },
];

function usage() {
  console.error('Usage: advise-noisy-command.js [--command <cmd>] [--json]');
}

function parseArgs(argv) {
  const opts = { command: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--command') {
      opts.command = argv[++i] || '';
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

function adviseCommand(command) {
  const text = String(command || '').trim();
  const recommendations = RULES
    .filter((rule) => rule.pattern.test(text))
    .map((rule) => ({
      severity: rule.severity,
      action: rule.action,
      suggestion: rule.suggestion,
    }));
  return {
    schema_version: '1',
    status: recommendations.length > 0 ? 'attention' : 'pass',
    command: text,
    recommendations,
  };
}

function render(result) {
  if (result.recommendations.length === 0) return 'No noisy-command recommendations.\n';
  return [
    '# Forgeflow Noisy Command Advisor',
    '',
    `Command: ${result.command}`,
    '',
    ...result.recommendations.map((item) => `- ${item.severity}: ${item.suggestion} (${item.action})`),
    '',
  ].join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const command = opts.command || fs.readFileSync(0, 'utf8').trim();
  const result = adviseCommand(command);
  if (opts.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else process.stdout.write(render(result));
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.stack || err.message);
    process.exit(1);
  }
}

module.exports = {
  adviseCommand,
  RULES,
};
