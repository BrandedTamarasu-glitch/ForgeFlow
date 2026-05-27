#!/usr/bin/env node
const path = require('path');
const { spawnSync } = require('child_process');
const { buildReleaseReadiness } = require('./render-release-readiness');

function usage() {
  console.error('Usage: render-release-verify.js [--root <repo>] [--save] [--compare-last] [--github] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), save: false, compareLast: false, github: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--save') {
      opts.save = true;
    } else if (arg === '--compare-last') {
      opts.compareLast = true;
    } else if (arg === '--github') {
      opts.github = true;
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

function githubVerification(root, version, runner = spawnSync) {
  const tag = version ? `v${version}` : '';
  const evidence = [];
  if (!tag) {
    evidence.push({ name: 'github-release', status: 'warn', value: '', clears: 'Set plugin version before checking GitHub.' });
    return { status: 'warn', evidence, boundary: 'GitHub verification is optional and network-aware. It only reads release and remote tag state.' };
  }
  const release = runner('gh', ['release', 'view', tag, '--json', 'tagName,name,isDraft,isPrerelease,url'], { cwd: root, encoding: 'utf8' });
  if (release.status === 0) {
    let parsed = {};
    try {
      parsed = JSON.parse(release.stdout || '{}');
    } catch (_err) {
      parsed = {};
    }
    evidence.push({
      name: 'github-release',
      status: parsed.tagName === tag && parsed.isDraft === false ? 'pass' : 'warn',
      value: parsed.url || tag,
      clears: `Publish GitHub release ${tag}.`,
    });
  } else {
    evidence.push({
      name: 'github-release',
      status: 'warn',
      value: tag,
      clears: `Publish GitHub release ${tag} or rerun where gh can access the repository.`,
    });
  }
  const remoteTag = runner('git', ['ls-remote', '--tags', 'origin', tag], { cwd: root, encoding: 'utf8' });
  evidence.push({
    name: 'remote-tag',
    status: remoteTag.status === 0 && String(remoteTag.stdout || '').includes(`refs/tags/${tag}`) ? 'pass' : 'warn',
    value: tag,
    clears: `Push tag ${tag} to origin or rerun where git can access the remote.`,
  });
  return {
    status: evidence.every((item) => item.status === 'pass') ? 'pass' : 'warn',
    evidence,
    boundary: 'GitHub verification is optional and network-aware. It only reads release and remote tag state.',
  };
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
  const github = opts.github ? githubVerification(path.resolve(opts.root || process.cwd()), post.version || '', opts.githubRunner || spawnSync) : null;
  return {
    schema_version: '1',
    status: post.status || 'missing',
    readiness_status: readiness.status,
    version: post.version || '',
    tag: post.tag || '',
    head: post.head || '',
    summary: post.summary || { passed: [], attention: [], shareable: 'Post-publish verification is unavailable.' },
    evidence: post.evidence || [],
    github_verification: github,
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
  if (result.github_verification) {
    lines.push('', '## GitHub Verification', '', `- Status: ${result.github_verification.status}`);
    for (const item of result.github_verification.evidence || []) {
      lines.push(`- ${item.name}: ${item.status}${item.value ? ` (${item.value})` : ''}`);
      if (item.status !== 'pass' && item.clears) lines.push(`  - Clears: ${item.clears}`);
    }
    lines.push(`- Boundary: ${result.github_verification.boundary}`);
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

module.exports = { buildReleaseVerify, githubVerification, parseArgs, renderMarkdown };
