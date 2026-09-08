'use strict';

const yaml = require('./vendor/js-yaml/js-yaml');

const NOTE_LIMIT = 32 * 1024;
const MAX_DEPTH = 20;
const MAX_NODES = 4096;
const MEMORY_START = '<!-- forgeflow:memory:start -->';
const MEMORY_END = '<!-- forgeflow:memory:end -->';
const METADATA_FIELDS = [
  'schema_version', 'project_id', 'id', 'memory_id', 'parents', 'created_at',
  'title', 'status', 'source_commit', 'source_branch', 'dependencies',
  'conflict_key', 'conflict_value',
];
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function parseMetadata(source) {
  let depth = 0;
  let nodes = 0;
  try {
    const metadata = yaml.load(source, {
      schema: yaml.CORE_SCHEMA,
      listener(event, state) {
        if (state.anchor !== null && state.anchor !== undefined) throw new Error('YAML anchors are unsupported');
        if (event === 'open') {
          depth += 1;
          nodes += 1;
          if (depth > MAX_DEPTH || nodes > MAX_NODES) throw new Error('YAML complexity limit exceeded');
        } else depth -= 1;
      },
    });
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error('Expected a property mapping');
    rejectUnsafeKeys(metadata);
    return metadata;
  } catch (_error) {
    // Parser errors include source excerpts, which must not enter diagnostics.
    throw new Error('Invalid YAML properties; check duplicate keys, tags, anchors, and nesting');
  }
}

function rejectUnsafeKeys(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (UNSAFE_KEYS.has(key)) throw new Error('Unsafe YAML property');
    rejectUnsafeKeys(child);
  }
}

function guidanceBody(markdown) {
  const lines = markdown.trim().split('\n');
  const starts = lines.flatMap((line, index) => line.trim() === MEMORY_START ? [index] : []);
  const ends = lines.flatMap((line, index) => line.trim() === MEMORY_END ? [index] : []);
  if (starts.length || ends.length) {
    if (starts.length !== 1 || ends.length !== 1 || starts[0] >= ends[0]) throw new Error('Invalid Forgeflow guidance markers');
    return lines.slice(starts[0] + 1, ends[0]).join('\n').trim();
  }
  // Legacy pilot notes have no markers. Their optional first heading is display-only.
  if (/^#\s/.test(lines[0])) lines.shift();
  return lines.join('\n').trim();
}

function parseFrontmatter(content) {
  if (typeof content !== 'string' || Buffer.byteLength(content) > NOTE_LIMIT) throw new Error('Vault note exceeds size limit');
  const match = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)([\s\S]*)$/);
  if (!match) throw new Error('Expected YAML frontmatter and Markdown body');
  const metadata = parseMetadata(match[1]);
  const note = {};
  for (const key of METADATA_FIELDS) if (Object.hasOwn(metadata, key)) note[key] = metadata[key];
  // Ordinary Obsidian properties and annotations never become retrieved guidance.
  note.body = guidanceBody(match[2]);
  return note;
}

function renderFrontmatter(note) {
  if (typeof note.body !== 'string' || note.body.includes(MEMORY_START) || note.body.includes(MEMORY_END)) throw new Error('Guidance cannot contain reserved Forgeflow markers');
  const metadata = {};
  for (const key of METADATA_FIELDS) if (Object.hasOwn(note, key)) metadata[key] = note[key];
  const properties = yaml.dump(metadata, { schema: yaml.CORE_SCHEMA, noRefs: true, lineWidth: -1, quotingType: '"', forceQuotes: true }).trimEnd();
  return ['---', properties, '---', '', `# ${note.title}`, '', MEMORY_START, note.body, MEMORY_END, '', '## Personal annotations', '', ''].join('\n');
}

module.exports = { parseFrontmatter, renderFrontmatter };
