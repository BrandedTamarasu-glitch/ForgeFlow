'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { sourceSnapshot, sameSource } = require('./task-store');
const { assertSafeDirectory, assertSafeDestination, isPathInside } = require('./file-safety');

const DEFAULT_LIMITS = Object.freeze({ artifactBytes: 16 * 1024 * 1024, runBytes: 256 * 1024 * 1024, archiveBytes: 1024 * 1024 * 1024, artifactCount: 2000 });
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const encode = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
function identifier(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(value)) throw new Error('Invalid evidence identifier');
  return value;
}
function relativePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes('\0') || path.isAbsolute(value) || value.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Invalid artifact relative path');
  return value;
}
function archiveDirectory(root) { return path.join(root, '.forgeflow', path.basename(root), 'context', 'runs'); }
function readInputFile({ path: file, root, maxBytes = DEFAULT_LIMITS.artifactBytes }) {
  assertSafeDirectory(root); assertSafeDirectory(path.dirname(file));
  if (!isPathInside(fs.realpathSync(root), path.resolve(file))) throw new Error('Input is outside its allowed root');
  const before = fs.lstatSync(file);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > maxBytes) throw new Error('Unsafe or oversized evidence input');
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
  try {
    const opened = fs.fstatSync(fd);
    if (opened.dev !== before.dev || opened.ino !== before.ino || !opened.isFile() || opened.nlink !== 1 || opened.size > maxBytes) throw new Error('Evidence input replaced during capture');
    const bytes = Buffer.alloc(opened.size); let offset = 0;
    while (offset < bytes.length) { const count = fs.readSync(fd, bytes, offset, bytes.length - offset, offset); if (!count) break; offset += count; }
    const after = fs.fstatSync(fd), named = fs.lstatSync(file);
    if (offset !== bytes.length || opened.size !== after.size || opened.mtimeMs !== after.mtimeMs || opened.ctimeMs !== after.ctimeMs || after.nlink !== 1 || named.dev !== after.dev || named.ino !== after.ino || named.isSymbolicLink()) throw new Error('Evidence input changed during capture');
    return bytes;
  } finally { fs.closeSync(fd); }
}
function writeExclusive(file, bytes) {
  assertSafeDirectory(path.dirname(file));
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function atomicReplace(file, bytes) {
  assertSafeDestination(file); assertSafeDirectory(path.dirname(file));
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  writeExclusive(temporary, bytes);
  try { assertSafeDestination(file); fs.renameSync(temporary, file); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
function withLock(directory, operation) {
  assertSafeDirectory(directory); fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const lock = path.join(directory, '.evidence.lock'), deadline = Date.now() + 10000;
  let fd;
  while (fd === undefined) {
    try { fd = fs.openSync(lock, 'wx', 0o600); }
    catch (error) { if (error.code !== 'EEXIST') throw error; if (Date.now() >= deadline) throw new Error('Evidence writer lock remains; inspect interrupted writer before reconciling'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20); }
  }
  try { fs.writeFileSync(fd, encode({ pid: process.pid })); return operation(); }
  finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
function directoryBytes(directory) {
  if (!fs.existsSync(directory)) return 0;
  assertSafeDirectory(directory);
  return fs.readdirSync(directory).reduce((total, name) => {
    const file = path.join(directory, name), stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory()) || (stat.isFile() && stat.nlink !== 1)) throw new Error('Unsafe retained archive entry');
    return total + (stat.isDirectory() ? directoryBytes(file) : stat.size);
  }, 0);
}
function retainedBytes(archive) {
  return directoryBytes(archive) + directoryBytes(path.join(archive, '..', 'consumptions'));
}
function snapshot(root, scope, allowUnknownSource) {
  if (allowUnknownSource) {
    const result = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8', timeout: 15000 });
    if (!result.error && result.status !== 0 && /not a git repository/.test(result.stderr)) return null;
    if (!result.error && result.status === 0) {
      const head = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root, encoding: 'utf8', timeout: 15000 });
      const branch = spawnSync('git', ['symbolic-ref', '-q', 'HEAD'], { cwd: root, encoding: 'utf8', timeout: 15000 });
      const branchRef = branch.stdout.trim();
      if (!head.error && head.status !== 0 && !branch.error && branch.status === 0) {
        const exists = spawnSync('git', ['show-ref', '--verify', '--quiet', branchRef], { cwd: root, encoding: 'utf8', timeout: 15000 });
        if (!exists.error && exists.status === 1) return null;
      }
    }
  }
  return sourceSnapshot(root, scope);
}
function capacity(handle, extra) {
  if (directoryBytes(handle.run_dir) + extra > handle.limits.runBytes || retainedBytes(handle.archive_dir) + extra > handle.limits.archiveBytes) throw new Error('Evidence capacity reached; retain existing proof and choose a new bounded archive or explicitly reconcile retention');
}
function beginRun({ root, outDir, scope = [], limits = {}, allowUnknownSource = false }) {
  root = fs.realpathSync(path.resolve(root));
  const bounded = { ...DEFAULT_LIMITS, ...limits };
  for (const [key, value] of Object.entries(bounded)) if (!(key in DEFAULT_LIMITS) || !Number.isSafeInteger(value) || value <= 0 || value > DEFAULT_LIMITS[key]) throw new Error('Invalid evidence limits');
  if (!Array.isArray(scope) || scope.length > 500) throw new Error('Invalid source scope');
  scope = [...new Set(scope.map(relativePath))].sort();
  const source = snapshot(root, scope, allowUnknownSource), archive = archiveDirectory(root);
  const handle = { root, out_dir: path.resolve(outDir || path.join(archive, '..', 'latest')), archive_dir: archive, scope, source, limits: bounded, artifacts: [], allowUnknownSource };
  assertSafeDirectory(handle.out_dir);
  return withLock(archive, () => {
    handle.run_id = `${Date.now()}-${crypto.randomUUID()}`; handle.run_dir = path.join(archive, handle.run_id);
    const metadata = encode({ schema_version: '1', run_id: handle.run_id, build_state: 'incomplete', scope, source, source_limitation: source ? null : 'Git HEAD unavailable in explicit legacy fixture', limits: bounded, artifacts: [] });
    if (metadata.length > bounded.runBytes || retainedBytes(archive) + metadata.length > bounded.archiveBytes) throw new Error('Evidence archive capacity reached; preserve prior runs and reconcile retention');
    fs.mkdirSync(handle.run_dir, { mode: 0o700 }); fs.mkdirSync(path.join(handle.run_dir, 'artifacts'), { mode: 0o700 });
    writeExclusive(path.join(handle.run_dir, 'run.json'), metadata); return handle;
  });
}
function assertOpen(handle) {
  assertSafeDirectory(handle.run_dir);
  if (fs.existsSync(path.join(handle.run_dir, 'failure.json'))) throw new Error('Failed evidence run requires a new build');
  if (fs.existsSync(path.join(handle.run_dir, 'manifest.json'))) throw new Error('Sealed evidence cannot be mutated');
}
function artifactRecord(handle, options, bytes, relative) {
  identifier(options.id);
  if (handle.artifacts.some(item => item.id === options.id)) throw new Error('Duplicate evidence artifact');
  if (handle.artifacts.length >= handle.limits.artifactCount || bytes.length > handle.limits.artifactBytes) throw new Error('Evidence artifact count or byte limit reached');
  if (!['full', 'excerpted'].includes(options.coverage || 'full')) throw new Error('Invalid artifact coverage');
  const native = options.native || {};
  return { id: options.id, relative_path: relative, sha256: digest(bytes), bytes: bytes.length, kind: options.kind || 'input', coverage: options.coverage || 'full', provenance: { source_path: options.path || options.source_path || null, toolCallId: native.toolCallId ?? null, toolName: native.toolName ?? null, resultEntryId: native.resultEntryId ?? null, resultSha256: native.resultSha256 ?? null, isError: native.isError ?? null, outputExcerpted: (options.coverage || 'full') === 'excerpted' } };
}
function persistInventory(handle, record) {
  const file = path.join(handle.run_dir, 'run.json');
  const previous = readInputFile({ path: file, root: handle.run_dir });
  const metadata = JSON.parse(previous.toString('utf8'));
  metadata.artifacts = [...handle.artifacts, record];
  const bytes = encode(metadata);
  capacity(handle, bytes.length);
  atomicReplace(file, bytes);
  handle.artifacts.push(record);
}
function captureInput(handle, options) {
  assertOpen(handle);
  if ((options.path !== undefined) === (options.bytes !== undefined)) throw new Error('Exactly one input path or bytes is required');
  const bytes = options.path !== undefined ? readInputFile({ path: path.resolve(handle.root, options.path), root: handle.root, maxBytes: handle.limits.artifactBytes }) : Buffer.from(options.bytes);
  const relative = `artifacts/${identifier(options.id)}`, record = artifactRecord(handle, options, bytes, relative);
  withLock(handle.archive_dir, () => { capacity(handle, bytes.length); writeExclusive(path.join(handle.run_dir, relative), bytes); persistInventory(handle, record); });
  return record;
}
function captureOutput(handle, options) {
  assertOpen(handle);
  const file = path.resolve(handle.run_dir, options.path);
  if (!isPathInside(handle.run_dir, file)) throw new Error('Output escapes evidence run');
  const relative = relativePath(path.relative(handle.run_dir, file));
  if (['manifest.json', 'run.json', 'evidence-ref.json'].includes(relative)) throw new Error('Reserved evidence metadata path');
  const bytes = readInputFile({ path: file, root: handle.run_dir, maxBytes: handle.limits.artifactBytes });
  const record = artifactRecord(handle, options, bytes, relative);
  withLock(handle.archive_dir, () => { capacity(handle, 0); const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0)); try { fs.fchmodSync(fd, 0o600); } finally { fs.closeSync(fd); } persistInventory(handle, record); }); return record;
}
function writeOutput(handle, file, content) {
  assertOpen(handle);
  file = path.resolve(file);
  if (!isPathInside(handle.run_dir, file)) throw new Error('Output escapes evidence run');
  const relative = relativePath(path.relative(handle.run_dir, file));
  if (['run.json', 'manifest.json', 'evidence-ref.json', 'failure.json'].includes(relative) || relative.startsWith('artifacts/')) throw new Error('Reserved evidence output');
  const bytes = Buffer.from(content);
  if (bytes.length > handle.limits.artifactBytes) throw new Error('Evidence output byte limit reached');
  return withLock(handle.archive_dir, () => {
    capacity(handle, bytes.length);
    assertSafeDirectory(path.dirname(file)); fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    atomicReplace(file, bytes);
  });
}
function failRun(handle, { message }) {
  assertOpen(handle);
  if (typeof message !== 'string' || !message || message.length > 2000) throw new Error('Invalid failed run explanation');
  const bytes = encode({ build_state: 'failed', message });
  withLock(handle.archive_dir, () => { capacity(handle, bytes.length); writeExclusive(path.join(handle.run_dir, 'failure.json'), bytes); });
}
function sealRun(handle) {
  assertOpen(handle);
  const current = snapshot(handle.root, handle.scope, handle.allowUnknownSource);
  if ((handle.source || current) && !sameSource(handle.source, current)) throw new Error('Source changed during evidence build; rebuild');
  for (const artifact of handle.artifacts) if (digest(readInputFile({ path: path.join(handle.run_dir, artifact.relative_path), root: handle.run_dir, maxBytes: handle.limits.artifactBytes })) !== artifact.sha256) throw new Error('Artifact changed before sealing');
  const manifest = { schema_version: '1', run_id: handle.run_id, build_state: 'complete', scope: handle.scope, source: handle.source, source_limitation: handle.source ? null : 'Git HEAD unavailable in explicit legacy fixture', limits: handle.limits, artifacts: handle.artifacts, sealed_at: new Date().toISOString() };
  const bytes = encode(manifest), ref = { schema_version: '1', run_id: handle.run_id, run_dir: handle.run_dir, manifest_path: path.join(handle.run_dir, 'manifest.json'), manifest_sha256: digest(bytes), scope: handle.scope };
  withLock(handle.archive_dir, () => { capacity(handle, bytes.length + encode(ref).length); const latest = snapshot(handle.root, handle.scope, handle.allowUnknownSource); if ((handle.source || latest) && !sameSource(handle.source, latest)) throw new Error('Source changed before sealing'); writeExclusive(path.join(handle.run_dir, 'evidence-ref.json'), encode(ref)); writeExclusive(ref.manifest_path, bytes); });
  handle.evidence_ref = ref; return ref;
}
function resolveReference({ root, ref }) {
  root = fs.realpathSync(path.resolve(root));
  if (typeof ref === 'string') ref = JSON.parse(readInputFile({ path: path.resolve(ref), root: path.dirname(path.resolve(ref)) }).toString('utf8'));
  if (!ref || ref.schema_version !== '1' || !Array.isArray(ref.scope)) throw new Error('Explicit evidence reference and source scope required');
  identifier(ref.run_id);
  const expected = path.join(archiveDirectory(root), ref.run_id);
  if (ref.run_dir !== expected || ref.manifest_path !== path.join(expected, 'manifest.json') || (ref.manifest_sha256 !== null && !/^[a-f0-9]{64}$/.test(ref.manifest_sha256 || ''))) throw new Error('Invalid evidence identity or expected manifest hash');
  return ref;
}
function readProjectionReference({ root, outDir }) {
  return resolveReference({ root, ref: path.join(outDir, 'evidence-ref.json') });
}
function validateArtifact(item, ids) {
  identifier(item.id);
  relativePath(item.relative_path);
  if (ids.has(item.id) || !/^[a-f0-9]{64}$/.test(item.sha256) || !Number.isSafeInteger(item.bytes) || item.bytes < 0 || item.bytes > DEFAULT_LIMITS.artifactBytes || !['full', 'excerpted'].includes(item.coverage)) throw new Error('Invalid artifact manifest');
  ids.add(item.id);
}
function inspectArtifacts(runDir, records) {
  if (!Array.isArray(records) || records.length > DEFAULT_LIMITS.artifactCount) throw new Error('Invalid artifact inventory');
  const result = { artifacts: [], integrity: 'current', coverage: 'full' };
  const ids = new Set();
  for (const item of records) {
    validateArtifact(item, ids);
    let state = 'current';
    try {
      const bytes = readInputFile({ path: path.join(runDir, item.relative_path), root: runDir });
      if (bytes.length !== item.bytes || digest(bytes) !== item.sha256) state = 'changed';
    } catch (error) { state = error.code === 'ENOENT' ? 'missing' : 'changed'; }
    result.artifacts.push({ ...item, integrity: state });
    if (state === 'changed' || (state === 'missing' && result.integrity !== 'changed')) result.integrity = state;
    if (item.coverage === 'excerpted') result.coverage = 'excerpted';
  }
  return result;
}
function inspectIncomplete(inspection) {
  const directory = inspection.ref.run_dir;
  const failure = path.join(directory, 'failure.json');
  if (fs.existsSync(failure)) {
    inspection.failure = JSON.parse(readInputFile({ path: failure, root: directory }).toString());
    inspection.build_state = 'failed';
  }
  const metadata = JSON.parse(readInputFile({ path: path.join(directory, 'run.json'), root: directory }).toString());
  inspection.artifacts = inspectArtifacts(directory, metadata.artifacts || []).artifacts;
  return inspection;
}
function inspectRun({ root, ref }) {
  ref = resolveReference({ root, ref });
  const inspection = { ref, build_state: 'incomplete', integrity: 'missing', source: 'unknown', coverage: 'full', artifacts: [], claim_truth: 'not_assessed', next_action: 'Inspect incomplete run and rebuild; do not replay unknown work' };
  let bytes;
  try { bytes = readInputFile({ path: ref.manifest_path, root: ref.run_dir }); }
  catch (error) {
    if (error.code === 'ENOENT') return inspectIncomplete(inspection);
    inspection.integrity = 'changed';
    return inspection;
  }
  if (!ref.manifest_sha256 || digest(bytes) !== ref.manifest_sha256) { inspection.integrity = 'changed'; return inspection; }
  const manifest = JSON.parse(bytes.toString('utf8'));
  if (manifest.run_id !== ref.run_id || manifest.schema_version !== '1' || manifest.build_state !== 'complete' || JSON.stringify(manifest.scope) !== JSON.stringify(ref.scope)) throw new Error('Invalid sealed manifest');
  inspection.manifest = manifest;
  inspection.build_state = 'complete';
  Object.assign(inspection, inspectArtifacts(ref.run_dir, manifest.artifacts));
  if (manifest.source) inspection.source = sameSource(manifest.source, sourceSnapshot(root, ref.scope)) ? 'current' : 'stale';
  inspection.next_action = inspection.integrity !== 'current' || inspection.source !== 'current' ? 'Retrieve intact historical proof or rebuild current evidence' : 'Use pinned evidence identity; hashes do not establish claim truth';
  return inspection;
}
function retrieveArtifact({ root, ref, artifactId, startLine, endLine, maxChars = DEFAULT_LIMITS.artifactBytes, rawRequired = false }) {
  const inspection = inspectRun({ root, ref });
  if (inspection.build_state !== 'complete' || inspection.integrity !== 'current') throw new Error('Evidence missing or changed; rebuild or inspect retained archive');
  const artifact = inspection.artifacts.find(item => item.id === artifactId);
  if (!artifact) throw new Error('Unknown artifact');
  if (!Number.isSafeInteger(maxChars) || maxChars < 1 || maxChars > DEFAULT_LIMITS.artifactBytes) throw new Error('Invalid retrieval limit');
  const bytes = readInputFile({ path: path.join(inspection.ref.run_dir, artifact.relative_path), root: inspection.ref.run_dir });
  if (bytes.length !== artifact.bytes || digest(bytes) !== artifact.sha256) throw new Error('Artifact changed during retrieval');
  const full = bytes.toString('utf8'), lines = full.split('\n');
  const isText = Buffer.from(full, 'utf8').equals(bytes);
  if (!isText && !rawRequired) throw new Error('Binary artifact requires raw-required retrieval');
  const first = startLine ?? 1, last = endLine ?? lines.length;
  if (!Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last < first || last > lines.length) throw new Error('Invalid line range');
  if (rawRequired && (artifact.coverage !== 'full' || first !== 1 || last !== lines.length || bytes.length > maxChars)) throw new Error('Raw proof requires complete artifact; increase limit and remove range or obtain full source');
  const neighborStart = Math.max(1, first - 1), neighborEnd = Math.min(lines.length, last + 1), selected = lines.slice(neighborStart - 1, neighborEnd).join('\n');
  const content = selected.slice(0, maxChars), isExcerpted = artifact.coverage === 'excerpted' || neighborStart !== 1 || neighborEnd !== lines.length || content.length < selected.length;
  return { artifact_id: artifact.id, content: isText ? content : null, content_base64: rawRequired ? bytes.toString('base64') : null, encoding: isText ? 'utf8' : 'base64', coverage: isExcerpted ? 'excerpted' : 'full', source: inspection.source, full_artifact_path: path.join(inspection.ref.run_dir, artifact.relative_path), full_sha256: artifact.sha256, full_bytes: artifact.bytes, start_line: neighborStart, end_line: neighborEnd, omitted_before_lines: neighborStart - 1, omitted_after_lines: lines.length - neighborEnd, omitted_characters: selected.length - content.length, claim_truth: 'not_assessed' };
}
function recordConsumption({ root, ref, id, kind, resultPath, decisionPath, artifactIds }) {
  const inspection = inspectRun({ root, ref });
  if (inspection.build_state !== 'complete' || inspection.integrity !== 'current' || inspection.source !== 'current') throw new Error('New decisions require intact current source evidence; rebuild');
  identifier(id); identifier(kind);
  if (!Array.isArray(artifactIds) || !artifactIds.length || new Set(artifactIds).size !== artifactIds.length || artifactIds.some(value => !inspection.artifacts.some(item => item.id === value))) throw new Error('Unknown or duplicate consumed artifact');
  const result = readInputFile({ path: path.resolve(root, resultPath), root }), decision = readInputFile({ path: path.resolve(root, decisionPath), root });
  if (!sameSource(inspection.manifest.source, sourceSnapshot(root, inspection.ref.scope))) throw new Error('Source changed while recording consumption');
  const archive = archiveDirectory(root), directory = path.join(archive, '..', 'consumptions', inspection.ref.run_id, id);
  const record = { schema_version: '1', id, kind, evidence_ref: inspection.ref, artifacts: inspection.artifacts.filter(item => artifactIds.includes(item.id)), result: { path: 'result', sha256: digest(result), bytes: result.length }, decision: { path: 'decision', sha256: digest(decision), bytes: decision.length }, native: { toolCallId: null, toolName: null, resultEntryId: null, resultSha256: null, isError: null }, outputExcerpted: false, claim_truth: 'not_assessed' };
  const limits = inspection.manifest.limits;
  if (!limits || Object.entries(DEFAULT_LIMITS).some(([key, maximum]) => !Number.isSafeInteger(limits[key]) || limits[key] <= 0 || limits[key] > maximum)) throw new Error('Invalid sealed limits');
  return withLock(archive, () => {
    const current = inspectRun({ root, ref: inspection.ref });
    if (current.integrity !== 'current' || current.source !== 'current') throw new Error('Evidence changed before recording consumption');
    if (retainedBytes(archive) + result.length + decision.length + encode(record).length > limits.archiveBytes) throw new Error('Evidence archive capacity reached; preserve proof and reconcile retention');
    assertSafeDirectory(path.dirname(directory)); fs.mkdirSync(path.dirname(directory), { recursive: true, mode: 0o700 }); fs.mkdirSync(directory, { mode: 0o700 });
    writeExclusive(path.join(directory, 'result'), result); writeExclusive(path.join(directory, 'decision'), decision);
    writeExclusive(path.join(directory, 'consumption.json'), encode(record));
    return { directory, manifest_path: path.join(directory, 'consumption.json'), manifest_sha256: digest(encode(record)), evidence_ref: inspection.ref };
  });
}
function inspectConsumption({ root, ref }) {
  root = fs.realpathSync(path.resolve(root));
  if (typeof ref === 'string') ref = JSON.parse(readInputFile({ path: path.resolve(ref), root: path.dirname(path.resolve(ref)) }).toString());
  const parent = resolveReference({ root, ref: ref.evidence_ref });
  const base = path.join(archiveDirectory(root), '..', 'consumptions', parent.run_id);
  const directory = path.resolve(ref.directory || '');
  if (path.dirname(directory) !== path.resolve(base) || ref.manifest_path !== path.join(directory, 'consumption.json') || !/^[a-f0-9]{64}$/.test(ref.manifest_sha256 || '')) throw new Error('Invalid consumption reference');
  identifier(path.basename(directory));
  const result = { build_state: 'incomplete', integrity: 'missing', source: 'unknown', claim_truth: 'not_assessed' };
  let bytes;
  try { bytes = readInputFile({ path: ref.manifest_path, root: directory }); }
  catch (error) { if (error.code !== 'ENOENT') result.integrity = 'changed'; return result; }
  if (digest(bytes) !== ref.manifest_sha256) { result.integrity = 'changed'; return result; }
  const manifest = JSON.parse(bytes.toString());
  if (manifest.schema_version !== '1' || manifest.id !== path.basename(directory) || JSON.stringify(manifest.evidence_ref) !== JSON.stringify(parent)) throw new Error('Invalid consumption manifest');
  result.build_state = 'complete'; result.integrity = 'current';
  for (const name of ['result', 'decision']) {
    const item = manifest[name];
    if (!item || item.path !== name || !/^[a-f0-9]{64}$/.test(item.sha256)) throw new Error('Invalid consumption artifact');
    try { const captured = readInputFile({ path: path.join(directory, name), root: directory }); if (captured.length !== item.bytes || digest(captured) !== item.sha256) result.integrity = 'changed'; }
    catch (error) { if (error.code !== 'ENOENT' || result.integrity === 'changed') result.integrity = 'changed'; else result.integrity = 'missing'; }
  }
  const evidence = inspectRun({ root, ref: parent });
  result.source = evidence.source;
  if (evidence.integrity === 'changed' || (evidence.integrity === 'missing' && result.integrity !== 'changed')) result.integrity = evidence.integrity;
  for (const item of manifest.artifacts || []) {
    const actual = evidence.artifacts.find(artifact => artifact.id === item.id);
    if (!actual || actual.sha256 !== item.sha256 || actual.bytes !== item.bytes) result.integrity = 'changed';
  }
  result.evidence = evidence; result.manifest = manifest;
  return result;
}
function publishProjection(handle, { files }) {
  const inspection = inspectRun({ root: handle.root, ref: handle.evidence_ref });
  if (inspection.integrity !== 'current' || inspection.build_state !== 'complete' || inspection.source === 'stale') throw new Error('Cannot publish incomplete, changed or stale evidence');
  if ([handle.archive_dir, path.join(handle.archive_dir, '..', 'consumptions')].some(retained => isPathInside(retained, handle.out_dir) || isPathInside(handle.out_dir, retained))) throw new Error('Projection cannot write inside retained archive');
  if (!Array.isArray(files)) throw new Error('Projection files required');
  const prepared = files.map(item => {
    const source = relativePath(item.source), bytes = readInputFile({ path: path.join(handle.run_dir, source), root: handle.run_dir });
    const artifact = inspection.artifacts.find(record => record.relative_path === source);
    if (!artifact || bytes.length !== artifact.bytes || digest(bytes) !== artifact.sha256) throw new Error('Projection artifact changed');
    return { destination: relativePath(item.destination), bytes };
  });
  return withLock(path.join(handle.archive_dir, '..'), () => {
    assertSafeDirectory(handle.out_dir); fs.mkdirSync(handle.out_dir, { recursive: true, mode: 0o700 });
    assertSafeDestination(path.join(handle.out_dir, 'evidence-ref.json'));
    for (const item of prepared) { const file = path.join(handle.out_dir, item.destination); assertSafeDirectory(path.dirname(file)); assertSafeDestination(file); }
    for (const item of prepared) { const file = path.join(handle.out_dir, item.destination); fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 }); atomicReplace(file, item.bytes); }
    atomicReplace(path.join(handle.out_dir, 'evidence-ref.json'), encode(handle.evidence_ref));
    atomicReplace(path.join(handle.archive_dir, '..', 'latest-evidence-ref.json'), encode(handle.evidence_ref));
    return handle.evidence_ref;
  });
}
module.exports = { DEFAULT_LIMITS, beginRun, captureInput, captureOutput, writeOutput, sealRun, failRun, inspectRun, retrieveArtifact, recordConsumption, inspectConsumption, resolveReference, readProjectionReference, readInputFile, publishProjection, publishRun: publishProjection };
