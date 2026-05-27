#!/usr/bin/env node
const path = require('path');
const { buildReleaseReadiness } = require('./render-release-readiness');

function usage() {
  console.error('Usage: render-release-verify.js [--root <repo>] [--save] [--compare-last] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), save: false, compareLast: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--save') {
      opts.save = true;
    } else if (arg === '--compare-last') {
      opts.compareLast = true;
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

function buildReleaseVerify(opts = {}) {
  const readiness = buildReleaseReadiness({
    root: opts.root,
    runner: opts.runner,
    postPublish: true,
    savePostPublish: Boolean(opts.save),
    comparePostPublishLast: Boolean(opts.compareLast),
  });
  const post = readiness.post_publish_verification || {};
  return {
    schema_version: '1',
    status: post.status || 'missing',
    readiness_status: readiness.status,
    version: post.version || '',
    tag: post.tag || '',
    head: post.head || '',
    summary: post.summary || { passed: [], attention: [], shareable: 'Post-publish verification is unavailable.' },
    evidence: post.evidence || [],
    snapshot: post.snapshot || { path: '', saved: false },
    comparison: post.comparison || null,
    next_command: post.next_command || 'forgeflow-release-readiness --post-publish',
    boundary: post.boundary || 'Release verification is local and advisory. It does not tag, push, publish, call GitHub, or mutate installed files.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Release Verify',
    '',
    `Status: ${result.status}`,
    `Readiness: ${result.readiness_status}`,
    `Version: ${result.version || '(missing)'}`,
    `Tag: ${result.tag || '(missing)'}`,
    `HEAD: ${result.head || '(unknown)'}`,
    `Snapshot: ${result.snapshot.saved ? `saved to ${result.snapshot.path}` : result.snapshot.path || '(none)'}`,
    '',
    result.boundary,
    '',
    '## Shareable Summary',
    '',
    `- ${result.summary.shareable}`,
    '',
    '## Evidence',
    '',
  ];
  if (result.evidence.length === 0) {
    lines.push('- None.');
  } else {
    for (const item of result.evidence) {
      lines.push(`- ${item.name}: ${item.status}${item.value ? ` (${item.value})` : ''}`);
      if (item.status !== 'pass' && item.clears) lines.push(`  - Clears: ${item.clears}`);
    }
  }
  if (result.comparison) {
    lines.push('', '## Snapshot Comparison', '', `- Status: ${result.comparison.status}`);
  }
  lines.push('', `Next: ${result.next_command}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildReleaseVerify(opts);
  process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
  if (result.status === 'repair-needed') process.exit(1);
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

module.exports = { buildReleaseVerify, parseArgs, renderMarkdown };
