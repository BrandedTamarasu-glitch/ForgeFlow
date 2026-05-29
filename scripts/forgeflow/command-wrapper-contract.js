#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { commandSources } = require('./runtime-inventory');

function usage() {
  console.error('Usage: command-wrapper-contract.js [--root <repo>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function helperReferences(markdown) {
  const refs = new Set();
  const patterns = [
    /\$\{HELPER_DIR\}\/([A-Za-z0-9._-]+\.(?:js|sh))/g,
    /HELPER_DIR\}\/([A-Za-z0-9._-]+\.(?:js|sh))/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(markdown)) !== null) refs.add(match[1]);
  }
  return [...refs].sort();
}

function checkWrapper(source, markdown) {
  const helpers = helperReferences(markdown);
  if (helpers.length === 0 && !markdown.includes('HELPER_DIR=')) return null;
  const issues = [];
  if (!markdown.includes('HELPER_DIR=')) issues.push('missing-helper-dir');
  if (!markdown.includes('$HOME/.claude/forgeflow/scripts/forgeflow')) issues.push('missing-installed-fallback');
  if (!/Run \/update-forgeflow(?: --repair)?/.test(markdown)) issues.push('missing-repair-guidance');
  if (helpers.some((helper) => helper.endsWith('.js')) && !markdown.includes('env -u NODE_OPTIONS -u NODE_PATH node')) {
    issues.push('missing-node-env-scrub');
  }
  if (markdown.includes('${ARGUMENTS') && !markdown.includes('SAFE_ARGS')) issues.push('missing-safe-args');
  return {
    source,
    status: issues.length > 0 ? 'attention' : 'pass',
    helpers,
    issues,
  };
}

function buildCommandWrapperContract(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const wrappers = commandSources(root)
    .map((source) => {
      const markdown = fs.readFileSync(path.join(root, source), 'utf8');
      return checkWrapper(source, markdown);
    })
    .filter(Boolean);
  const issues = wrappers.flatMap((wrapper) => wrapper.issues.map((issue) => ({ source: wrapper.source, issue })));
  return {
    schema_version: '1',
    status: issues.length > 0 ? 'baseline' : 'pass',
    root,
    wrapper_count: wrappers.length,
    issue_count: issues.length,
    wrappers,
    issues,
    boundary: 'Command wrapper contract is read-only. It inventories helper fallback, repair guidance, safe argument forwarding, and Node environment scrubbing but does not edit command files or fail existing baseline drift.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Command Wrapper Contract',
    '',
    `Status: ${result.status}`,
    `Wrappers: ${result.wrapper_count}`,
    `Issues: ${result.issue_count}`,
    '',
    result.boundary,
    '',
  ];
  if (result.issues.length === 0) {
    lines.push('No wrapper contract issues found.', '');
  } else {
    lines.push('## Issues', '');
    for (const issue of result.issues) lines.push(`- ${issue.source}: ${issue.issue}`);
    lines.push('');
  }
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildCommandWrapperContract(opts);
  process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    usage();
    process.exit(1);
  }
}

module.exports = { buildCommandWrapperContract, checkWrapper, helperReferences, parseArgs, renderMarkdown };
