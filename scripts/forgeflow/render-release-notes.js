#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { isPathInside, safeReadTextFile } = require('./file-safety');
const { sensitiveMatches } = require('./privacy-boundary');

const DEFAULT_MAX_COMMITS = 12;

function usage() {
  console.error('Usage: render-release-notes.js [--root <repo>] [--max-commits <n>] [--issues <json>] [--evidence <json>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = {
    root: process.cwd(),
    maxCommits: DEFAULT_MAX_COMMITS,
    issues: '',
    evidence: '',
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--max-commits') {
      opts.maxCommits = Number.parseInt(requireValue(argv, arg, i), 10);
      i += 1;
    } else if (arg === '--issues') {
      opts.issues = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--evidence') {
      opts.evidence = requireValue(argv, arg, i);
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

function safeRepoPath(root, relativePath) {
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.split(/[\\/]+/).includes('..')) {
    throw new Error('Unsafe release notes path');
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  if (!isPathInside(resolvedRoot, resolved)) {
    throw new Error('Release notes path escapes repo');
  }
  return resolved;
}

function readJson(root, relativePath) {
  return JSON.parse(safeReadTextFile(safeRepoPath(root, relativePath), root).content);
}

function readTextIfPresent(root, relativePath) {
  const file = safeRepoPath(root, relativePath);
  if (!fs.existsSync(file)) return '';
  return safeReadTextFile(file, root).content;
}

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return {
    ok: result.status === 0,
    stdout: result.status === 0 ? result.stdout.trimEnd() : '',
    error: result.status === 0 ? '' : (result.stderr || result.error?.message || 'git command failed').trim(),
  };
}

function gitStdout(root, args) {
  return git(root, args).stdout;
}

function changelogCandidates(version) {
  const exact = `docs/changelogs/v${version}.html`;
  const patchZero = String(version || '').endsWith('.0')
    ? `docs/changelogs/v${String(version).replace(/\.0$/, '')}.html`
    : '';
  return patchZero ? [exact, patchZero] : [exact];
}

function matchingChangelog(root, version) {
  return changelogCandidates(version).find((candidate) => fs.existsSync(safeRepoPath(root, candidate))) || '';
}

function stripTags(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function changelogTitle(content) {
  const match = String(content || '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? stripTags(match[1]) : '';
}

function publicSafeText(value) {
  const labels = [...new Set([
    ...sensitiveMatches(value),
    ...releaseNoteSensitiveLabels(value),
  ])];
  if (labels.length === 0) return String(value || '').replace(/\s+/g, ' ').trim();
  return `[redacted sensitive content: ${labels.sort().join(', ')}]`;
}

function releaseNoteSensitiveLabels(value) {
  const text = String(value || '');
  const labels = [];
  if (/(^|[\s("'`=:])\/(?:home|Users|var|etc|tmp|private|opt|root|mnt|Volumes)\/[^\s)"'`]+/i.test(text)) {
    labels.push('local-path');
  }
  if (/(^|[\s("'`=:])(?:\.{1,2}\/|~\/)[^\s)"'`]+/.test(text)) {
    labels.push('local-path');
  }
  if (/(^|[\s("'`=:])(?:[A-Za-z]:\\|\\\\)[^\s)"'`]+/.test(text)) {
    labels.push('local-path');
  }
  return labels;
}

function markdownText(value) {
  return String(value || '').replace(/([\\`*_{}\[\]()#+.!|-])/g, '\\$1');
}

function recentCommits(root, maxCommits) {
  const limit = Number.isFinite(maxCommits) && maxCommits > 0 ? maxCommits : DEFAULT_MAX_COMMITS;
  const output = gitStdout(root, ['log', `-${limit}`, '--pretty=format:%h%x09%s']);
  if (!output) return [];
  return output.split(/\r?\n/).filter(Boolean).map((line) => {
    const [sha, ...subjectParts] = line.split('\t');
    const subject = subjectParts.join('\t');
    const redacted = sensitiveMatches(subject).length > 0 || releaseNoteSensitiveLabels(subject).length > 0;
    const safeSubject = publicSafeText(subject);
    return {
      sha,
      subject: safeSubject,
      redacted,
    };
  });
}

function issueReferencesFromText(value) {
  const text = String(value || '');
  const refs = [];
  const seen = new Set();
  const issuePattern = /(?:^|[^\w/])#([1-9][0-9]*)\b/g;
  let match;
  while ((match = issuePattern.exec(text)) !== null) {
    const number = Number.parseInt(match[1], 10);
    if (!Number.isFinite(number) || seen.has(number)) continue;
    seen.add(number);
    refs.push(number);
  }
  return refs;
}

function issueReferences(commits = []) {
  const buckets = new Map();
  for (const commit of commits || []) {
    for (const number of issueReferencesFromText(commit.subject)) {
      if (!buckets.has(number)) {
        buckets.set(number, {
          number,
          reference: `#${number}`,
          commits: [],
        });
      }
      buckets.get(number).commits.push({
        sha: commit.sha,
        subject: commit.subject,
      });
    }
  }
  return [...buckets.values()].sort((a, b) => a.number - b.number);
}

function safeIssueStatus(value) {
  const status = String(value || '').trim();
  return ['open', 'closed', 'fixed', 'deferred', 'unknown'].includes(status) ? status : 'unknown';
}

function issueMetadata(root, relativePath) {
  if (!relativePath) return [];
  const data = readJson(root, relativePath);
  if (!data || !Array.isArray(data.issues)) {
    throw new Error('Release issue metadata must be a JSON object with an issues array');
  }
  const issues = data.issues;
  return issues
    .map((issue) => {
      const number = Number.parseInt(issue.number, 10);
      if (!Number.isFinite(number) || number <= 0) return null;
      return {
        number,
        reference: `#${number}`,
        title: publicSafeText(issue.title || ''),
        status: safeIssueStatus(issue.status),
        evidence: publicSafeText(issue.evidence || ''),
      };
    })
    .filter(Boolean);
}

function mergeIssueMetadata(references = [], metadata = []) {
  const buckets = new Map();
  for (const issue of references) {
    buckets.set(issue.number, { ...issue });
  }
  for (const issue of metadata) {
    const existing = buckets.get(issue.number) || {
      number: issue.number,
      reference: issue.reference,
      commits: [],
    };
    buckets.set(issue.number, {
      ...existing,
      title: issue.title,
      status: issue.status,
      evidence: issue.evidence,
    });
  }
  return [...buckets.values()].sort((a, b) => a.number - b.number);
}

function releaseCheckCommands(releaseCheck) {
  const text = String(releaseCheck || '');
  const fenced = [];
  let active = false;
  let language = '';
  let bucket = [];
  for (const line of text.split(/\r?\n/)) {
    const fence = line.match(/^```([A-Za-z0-9_-]*)\s*$/);
    if (fence) {
      if (active) {
        if (!language || language === 'bash' || language === 'sh') fenced.push(bucket.join('\n'));
        active = false;
        language = '';
        bucket = [];
      } else {
        active = true;
        language = (fence[1] || '').toLowerCase();
        bucket = [];
      }
      continue;
    }
    if (active) bucket.push(line);
  }
  const source = fenced.length > 0 ? fenced.join('\n') : text;
  return [...new Set(source.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^(node|git)\s+/.test(line))
    .filter((line) => !line.startsWith('node scripts/forgeflow/render-evaluation-report.js --outcomes')))];
}

function releaseEvidence(root, relativePath) {
  if (!relativePath) return null;
  const evidence = readJson(root, relativePath);
  return {
    status: evidence.status || '',
    version: evidence.version || '',
    tag: evidence.tag || '',
    evidence: Array.isArray(evidence.evidence) ? evidence.evidence.map((item) => ({
      name: publicSafeText(item.name || ''),
      status: publicSafeText(item.status || ''),
      value: publicSafeText(item.value || ''),
    })) : [],
    local_consumability: evidence.local_consumability ? {
      status: publicSafeText(evidence.local_consumability.status || ''),
      drift_count: evidence.local_consumability.runtime_drift ? evidence.local_consumability.runtime_drift.drift_count || 0 : 0,
    } : null,
  };
}

function collectReleaseNotes(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const plugin = readJson(root, '.claude-plugin/plugin.json');
  const marketplace = readJson(root, '.claude-plugin/marketplace.json');
  const marketplaceEntry = (marketplace.plugins || []).find((entry) => entry.name === plugin.name) || null;
  const changelogPath = matchingChangelog(root, plugin.version);
  const changelog = changelogPath ? readTextIfPresent(root, changelogPath) : '';
  const status = git(root, ['status', '--short']);
  const head = git(root, ['rev-parse', '--short', 'HEAD']);
  const commits = recentCommits(root, opts.maxCommits);
  const issues = mergeIssueMetadata(issueReferences(commits), issueMetadata(root, opts.issues || ''));
  const releaseCheck = readTextIfPresent(root, 'commands/forgeflow-release-check.md');
  const validationCommands = releaseCheckCommands(releaseCheck);
  const evidence = releaseEvidence(root, opts.evidence || '');
  const changedFiles = gitStdout(root, ['diff', '--name-only', 'HEAD']).split(/\r?\n/).filter(Boolean).map(publicSafeText);

  return {
    schema_version: '1',
    version: plugin.version,
    plugin_name: plugin.name,
    marketplace_version: marketplaceEntry ? marketplaceEntry.version : '',
    changelog_path: changelogPath,
    changelog_title: publicSafeText(changelogTitle(changelog)),
    git: {
      available: status.ok && head.ok,
      head: head.stdout,
      status: status.ok ? 'available' : 'unavailable',
      dirty: status.ok ? status.stdout.trim().length > 0 : null,
      changed_files: status.ok ? status.stdout.split(/\r?\n/).filter(Boolean).length : null,
      error: status.ok && head.ok ? '' : (status.error || head.error || 'git unavailable'),
    },
    commits,
    changed_files: changedFiles,
    issue_context: issues,
    referenced_issues: issues,
    validation_commands: validationCommands,
    release_evidence: evidence,
    public_safe_highlights: commits.slice(0, 6).map((commit) => commit.subject),
    draft_notes: [
      'Use this draft as release-note input, not as proof that validation passed.',
      'Keep raw local artifacts private; share public-safe highlights and command evidence only.',
      'Run the release gate before tagging or publishing.',
    ],
  };
}

function renderMarkdown(notes) {
  const lines = [
    `# Forgeflow ${notes.version} Release Notes Draft`,
    '',
    `Plugin: ${notes.plugin_name}`,
    `Marketplace version: ${notes.marketplace_version || 'missing'}`,
    `Changelog: ${notes.changelog_path || 'missing'}`,
  ];
  if (notes.changelog_title) lines.push(`Changelog title: ${markdownText(notes.changelog_title)}`);
  lines.push(
    notes.git.available
      ? `Git: ${notes.git.head || 'unknown'}${notes.git.dirty ? `, dirty (${notes.git.changed_files} changed)` : ', clean'}`
      : `Git: unavailable${notes.git.error ? ` (${markdownText(notes.git.error)})` : ''}`,
    '',
    '## Public-Safe Highlights',
    '',
  );
  if (notes.public_safe_highlights.length === 0) lines.push('- No recent commits found.');
  else for (const item of notes.public_safe_highlights) lines.push(`- ${markdownText(item)}`);
  lines.push('', '## Recent Commits', '');
  if (notes.commits.length === 0) lines.push('- No recent commits found.');
  else for (const commit of notes.commits) lines.push(`- ${commit.sha}: ${markdownText(commit.subject)}`);
  lines.push('', '## Changed Files', '');
  if (!notes.changed_files || notes.changed_files.length === 0) lines.push('- No uncommitted changed files.');
  else for (const file of notes.changed_files.slice(0, 20)) lines.push(`- ${markdownText(file)}`);
  if (notes.changed_files && notes.changed_files.length > 20) lines.push(`- ... ${notes.changed_files.length - 20} more`);
  lines.push('', '## Captured Release Evidence', '');
  if (!notes.release_evidence) {
    lines.push('- No release evidence JSON supplied. Run release checks before claiming validation passed.');
  } else {
    lines.push(`- Status: ${markdownText(notes.release_evidence.status)}`);
    lines.push(`- Version: ${markdownText(notes.release_evidence.version)}`);
    lines.push(`- Tag: ${markdownText(notes.release_evidence.tag)}`);
    if (notes.release_evidence.local_consumability) lines.push(`- Install consumability: ${markdownText(notes.release_evidence.local_consumability.status)} (${notes.release_evidence.local_consumability.drift_count} drifted helper(s))`);
  }
  const issueContext = notes.issue_context || notes.referenced_issues || [];
  lines.push('', '## Issue Context', '');
  if (issueContext.length === 0) {
    lines.push('- No issue references found in recent commit subjects or curated issue metadata.');
  } else {
    for (const issue of issueContext) {
      const commits = issue.commits.map((commit) => commit.sha).join(', ');
      const detail = [
        issue.title ? markdownText(issue.title) : '',
        issue.status ? `status ${markdownText(issue.status)}` : '',
        commits ? `referenced by ${commits}` : 'curated metadata only',
        issue.evidence ? `evidence: ${markdownText(issue.evidence)}` : '',
      ].filter(Boolean).join('; ');
      lines.push(`- ${issue.reference}: ${detail}. Verify issue state and source before claiming closure.`);
    }
  }
  lines.push('', '## Validation Evidence To Capture', '');
  if (notes.validation_commands.length === 0) lines.push('- Release-check command list not found.');
  else for (const command of notes.validation_commands) lines.push(`- \`${command}\``);
  lines.push('', '## Draft Boundaries', '');
  for (const item of notes.draft_notes) lines.push(`- ${item}`);
  lines.push('');
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const notes = collectReleaseNotes(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(notes, null, 2)}\n` : renderMarkdown(notes));
  } catch (err) {
    console.error(err.message);
    usage();
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  changelogCandidates,
  collectReleaseNotes,
  issueMetadata,
  mergeIssueMetadata,
  parseArgs,
  issueReferences,
  issueReferencesFromText,
  publicSafeText,
  releaseNoteSensitiveLabels,
  releaseCheckCommands,
  renderMarkdown,
};
