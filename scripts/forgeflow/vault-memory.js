#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { assertSafeDirectory, safeReadTextFile, writeFileSafe, writeJsonSafe } = require('./file-safety');
const outbox = require('./vault-outbox');
const { containsSensitiveContent } = require('./privacy-boundary');

const NOTE_LIMIT = 32 * 1024;
const FILE_LIMIT = 2000;
const ID = /^(?:vm_[a-f0-9]{32}|plc_[a-f0-9]{16})$/;
const PROJECT = /^[a-z0-9][a-z0-9_-]{0,79}$/;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const newId = () => `vm_${crypto.randomBytes(16).toString('hex')}`;

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 10000 });
  return result.status === 0 ? result.stdout.trim() : '';
}
function workspace(root = process.cwd()) {
  const resolved = path.resolve(root);
  return git(resolved, ['rev-parse', '--show-toplevel']) || resolved;
}
function connectionPath(root) { return path.join(root, '.forgeflow', 'vault.json'); }
function readBounded(file, root, limit = NOTE_LIMIT) {
  assertSafeDirectory(path.dirname(file));
  if (fs.lstatSync(file).size > limit) throw new Error('Vault file exceeds size limit');
  const result = safeReadTextFile(file, root);
  if (Buffer.byteLength(result.content) > limit) throw new Error('Vault file exceeds size limit');
  return result;
}
function readConnection(root) {
  const file = connectionPath(root);
  if (!fs.existsSync(file)) return null;
  const config = JSON.parse(readBounded(file, root).content);
  if (config.schema_version !== 1 || !PROJECT.test(config.project_id || '')
    || typeof config.vault !== 'string' || !path.isAbsolute(config.vault)
    || typeof config.publish_learnings !== 'boolean') throw new Error('Invalid local vault connection');
  return config;
}
function noteDirectory(config) {
  assertSafeDirectory(config.vault);
  if (!fs.statSync(config.vault).isDirectory()) throw new Error('Vault folder is unavailable');
  const dir = path.join(config.vault, 'Forgeflow', 'Projects', config.project_id, 'Memories');
  assertSafeDirectory(dir);
  return dir;
}
function connect(options) {
  const root = workspace(options.root);
  if (!PROJECT.test(options.projectId || '')) throw new Error('Use the same explicit lowercase --project-id on both computers');
  if (!options.vault || !path.isAbsolute(options.vault)) throw new Error('--vault must be an absolute local vault path');
  const config = { schema_version: 1, vault: path.resolve(options.vault), project_id: options.projectId, publish_learnings: options.publishLearnings === true };
  const previous = readConnection(root);
  if (previous && previous.project_id !== config.project_id) throw new Error('Disconnect before changing this checkout project identity');
  config.connection_id = previous && previous.vault === config.vault ? previous.connection_id || newId() : newId();
  noteDirectory(config); // Validate availability; never modify .obsidian or other notes.
  writeJsonSafe(connectionPath(root), config);
  const projectDir = path.join(root, '.forgeflow', path.basename(root));
  assertSafeDirectory(projectDir);
  fs.mkdirSync(projectDir, { recursive: true });
  return { status: 'connected', ...config, sync: 'Obsidian manages device sync; local connection does not prove remote delivery.' };
}
function relativeSource(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || /[\u0000-\u001f]/.test(value)
    || path.isAbsolute(value) || /^[A-Za-z]:/.test(value) || value.split('/').some(part => !part || part === '.' || part === '..')
    || value.split('/').some(part => part === '.git' || part === '.forgeflow' || part.startsWith('.env'))) throw new Error('Dependencies must be repository-relative source files');
  return value;
}
function sourceDigest(root, file) {
  relativeSource(file);
  const source = readBounded(path.join(root, file), root, 4 * 1024 * 1024);
  return hash(fs.readFileSync(source.realFile));
}
function cleanText(value, label, limit) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error(`Invalid note ${label}`);
  return value.trim();
}
function validateNote(note, config) {
  if (!note || note.schema_version !== 1 || note.project_id !== config.project_id || !ID.test(note.id || '')
    || !ID.test(note.memory_id || '') || !Array.isArray(note.parents) || note.parents.length > 20
    || note.parents.some(id => !ID.test(id) || id === note.id) || new Set(note.parents).size !== note.parents.length
    || !['active', 'stale', 'superseded'].includes(note.status) || !Number.isFinite(Date.parse(note.created_at))) throw new Error('Invalid vault note metadata');
  cleanText(note.title, 'title', 160);
  cleanText(note.body, 'body', 12000);
  if (note.title.includes('\n') || !Array.isArray(note.dependencies) || note.dependencies.length > 50) throw new Error('Invalid vault note sources');
  for (const dep of note.dependencies) {
    relativeSource(dep.path);
    if (!/^[a-f0-9]{64}$/.test(dep.sha256 || '')) throw new Error('Invalid source fingerprint');
  }
  if (typeof note.source_commit !== 'string' || (note.source_commit && !/^[a-f0-9]{40,64}$/.test(note.source_commit))
    || typeof note.source_branch !== 'string' || note.source_branch.length > 160) throw new Error('Invalid note revision');
  if (note.conflict_key || note.conflict_value) {
    if (!/^[a-z][a-z0-9_-]{0,63}$/.test(note.conflict_key || '') || typeof note.conflict_value !== 'string'
      || !note.conflict_value.trim() || note.conflict_value.length > 120) throw new Error('Invalid note conflict metadata');
  }
  // Reuse the existing conservative privacy filter. This is not a guarantee of redaction.
  const prose = [note.title, note.body, note.source_branch, note.conflict_key, note.conflict_value, ...note.dependencies.map(dep => dep.path)].join('\n');
  if (containsSensitiveContent(prose) || /(?:^|[\s(])(?:\/(?:home|Users|tmp|etc|root)\/|[A-Za-z]:[\\/])/.test(prose)) throw new Error('Note may contain sensitive or machine-specific content');
  return note;
}
function renderNote(note) { return require('./vault-format').renderFrontmatter(note); }
function noteFileName(note) {
  const slug = note.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'memory';
  return `${slug}--${note.id}.md`;
}
function parseNote(content, config) {
  return validateNote(require('./vault-format').parseFrontmatter(content), config);
}
function loadNotes(config) {
  const dir = noteDirectory(config);
  if (!fs.existsSync(dir)) return { notes: [], dir, invalidFamilies: new Set(), diagnostics: [] };
  const names = fs.readdirSync(dir).filter(name => name.endsWith('.md')).sort();
  if (names.length > FILE_LIMIT) throw new Error('Vault project exceeds note limit');
  const notes = [], invalid = [], diagnostics = [], invalidFamilies = new Set();
  for (const name of names) {
    let raw;
    try {
      const content = readBounded(path.join(dir, name), config.vault).content;
      raw = require('./vault-format').parseFrontmatter(content);
      notes.push({ ...validateNote(raw, config), file_name: name });
    } catch (_) { invalid.push({ name, raw }); }
  }
  for (const { name, raw } of invalid) {
    // Only syntactically parsed identities tied to an existing family can isolate corruption.
    if (!raw || raw.project_id !== config.project_id || !ID.test(raw.id || '') || !ID.test(raw.memory_id || '')
      || !notes.some(n => n.memory_id === raw.memory_id || n.parents.includes(raw.id))) throw new Error('Vault contains an unidentifiable invalid or unsafe note; inspect the project Memories folder');
    invalidFamilies.add(raw.memory_id);
    if (!Array.isArray(raw.parents) || raw.parents.some(id => !ID.test(id))) throw new Error('Vault contains unidentifiable revision ancestry');
    for (const n of notes) if (n.parents.includes(raw.id) || n.id === raw.id || raw.parents.includes(n.id)) invalidFamilies.add(n.memory_id);
    diagnostics.push({ file_name: name, memory_id: raw.memory_id, reason: 'invalid-note' });
  }
  const ids = new Map();
  for (const note of notes) {
    if (ids.has(note.id)) {
      invalidFamilies.add(note.memory_id); invalidFamilies.add(ids.get(note.id).memory_id);
      diagnostics.push({ file_name: note.file_name, memory_id: note.memory_id, reason: 'duplicate-id' });
    } else ids.set(note.id, note);
  }
  for (const note of notes) for (const parentId of note.parents) {
    const parent = ids.get(parentId);
    if (parent && parent.memory_id !== note.memory_id) {
      invalidFamilies.add(parent.memory_id); invalidFamilies.add(note.memory_id);
    }
  }
  return { notes, dir, invalidFamilies, diagnostics };
}
function headsFor(notes, memoryId) {
  const family = notes.filter(note => note.memory_id === memoryId);
  const parents = new Set(family.flatMap(note => note.parents));
  return family.filter(note => !parents.has(note.id));
}
function sameConnection(a, b) {
  return a && b && a.project_id === b.project_id && a.vault === b.vault && a.connection_id === b.connection_id;
}
function recoverPublicationLink(intent) {
  validateNote(intent.note, intent.connection);
  if (intent.note.id !== intent.id || renderNote(intent.note) !== intent.markdown) throw new Error('Invalid publication intent');
  const dir = noteDirectory(intent.connection);
  if (!fs.existsSync(dir)) return;
  const file = path.join(dir, noteFileName(intent.note));
  if (!fs.existsSync(file)) return;
  const finalStat = fs.lstatSync(file);
  if (finalStat.nlink !== 2 || !finalStat.isFile() || finalStat.isSymbolicLink() || finalStat.size > NOTE_LIMIT) return;
  // The random temporary filename is persisted before publication, so recovery never
  // accepts an arbitrary external hardlink or searches for vaguely matching files.
  if (typeof intent.temp_name !== 'string' || !new RegExp(`^\\.${intent.id}\\.[a-f0-9]{16}\\.tmp$`).test(intent.temp_name)) return;
  const temp = path.join(dir, intent.temp_name);
  if (!fs.existsSync(temp)) return;
  const tempStat = fs.lstatSync(temp);
  if (!tempStat.isFile() || tempStat.isSymbolicLink() || tempStat.nlink !== 2
    || tempStat.dev !== finalStat.dev || tempStat.ino !== finalStat.ino) return;
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
  try {
    const opened = fs.fstatSync(fd);
    if (!opened.isFile() || opened.nlink !== 2 || opened.size > NOTE_LIMIT
      || opened.dev !== finalStat.dev || opened.ino !== finalStat.ino || fs.readFileSync(fd, 'utf8') !== intent.markdown) return;
    const currentTemp = fs.lstatSync(temp), currentFinal = fs.lstatSync(file);
    if (currentTemp.isSymbolicLink() || currentFinal.isSymbolicLink() || currentTemp.ino !== opened.ino
      || currentTemp.dev !== opened.dev || currentFinal.ino !== opened.ino || currentFinal.dev !== opened.dev) return;
    fs.fsyncSync(fd);
    fs.unlinkSync(temp);
    const dirfd = fs.openSync(dir, 'r'); try { fs.fsyncSync(dirfd); } finally { fs.closeSync(dirfd); }
  } finally { fs.closeSync(fd); }
}
function attemptIntent(root, intent) {
  const result = (status, warning) => ({ status, id: intent.id, memory_id: intent.note.memory_id, ...(warning ? { warning } : {}) });
  const block = () => {
    intent.state = 'blocked'; outbox.saveIntent(root, intent);
    return result('blocked', 'Connection, sources, or revision history changed; review and publish a new intent.');
  };
  if (!sameConnection(readConnection(root), intent.connection)) return block();
  try { recoverPublicationLink(intent); } catch (_) { return result('queued', 'Interrupted publication could not be recovered safely.'); }
  if (intent.automatic) {
    if (!readConnection(root)?.publish_learnings) return block();
    const candidateFile = path.join(root, '.forgeflow', path.basename(root), 'project-learning-candidates.jsonl');
    if (fs.existsSync(candidateFile)) {
      try {
        const entries = safeReadTextFile(candidateFile, root).content.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
        const current = require('./project-learning-conflicts').resolvedCandidates(entries).find(entry => entry.id === intent.note.memory_id);
        if (current && intent.note.status === 'active') {
          if ((current.status || 'active') !== 'active' || learningBody(current) !== intent.note.body) return block();
          const control = require('./task-memory').applyTaskMemoryControls([{ learning_id: intent.note.memory_id }], { root, projectDir: path.dirname(candidateFile) })[0];
          if (control?.feedback_withheld || control?.provenance_withheld) return block();
        }
      } catch (_) { return block(); }
    }
  }
  try {
    validateNote(intent.note, intent.connection);
    if (intent.note.id !== intent.id || renderNote(intent.note) !== intent.markdown) return block();
    const { notes, dir, invalidFamilies } = loadNotes(intent.connection);
    if (invalidFamilies.has(intent.note.memory_id)) return block();
    const family = notes.filter(n => n.memory_id === intent.note.memory_id);
    if (family.some(n => (!n.parents.length && n.id !== n.memory_id && !n.memory_id.startsWith('plc_'))
      || n.parents.some(id => !family.some(parent => parent.id === id)))) return block();
    const visited = new Set();
    for (let size = -1; size !== visited.size;) {
      size = visited.size;
      for (const n of family) if (n.parents.every(id => visited.has(id))) visited.add(n.id);
    }
    if (visited.size !== family.length) return block();
    const existing = notes.filter(n => n.id === intent.id);
    if (existing.length) {
      if (existing.length !== 1 || readBounded(path.join(dir, existing[0].file_name), intent.connection.vault).content !== intent.markdown) return block();
      intent.state = 'published'; outbox.saveIntent(root, intent);
      return { ...result('published'), file: path.join(dir, existing[0].file_name), sync: 'Written locally; remote Obsidian Sync delivery is unverified.' };
    }
    if (intent.note.dependencies.some(dep => sourceDigest(root, dep.path) !== dep.sha256)) return block();
    const heads = headsFor(notes, intent.note.memory_id).map(n => n.id).sort();
    if (JSON.stringify(heads) !== JSON.stringify([...intent.note.parents].sort())
      || intent.note.parents.some(id => !notes.some(n => n.id === id && n.memory_id === intent.note.memory_id))) return block();
    const file = path.join(dir, noteFileName(intent.note));
    assertSafeDirectory(dir); fs.mkdirSync(dir, { recursive: true });
    intent.temp_name = `.${intent.id}.${crypto.randomBytes(8).toString('hex')}.tmp`;
    outbox.saveIntent(root, intent);
    const temp = path.join(dir, intent.temp_name);
    writeFileSafe(temp, intent.markdown, { mode: 0o600 });
    const fd = fs.openSync(temp, 'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    try { fs.linkSync(temp, file); } finally { fs.unlinkSync(temp); }
    const dirfd = fs.openSync(dir, 'r'); try { fs.fsyncSync(dirfd); } finally { fs.closeSync(dirfd); }
    intent.state = 'published'; outbox.saveIntent(root, intent);
    return { ...result('published'), file, sync: 'Written locally; remote Obsidian Sync delivery is unverified.' };
  } catch (_) { return result('queued', 'Publication remains queued; the vault or required source is unavailable.'); }
}
function prepareIntent(root, config, input, options, intents) {
  if (!input || typeof input !== 'object') throw new Error('A note object is required');
  const parents = input.supersedes || [];
  if (!Array.isArray(parents) || parents.length > 20 || parents.some(id => !ID.test(id)) || new Set(parents).size !== parents.length) throw new Error('Invalid supersedes list');
  const id = newId();
  let memoryId = options.memoryId || id;
  if (parents.length && !options.memoryId) {
    let notes;
    try { notes = loadNotes(config).notes; }
    catch (_) { notes = intents.filter(intent => intent.state === 'published' && sameConnection(config, intent.connection)).map(intent => intent.note); }
    const prior = parents.map(id => notes.find(n => n.id === id));
    if (prior.some(n => !n) || new Set(prior.map(n => n.memory_id)).size !== 1) throw new Error('Superseded notes must exist in the same memory family');
    memoryId = prior[0].memory_id;
  }
  const dependencies = input.dependencies || [];
  if (!Array.isArray(dependencies) || dependencies.length > 50) throw new Error('Invalid dependency list');
  const note = validateNote({
    schema_version: 1, project_id: config.project_id, id, memory_id: memoryId, parents,
    created_at: new Date().toISOString(), title: cleanText(input.title, 'title', 160), body: cleanText(input.body, 'body', 12000),
    status: input.status || 'active', source_commit: git(root, ['rev-parse', '--verify', 'HEAD']), source_branch: git(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
    dependencies: [...new Set(dependencies)].sort().map(file => ({ path: relativeSource(file), sha256: sourceDigest(root, file) })),
    conflict_key: input.conflict_key || '', conflict_value: input.conflict_value || '',
  }, config);
  const markdown = renderNote(note);
  if (Buffer.byteLength(markdown) > NOTE_LIMIT) throw new Error('Rendered vault note exceeds size limit');
  return { schema_version: 1, id, state: 'pending', sequence: Math.max(0, ...intents.map(x => x.sequence)) + 1, connection: config, note, markdown, automatic: options.automatic === true };
}
function publishNote(options) {
  const root = workspace(options.root), config = readConnection(root);
  if (!config) throw new Error('Connect this checkout to a vault first');
  if (options.dryRun) {
    const intent = prepareIntent(root, config, options.note, options, []);
    return { status: 'preview', note: intent.note, markdown: intent.markdown };
  }
  return outbox.withLock(root, () => {
    const intent = prepareIntent(root, config, options.note, options, outbox.listIntents(root));
    outbox.saveIntent(root, intent);
    return attemptIntent(root, intent);
  });
}
function retryPublications(root) {
  root = workspace(root);
  return outbox.withLock(root, () => {
    const intents = outbox.listIntents(root), results = [], stopped = new Set();
    for (const intent of intents) {
      if (intent.state === 'published' || intent.state === 'cancelled') {
        if (sameConnection(readConnection(root), intent.connection)) { try { recoverPublicationLink(intent); } catch (_) { /* Remains withheld for explicit repair. */ } }
        continue;
      }
      if (intent.note.memory_id.startsWith('plc_') && intents.some(x => x.sequence > intent.sequence && x.note.memory_id === intent.note.memory_id && sameConnection(x.connection, intent.connection))) { intent.state = 'cancelled'; outbox.saveIntent(root, intent); continue; }
      if (intent.state === 'blocked' || stopped.has(intent.note.memory_id)) {
        stopped.add(intent.note.memory_id); results.push({ status: 'blocked', id: intent.id }); continue;
      }
      const result = attemptIntent(root, intent); results.push(result);
      if (result.status !== 'published') stopped.add(intent.note.memory_id);
    }
    return { status: 'retried', results, outbox: outbox.outboxStatus(root) };
  });
}
function readVaultMemory(root) {
  try {
    const config = readConnection(root);
    if (!config) return { status: 'disconnected', records: [], notes: [] };
    const { notes, invalidFamilies, diagnostics } = loadNotes(config);
    const byId = new Map(notes.map(note => [note.id, note]));
    const groups = [...new Set(notes.map(note => note.memory_id))];
    const heads = groups.flatMap(id => headsFor(notes, id));
    const broken = new Set(invalidFamilies);
    const visited = new Set();
    function visit(note, ancestors = new Set()) {
      if (ancestors.has(note.id)) { broken.add(note.memory_id); return; }
      if (visited.has(note.id)) return;
      const next = new Set(ancestors); next.add(note.id);
      for (const id of note.parents) if (byId.has(id)) visit(byId.get(id), next);
      visited.add(note.id);
    }
    for (const note of notes) {
      if ((!note.parents.length && note.id !== note.memory_id && !note.memory_id.startsWith('plc_'))
        || note.parents.some(id => !byId.has(id) || byId.get(id).memory_id !== note.memory_id)) broken.add(note.memory_id);
      for (const id of note.parents) {
        const parent = byId.get(id);
        if (parent && parent.memory_id !== note.memory_id) { broken.add(parent.memory_id); broken.add(note.memory_id); }
      }
      visit(note);
    }
    const conflicts = new Set(groups.filter(id => headsFor(notes, id).length !== 1));
    const values = new Map();
    for (const note of heads.filter(note => note.status === 'active' && note.conflict_key)) {
      const group = values.get(note.conflict_key) || new Set();
      group.add(note.conflict_value); values.set(note.conflict_key, group);
    }
    for (const note of heads) if ((values.get(note.conflict_key)?.size || 0) > 1) conflicts.add(note.memory_id);
    const currentCommit = git(root, ['rev-parse', '--verify', 'HEAD']);
    const records = heads.map(note => {
      let freshness = note.source_commit && note.source_commit === currentCommit ? 'same-commit' : 'revision-unverified';
      if (note.dependencies.length) {
        try { freshness = note.dependencies.every(dep => sourceDigest(root, dep.path) === dep.sha256) ? 'sources-match' : 'sources-changed'; }
        catch (_err) { freshness = 'sources-unavailable'; }
      }
      const stale = ['sources-changed', 'sources-unavailable'].includes(freshness);
      const conflict = conflicts.has(note.memory_id) || (values.get(note.conflict_key)?.size || 0) > 1;
      return {
        id: `vault:${note.id}`, source: `vault/${config.project_id}/${note.file_name || noteFileName(note)}`, line: 1,
        kind: 'vault-memory', source_class: 'project-learning', source_mtime_ms: Date.parse(note.created_at),
        text: `[shared guidance; ${freshness}; origin ${note.source_commit || 'uncommitted'}] ${note.title}: ${note.body.replace(/\s+/g, ' ')}`,
        lifecycle: broken.has(note.memory_id) ? 'invalid' : stale ? 'stale' : note.status === 'active' ? 'verify' : note.status,
        conflict_withheld: conflict, vault_freshness: freshness,
      };
    });
    return { status: 'connected', project_id: config.project_id, records, notes, conflicts: conflicts.size, incomplete: broken.size, diagnostics };
  } catch (err) {
    // An unavailable, partial or conflicting vault never makes stale cached guidance usable.
    return { status: 'unavailable', records: [], notes: [], warning: 'Vault could not be read safely; inspect the project Memories folder.' };
  }
}
function refreshVaultRecords(records, options) {
  const root = options.root || (options.projectDir && path.basename(path.dirname(options.projectDir)) === '.forgeflow' ? path.dirname(path.dirname(options.projectDir)) : null);
  if (!root) return { records: records.filter(record => record?.kind !== 'vault-memory'), vault: { status: 'unverified' } };
  const vault = readVaultMemory(root);
  const sharedIds = new Set(vault.notes.map(note => note.memory_id));
  const projectDir = path.join(root, '.forgeflow', path.basename(root));
  const candidatesFile = path.join(projectDir, 'project-learning-candidates.jsonl');
  if (vault.status === 'connected' && fs.existsSync(candidatesFile)) {
    const { resolvedCandidates } = require('./project-learning-conflicts');
    const { projectLearningId } = require('./record-project-learning');
    const entries = safeReadTextFile(candidatesFile, projectDir).content.split(/\r?\n/).filter(Boolean).flatMap(line => {
      try { return [JSON.parse(line)]; } catch (_err) { return []; }
    });
    const local = new Map(resolvedCandidates(entries).map(entry => [projectLearningId(entry), entry]));
    const controls = require('./task-memory').applyTaskMemoryControls([...local.keys()].map(id => ({ learning_id: id })), { root, projectDir });
    const withheld = new Set(controls.filter(record => record.feedback_withheld || record.provenance_withheld).map(record => record.learning_id));
    const byId = new Map(vault.notes.map(note => [`vault:${note.id}`, note]));
    for (const record of vault.records) {
      const note = byId.get(record.id);
      const entry = local.get(note.memory_id);
      if (entry && note.status === 'active' && ((entry.status || 'active') !== 'active'
        || learningBody(entry) !== note.body || withheld.has(note.memory_id))) record.conflict_withheld = true;
    }
  }
  // Shared revision history replaces duplicate local copies of mirrored learnings.
  // Disagreement or failed publication is withheld, never settled by clock order.
  return { notes: vault.notes, records: [...records.filter(record => record?.kind !== 'vault-memory' && !sharedIds.has(record?.learning_id)), ...vault.records], vault: { status: vault.status, warning: vault.warning || null, conflicts: vault.conflicts || 0, incomplete: vault.incomplete || 0 } };
}
function learningBody(entry) {
  return [entry.learning, entry.application_guidance, entry.evidence ? `Evidence reference: ${entry.evidence}` : ''].filter(Boolean).join('\n\n');
}
function publishLearning(root, entry) {
  try {
    root = workspace(root);
    const config = readConnection(root);
    if (!config?.publish_learnings) return { status: 'disabled' };
    if (entry.source === 'Forgeflow command interface evidence') return { status: 'local-only' };
    if (entry.status === 'active' && entry.provenance && require('./task-memory').inspectProvenance(root, entry.provenance) !== 'current') return { status: 'withheld', warning: 'Learning provenance is not current; publish an explicitly reviewed note instead.' };
    const scopes = entry.status === 'active' ? entry.provenance?.dependencies?.scope || [] : [];
    if (scopes.some(file => !fs.statSync(path.join(root, relativeSource(file))).isFile())) return { status: 'withheld', warning: 'Publish explicit source files for directory-scoped learning provenance.' };
    return outbox.withLock(root, () => {
      const intents = outbox.listIntents(root);
      const related = intents.filter(x => x.note.memory_id === entry.id && sameConnection(config, x.connection));
      const latest = related.at(-1);
      let heads;
      try {
        const loaded = loadNotes(config);
        if (loaded.invalidFamilies.has(entry.id)) throw new Error('Invalid shared family');
        heads = headsFor(loaded.notes, entry.id);
      } catch (_) {
        // Receipts retain causal history when the synchronized folder is temporarily offline.
        heads = latest ? (latest.state === 'published' ? [latest.note] : latest.note.parents.map(id => related.find(x => x.id === id)?.note).filter(Boolean)) : [];
        if (latest && latest.state !== 'published' && heads.length !== latest.note.parents.length) return { status: 'withheld', warning: 'Unavailable revision ancestry needs review.' };
      }
      if (heads.length > 1) return { status: 'withheld', warning: 'Conflicting shared learning revisions require explicit resolution.' };
      const body = learningBody(entry), status = entry.status || 'active';
      const same = note => note && note.body === body && note.status === status && (note.conflict_key || '') === (entry.conflict_key || '') && (note.conflict_value || '') === (entry.conflict_value || '');
      if (latest?.state === 'pending' && same(latest.note)) return { status: 'queued', id: latest.id, memory_id: entry.id };
      if (same(heads[0])) {
        for (const old of related.filter(x => x.state !== 'published' && x.state !== 'cancelled')) { old.state = 'cancelled'; outbox.saveIntent(root, old); }
        return { status: 'unchanged' };
      }
      const intent = prepareIntent(root, config, { title: entry.learning.slice(0, 150), body, status, dependencies: scopes,
        conflict_key: entry.conflict_key, conflict_value: entry.conflict_value, supersedes: heads.map(note => note.id) }, { memoryId: entry.id, automatic: true }, intents);
      // Persist the replacement first. Retry also checks newer intents, covering a crash between these writes.
      outbox.saveIntent(root, intent);
      for (const old of related.filter(x => x.state !== 'published' && x.state !== 'cancelled')) { old.state = 'cancelled'; outbox.saveIntent(root, old); }
      return attemptIntent(root, intent);
    });
  } catch (_) { return { status: 'unavailable', warning: 'Learning remains local; publication could not be prepared safely.' }; }
}
function main(argv = process.argv.slice(2)) {
  const command = argv.shift();
  if (!command || command === '--help') {
    console.log('Usage: vault-memory.js connect --vault <absolute-path> --project-id <id> [--publish-learnings] [--root <checkout>]\n       vault-memory.js write --input <note.json> [--dry-run] [--root <checkout>]\n       vault-memory.js status|retry|disconnect [--root <checkout>]\n       vault-memory.js home [--dry-run] [--root <checkout>]\n       vault-memory.js handoff --input <handoff.json> [--dry-run] [--root <checkout>]\nOutput is JSON. Obsidian Sync setup and remote delivery are managed by Obsidian.');
    return;
  }
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--publish-learnings') options.publishLearnings = true;
    else if (['--root', '--vault', '--project-id', '--input'].includes(arg) && argv[i + 1] && !argv[i + 1].startsWith('--')) options[{ '--root': 'root', '--vault': 'vault', '--project-id': 'projectId', '--input': 'input' }[arg]] = argv[++i];
    else throw new Error(`Unknown or incomplete option: ${arg}`);
  }
  if (options.dryRun && !['write', 'home', 'handoff'].includes(command)) throw new Error('--dry-run is supported only for write, home, and handoff');
  const root = workspace(options.root);
  let result;
  if (command === 'connect') result = connect({ ...options, root });
  else if (command === 'write') {
    if (!options.input) throw new Error('--input is required');
    result = publishNote({ ...options, root, note: JSON.parse(readBounded(path.resolve(options.input), path.dirname(path.resolve(options.input))).content) });
  } else if (command === 'retry') result = retryPublications(root);
  else if (command === 'home') result = require('./vault-project').refreshHome({root, dryRun: options.dryRun});
  else if (command === 'handoff') {
    if (!options.input) throw new Error('--input is required');
    result = require('./vault-project').publishHandoff({root, dryRun: options.dryRun, handoff: JSON.parse(readBounded(path.resolve(options.input), path.dirname(path.resolve(options.input))).content)});
  } else if (command === 'status') {
    const state = readVaultMemory(root);
    const current = refreshVaultRecords([], { root }).records;
    result = { ...state, outbox: outbox.outboxStatus(root), notes: state.notes.length, records: current.map(record => ({ id: record.id, lifecycle: record.lifecycle, conflict: record.conflict_withheld, freshness: record.vault_freshness })) };
    if (state.status === 'unavailable') process.exitCode = 1;
  } else if (command === 'disconnect') {
    if (readConnection(root)) fs.unlinkSync(connectionPath(root));
    result = { status: 'disconnected', notes_preserved: true };
  } else throw new Error('Unknown vault command');
  console.log(JSON.stringify(result, null, 2));
}
module.exports = { retryPublications, outboxStatus: outbox.outboxStatus, connect, noteFileName, parseNote, publishNote, publishLearning, readConnection, readVaultMemory, refreshVaultRecords, renderNote };
if (require.main === module) { try { main(); } catch (err) { console.error(err.message); process.exitCode = 1; } }
