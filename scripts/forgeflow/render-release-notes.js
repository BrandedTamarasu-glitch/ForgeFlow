#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { isPathInside, safeReadTextFile } = require('./file-safety');
const { sensitiveMatches } = require('./privacy-boundary');

const DEFAULT_MAX_COMMITS = 12;

function usage() {
  console.error('Usage: render-release-notes.js [--root <repo>] [--max-commits <n>] [--json]');
}

function parseArgs(argv) {
  const opts = {
    root: process.cwd(),
    maxCommits: DEFAULT_MAX_COMMITS,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(argv[++i] || '');
    } else if (arg === '--max-commits') {
      opts.maxCommits = Number.parseInt(argv[++i] || `${DEFAULT_MAX_COMMITS}`, 10);
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
  const issues = issueReferences(commits);
  const releaseCheck = readTextIfPresent(root, 'commands/forgeflow-release-check.md');
  const validationCommands = releaseCheckCommands(releaseCheck);

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
    referenced_issues: issues,
    validation_commands: validationCommands,
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
  lines.push('', '## Referenced Issues', '');
  if (!notes.referenced_issues || notes.referenced_issues.length === 0) {
    lines.push('- No issue references found in recent commit subjects.');
  } else {
    for (const issue of notes.referenced_issues) {
      const commits = issue.commits.map((commit) => commit.sha).join(', ');
      lines.push(`- ${issue.reference}: referenced by ${commits}. Verify issue state before claiming closure.`);
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
  issueReferences,
  issueReferencesFromText,
  publicSafeText,
  releaseNoteSensitiveLabels,
  releaseCheckCommands,
  renderMarkdown,
};
