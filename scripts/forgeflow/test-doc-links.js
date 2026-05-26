#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const docs = [
  'README.md',
  'docs/index.html',
  ...fs.readdirSync(path.join(repoRoot, 'docs', 'wiki'))
    .filter((file) => file.endsWith('.md'))
    .map((file) => `docs/wiki/${file}`),
];

function read(relativePath) {
  const file = path.join(repoRoot, relativePath);
  if (!isRepoRegularFile(file)) {
    throw new Error(`Expected repo-local regular file: ${relativePath}`);
  }
  return fs.readFileSync(file, 'utf8');
}

function isRepoRegularFile(file) {
  const resolved = path.resolve(file);
  if (resolved !== repoRoot && !resolved.startsWith(`${repoRoot}${path.sep}`)) return false;
  try {
    const relative = path.relative(repoRoot, resolved);
    const parts = relative.split(path.sep).filter(Boolean);
    let current = repoRoot;
    for (const part of parts.slice(0, -1)) {
      current = path.join(current, part);
      const stat = fs.lstatSync(current);
      if (!stat.isDirectory() || stat.isSymbolicLink()) return false;
    }
    const stat = fs.lstatSync(resolved);
    if (!stat.isFile() || stat.isSymbolicLink()) return false;
    const rootReal = fs.realpathSync(repoRoot);
    const fileReal = fs.realpathSync(resolved);
    return fileReal.startsWith(`${rootReal}${path.sep}`);
  } catch (_err) {
    return false;
  }
}

function localLinks(markdown) {
  const links = [];
  const markdownRegex = /\[[^\]]+\]\(([^)]+)\)/g;
  const hrefRegex = /\shref="([^"]+)"/g;
  for (const regex of [markdownRegex, hrefRegex]) {
    let match;
    while ((match = regex.exec(markdown)) !== null) {
      links.push(match[1].trim());
    }
  }
  return links
    .filter((target) => target
      && !target.startsWith('http')
      && !target.startsWith('#')
      && !target.startsWith('mailto:')
      && !target.includes('://'))
    .map((target) => target.split('#')[0]);
}

function resolveTarget(source, target) {
  if (!target) return '';
  const base = path.dirname(path.join(repoRoot, source));
  const candidates = [];
  candidates.push(path.resolve(base, target));
  if (!path.extname(target)) {
    candidates.push(path.resolve(base, `${target}.md`));
  }
  return candidates.find(isRepoRegularFile) || candidates[0];
}

function fencedBlocks(markdown) {
  const blocks = [];
  let active = false;
  let language = '';
  let bucket = [];
  for (const line of String(markdown || '').split(/\r?\n/)) {
    const fence = line.match(/^```([A-Za-z0-9_-]*)\s*$/);
    if (fence) {
      if (active) {
        blocks.push({ language, content: bucket.join('\n') });
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
  return blocks;
}

function sectionAfterHeading(markdown, heading) {
  const start = String(markdown || '').indexOf(heading);
  if (start < 0) return '';
  const tail = markdown.slice(start + heading.length);
  const nextHeading = tail.search(/\n##\s+/);
  return nextHeading >= 0 ? tail.slice(0, nextHeading) : tail;
}

function commandBlockAfterHeading(markdown, heading) {
  const section = sectionAfterHeading(markdown, heading);
  if (!section) return [];
  const block = fencedBlocks(section).find((item) => ['bash', 'sh', 'shell', 'zsh', ''].includes(item.language)
    && item.content.split(/\r?\n/).some((line) => /^(node|git)\s+/.test(line.trim())));
  if (!block) return [];
  return block.content.split(/\r?\n/).map((item) => item.trim()).filter((line) => /^(node|git)\s+/.test(line));
}

function releaseCommands(markdown) {
  for (const heading of ['## Step 2: Run release checks', '## Local Checks', '## Command-Line Checks']) {
    const commands = commandBlockAfterHeading(markdown, heading);
    if (commands.length > 0) return commands;
  }
  return [];
}

function commandListDiff(expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  return {
    missing: expected.filter((command) => !actualSet.has(command)),
    extra: actual.filter((command) => !expectedSet.has(command)),
  };
}

function changelogCandidates(version) {
  const exact = `docs/changelogs/v${version}.html`;
  if (!version.endsWith('.0')) return [exact];
  return [exact, `docs/changelogs/v${version.replace(/\.0$/, '')}.html`];
}

function htmlCardHrefByTitle(html, title) {
  const cardRegex = /<a\s+class="card"\s+href="([^"]+)">\s*<strong>([^<]+)<\/strong>/g;
  let match;
  while ((match = cardRegex.exec(html)) !== null) {
    if (match[2] === title) return match[1];
  }
  return '';
}

function firstMarkdownLinkHref(markdown, predicate) {
  const markdownRegex = /\[[^\]]+\]\(([^)]+)\)/g;
  let match;
  while ((match = markdownRegex.exec(markdown)) !== null) {
    const href = match[1].trim();
    if (predicate(href)) return href;
  }
  return '';
}

const failures = [];
for (const source of docs) {
  const markdown = read(source);
  for (const target of localLinks(markdown)) {
    const resolved = resolveTarget(source, target);
    if (!isRepoRegularFile(resolved)) {
      failures.push(`${source}: missing local link ${target}`);
    }
  }
}

const plugin = JSON.parse(read('.claude-plugin/plugin.json'));
const latestChangelogs = changelogCandidates(plugin.version);
const latestChangelog = latestChangelogs.find((candidate) => isRepoRegularFile(path.join(repoRoot, candidate)));
const latestChangelogHref = latestChangelog && `./${latestChangelog.replace(/^docs\//, '')}`;
const latestWikiChangelogHref = latestChangelog && `../${latestChangelog.replace(/^docs\//, '')}`;
const hostedDocs = read('docs/index.html');
const wikiHome = read('docs/wiki/Home.md');
if (!latestChangelog) {
  failures.push(`missing changelog for plugin version ${plugin.version}: ${latestChangelogs.join(' or ')}`);
}
const releaseNotesHref = htmlCardHrefByTitle(hostedDocs, 'Release Notes');
if (latestChangelogHref && releaseNotesHref !== latestChangelogHref) {
  failures.push(`docs/index.html: Release Notes card must link ${latestChangelogHref}`);
}
const startHere = sectionAfterHeading(wikiHome, '## Start Here');
const startHereLatestHref = firstMarkdownLinkHref(startHere, (href) => href.startsWith('../changelogs/'));
if (latestWikiChangelogHref && startHereLatestHref !== latestWikiChangelogHref) {
  failures.push(`docs/wiki/Home.md: Start Here must link ${latestWikiChangelogHref}`);
}

const releaseCheckCommands = releaseCommands(read('commands/forgeflow-release-check.md'));
for (const doc of ['docs/wiki/Release-Gate.md', 'docs/wiki/Release-Process.md']) {
  const commands = releaseCommands(read(doc));
  const diff = commandListDiff(releaseCheckCommands, commands);
  for (const command of diff.missing) {
    failures.push(`${doc}: release-check command missing from docs: ${command}`);
  }
  for (const command of diff.extra) {
    failures.push(`${doc}: extra release-check command not in command source: ${command}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

console.log(`doc links: ok (${docs.length} files)`);
