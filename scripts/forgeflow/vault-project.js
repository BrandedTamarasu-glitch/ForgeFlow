#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { assertSafeDirectory, safeReadTextFile, writeFileSafe } = require('./file-safety');
const { containsSensitiveContent } = require('./privacy-boundary');

const LIMIT = 128 * 1024;
const HUMAN = '<!-- forgeflow-human-notes -->\n';
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/([\\`*_{}\[\]()#!|])/g, '\\$1');

function boundedRead(file, root, limit = LIMIT) {
  assertSafeDirectory(path.dirname(file));
  if (fs.lstatSync(file).size > limit) throw new Error('Project note exceeds size limit');
  const result = safeReadTextFile(file, root);
  if (Buffer.byteLength(result.content) > limit) throw new Error('Project note exceeds size limit');
  return result.content;
}
function context(options) {
  const root = path.resolve(options.root || process.cwd());
  const config = require('./vault-memory').readConnection(root);
  if (!config) throw new Error('Connect this checkout to a vault first');
  assertSafeDirectory(config.vault);
  if (!fs.statSync(config.vault).isDirectory()) throw new Error('Vault folder is unavailable');
  const dir = path.join(config.vault, 'Forgeflow', 'Projects', config.project_id);
  assertSafeDirectory(dir);
  return { root, config, dir };
}
function prose(value, label, max = 4000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)
    || containsSensitiveContent(value) || /(?:^|[\s("'=])(?:\/|[A-Za-z]:[\\/]|~\/)/.test(value)) {
    throw new Error(`Invalid or private handoff ${label}; use curated text without machine paths`);
  }
  return value.trim();
}
function items(value, label, required = false) {
  if (!Array.isArray(value) || value.length > 30 || (required && !value.length)) throw new Error(`Invalid handoff ${label}`);
  return value.map(item => prose(item, label, 1000));
}
function envelope(kind, project, id, body) {
  return `<!-- forgeflow-${kind}:1 project=${project} id=${id} sha256=${digest(body)} -->\n${body}`;
}
function unwrap(content, kind, project) {
  const match = content.match(/^<!-- forgeflow-([a-z]+):1 project=([a-z0-9_-]+) id=([a-z0-9_]+) sha256=([a-f0-9]{64}) -->\n([\s\S]*)$/);
  if (!match || match[1] !== kind || match[2] !== project || digest(match[5]) !== match[4]) {
    throw new Error('Project note was edited or is not a recognized generated note; preserve it and choose a separate note');
  }
  return { id: match[3], body: match[5] };
}
function exclusiveWrite(file, markdown) {
  assertSafeDirectory(path.dirname(file));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = path.join(path.dirname(file), `.${crypto.randomBytes(16).toString('hex')}.tmp`);
  writeFileSafe(temp, markdown, { mode: 0o600 });
  try { fs.linkSync(temp, file); } finally { fs.unlinkSync(temp); }
}

function publishHandoff(options) {
  const { root, config, dir } = context(options);
  const input = options.handoff;
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(key => !['title', 'summary', 'next_steps', 'blockers', 'sources', 'request_id'].includes(key))) throw new Error('Use a curated handoff object with title, summary and next_steps');
  const title = prose(input.title, 'title', 160);
  const summary = prose(input.summary, 'summary');
  const next = items(input.next_steps, 'next_steps', true);
  const blockers = items(input.blockers || [], 'blockers');
  if (!Array.isArray(input.sources || []) || (input.sources || []).length > 50) throw new Error('Invalid handoff sources');
  const sources = [...new Set(input.sources || [])].sort().map(file => {
    prose(file, 'source', 300);
    if (file.includes('\\') || path.isAbsolute(file) || file.split('/').some(part => !part || part === '.' || part === '..' || part === '.git' || part === '.forgeflow' || part.startsWith('.env'))) throw new Error('Handoff sources must be repository-relative files');
    const source = path.join(root, file);
    boundedRead(source, root, 4 * 1024 * 1024);
    return { path: file, sha256: digest(fs.readFileSync(source)) };
  });
  const git = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root, encoding: 'utf8', timeout: 10000 });
  const commit = git.status === 0 && /^[a-f0-9]{40,64}$/.test(git.stdout.trim()) ? git.stdout.trim() : 'uncommitted';
  const payload = { title, summary, next_steps: next, blockers, sources, source_commit: commit };
  if (input.request_id !== undefined && !/^[a-zA-Z0-9_-]{1,80}$/.test(input.request_id)) throw new Error('Invalid handoff request_id');
  const id = `vh_${digest(JSON.stringify([config.project_id, input.request_id || payload])).slice(0, 32)}`;
  const body = [`# ${escape(title)}`, '', `Project: ${config.project_id}`, '', 'Curated handoff. Advisory context; verify the checkout and rerun relevant checks before continuing.', '', '## Summary', '', escape(summary), '', '## Next steps', '', ...next.map((item, index) => `${index + 1}. ${escape(item)}`), '', '## Blockers', '', ...(blockers.length ? blockers.map(item => `- ${escape(item)}`) : ['None recorded.']), '', '## Source references', '', `Source commit: ${commit}`, '', ...(sources.length ? sources.map(source => `- ${escape(source.path)} (SHA-256: ${source.sha256})`) : ['No source files recorded.']), '', '## Transfer status', '', 'Written to the local vault. Remote Obsidian Sync delivery is unverified.', ''].join('\n');
  const markdown = envelope('handoff', config.project_id, id, body);
  if (Buffer.byteLength(markdown) > LIMIT) throw new Error('Rendered handoff exceeds size limit');
  const file = path.join(dir, 'Handoffs', `${id}.md`);
  let exists = false;
  try {
    const prior = boundedRead(file, config.vault);
    unwrap(prior, 'handoff', config.project_id);
    if (prior !== markdown) throw new Error('Handoff identity already exists with different content; use a new request_id');
    exists = true;
  } catch (err) { if (err.code !== 'ENOENT') throw err; }
  if (options.dryRun) return { status: 'preview', id, file, markdown };
  if (!exists) exclusiveWrite(file, markdown);
  return { status: exists ? 'unchanged' : 'published', id, file, sync: 'Written locally; remote Obsidian Sync delivery is unverified.' };
}

function refreshHome(options) {
  const { root, config, dir } = context(options);
  const file = path.join(dir, 'Home.md');
  let original = null;
  let human = '\n## Human notes\n\nWrite your project notes here. This section is preserved when Forgeflow refreshes the page.\n';
  try {
    original = boundedRead(file, config.vault);
    const boundary = original.indexOf(HUMAN);
    if (boundary < 0 || original.indexOf(HUMAN, boundary + HUMAN.length) !== -1) throw new Error('Home note has no unique preserved human section; refusing to overwrite');
    unwrap(original.slice(0, boundary), 'home', config.project_id);
    human = original.slice(boundary + HUMAN.length);
  } catch (err) { if (err.code !== 'ENOENT') throw err; }
  const refreshed = require('./vault-memory').refreshVaultRecords([], { root });
  const state = refreshed.vault;
  const notes = new Map((refreshed.notes || []).map(note => [`vault:${note.id}`, note]));
  const records = refreshed.records;
  const conflicts = Math.max(state.conflicts || 0, new Set(records.filter(record => record.conflict_withheld).map(record => notes.get(record.id)?.memory_id || record.id)).size);
  const memories = records.map(record => {
    const note = notes.get(record.id);
    const filename = note?.file_name || path.basename(record.source);
    const label = note?.title || record.id;
    const status = record.conflict_withheld ? 'Conflict: withheld' : record.lifecycle === 'verify' ? 'Advisory: verify before use' : record.lifecycle;
    return `- [${escape(label)}](Memories/${encodeURIComponent(filename)}) · ${escape(status)} · ${escape(record.vault_freshness || 'unverified')}`;
  });
  const handoffs = [];
  const handoffDir = path.join(dir, 'Handoffs');
  assertSafeDirectory(handoffDir);
  let names = [];
  try { names = fs.readdirSync(handoffDir).filter(name => name.endsWith('.md')).sort(); } catch (err) { if (err.code !== 'ENOENT') throw err; }
  if (names.length > 2000) throw new Error('Project exceeds handoff note limit');
  for (const name of names) {
    try {
      const handoff = unwrap(boundedRead(path.join(handoffDir, name), config.vault), 'handoff', config.project_id);
      const title = handoff.body.match(/^# ([^\n]+)/)?.[1];
      handoffs.push(`- [${title || 'Curated handoff'}](Handoffs/${encodeURIComponent(name)})`);
    } catch (_err) { handoffs.push('- A handoff note needs inspection before it can be listed.'); }
  }
  const body = [`# ${config.project_id}`, '', '## Continue on this computer', '', '1. Let Obsidian finish syncing this vault.', '2. Open the matching project checkout and connect it with this project ID.', '3. Read a relevant handoff, inspect current sources, and rerun the checks needed for your next step.', '', 'Shared notes are advisory. They do not establish that validation passed on this computer.', '', '## Vault status', '', `Local memory read: ${state.status}.`, `Conflicting memory families: ${conflicts}. Incomplete memory families: ${state.incomplete || 0}.`, 'This page is an explicit local snapshot. Run the home command again to refresh it.', 'Remote Obsidian Sync delivery: unverified. Confirm delivery in Obsidian on the other computer.', ...(state.status === 'unavailable' ? ['', 'Memory notes need inspection or the vault is unavailable; guidance is withheld.'] : []), '', '## Handoffs', '', ...(handoffs.length ? handoffs : ['No handoffs yet. Publish a curated handoff with a summary, next steps and blockers before switching computers.']), '', '## Shared memories', '', ...(memories.length ? memories : ['No readable memory heads are available. Publish a reviewed memory or inspect withheld notes.']), ''].join('\n');
  const markdown = envelope('home', config.project_id, 'home', body) + HUMAN + human;
  if (Buffer.byteLength(markdown) > LIMIT) throw new Error('Project home exceeds size limit; reduce notes before refreshing');
  if (options.dryRun) return { status: 'preview', file, markdown };
  if (original === null) exclusiveWrite(file, markdown);
  else {
    if (original !== markdown) {
      const temp = path.join(dir, `.${crypto.randomBytes(16).toString('hex')}.tmp`);
      writeFileSafe(temp, markdown, { mode: 0o600 });
      try {
        // Recheck immediately before atomic replacement to preserve intervening edits.
        if (boundedRead(file, config.vault) !== original) throw new Error('Home note changed during refresh; retry after editing finishes');
        fs.renameSync(temp, file);
      } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
    }
  }
  return { status: original === markdown ? 'unchanged' : 'published', file, sync: 'Written locally; remote Obsidian Sync delivery is unverified.' };
}

function main(argv = process.argv.slice(2)) {
  const command = argv.shift();
  if (!command || command === '--help') {
    console.log('Usage: vault-project.js home [--root <checkout>] [--dry-run]\n       vault-project.js handoff --input <curated.json> [--root <checkout>] [--dry-run]');
    return;
  }
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') options.dryRun = true;
    else if (['--root', '--input'].includes(argv[i]) && argv[i + 1] && !argv[i + 1].startsWith('--')) options[argv[i].slice(2)] = argv[++i];
    else throw new Error('Unknown or incomplete project note option');
  }
  let result;
  if (command === 'home') result = refreshHome(options);
  else if (command === 'handoff' && options.input) {
    const input = path.resolve(options.input);
    result = publishHandoff({ ...options, handoff: JSON.parse(boundedRead(input, path.dirname(input))) });
  } else throw new Error('Choose home or handoff --input <curated.json>');
  console.log(JSON.stringify(result, null, 2));
}
if (require.main === module) { try { main(); } catch (err) { console.error(err.message); process.exitCode = 1; } }
module.exports = { publishHandoff, refreshHome };
