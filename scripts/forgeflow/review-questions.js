'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const evidence = require('./review-evidence');
const { assertSafeDirectory, assertSafeDestination } = require('./file-safety');

const DEFAULT_LIMITS = Object.freeze({ requests_per_reviewer: 2, requests_per_review: 4, response_bytes_per_request: 65536, response_bytes_per_review: 131072, challenges_per_review: 2 });
const MAX_INPUT = 65536, SESSION_BYTES = 4 * 1024 * 1024, ARCHIVE_BYTES = 64 * 1024 * 1024;
const REVIEWERS = new Set(['builder_reviewer', 'guardian_reviewer', 'designer_reviewer', 'coordinator_reviewer', 'guardian_auditor']);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const serialize = value => Buffer.from(JSON.stringify(value));
function shape(value, keys, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key)) || keys.some(key => !optional.includes(key) && !Object.hasOwn(value, key))) throw new Error('Invalid or unknown protocol fields');
}
function text(value, maximum = 4096) {
  if (typeof value !== 'string' || !value.trim() || Buffer.byteLength(value, 'utf8') > maximum || value.includes('\0')) throw new Error('Invalid bounded text');
  return value;
}
function id(value) { if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(value)) throw new Error('Invalid identifier'); return value; }
function version(value) { if (value !== '1') throw new Error('Unsupported protocol version'); }
function bounded(value) { if (serialize(value).length > MAX_INPUT) throw new Error('Protocol input exceeds 64 KiB'); }
function ids(value) {
  if (!Array.isArray(value) || !value.length || value.length > 128 || new Set(value).size !== value.length) throw new Error('Invalid artifact IDs');
  value.forEach(id); return value;
}
function validateAssignments({ requiredReviewers, assignments }) {
  if (!Array.isArray(requiredReviewers) || !requiredReviewers.length || requiredReviewers.length > 32 || new Set(requiredReviewers).size !== requiredReviewers.length || requiredReviewers.some(item => !REVIEWERS.has(item))) throw new Error('Unsupported required reviewer coverage');
  if (!Array.isArray(assignments) || assignments.length !== requiredReviewers.length) throw new Error('Incomplete required reviewer assignments');
  const assigned = new Set(), names = new Set();
  for (const item of assignments) {
    shape(item, ['assignment_id', 'reviewer', 'question', 'artifact_ids', 'expected_evidence']);
    id(item.assignment_id); text(item.question); ids(item.artifact_ids);
    if (!requiredReviewers.includes(item.reviewer) || assigned.has(item.reviewer) || names.has(item.assignment_id)) throw new Error('Duplicate or unknown reviewer assignment');
    if (!Array.isArray(item.expected_evidence) || !item.expected_evidence.length || item.expected_evidence.length > 32) throw new Error('Expected evidence descriptions required');
    item.expected_evidence.forEach(item => text(item, 1024));
    if (item.question.trim().length < 20 || /^(review|check|audit)\s+(the\s+)?(code|changes|security|accessibility|architecture)[.!?]?$/i.test(item.question.trim())) throw new Error('Concrete falsifiable project question required');
    assigned.add(item.reviewer); names.add(item.assignment_id);
  }
  bounded({ requiredReviewers, assignments }); return JSON.parse(JSON.stringify(assignments));
}
function current(root, ref) {
  const inspection = evidence.inspectRun({ root, ref });
  if (inspection.build_state !== 'complete' || inspection.integrity !== 'current' || inspection.source !== 'current') throw new Error('Current complete intact evidence required');
  return inspection;
}
function authorized(inspection, artifactIds) {
  for (const artifactId of artifactIds) {
    const artifact = inspection.artifacts.find(item => item.id === artifactId);
    if (!artifact || !['source', 'diff', 'contract'].includes(artifact.kind)) throw new Error('Artifact outside authorized source/diff/contract inputs');
  }
}
function archive(root) { return path.join(root, '.forgeflow', path.basename(root), 'context', 'question-sessions'); }
function read(file, root, maximum = SESSION_BYTES) { return evidence.readInputFile({ path: file, root, maxBytes: maximum }); }
function exclusive(file, bytes) {
  assertSafeDirectory(path.dirname(file));
  const fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW || 0), 0o600);
  try {
    const stat = fs.fstatSync(fd), named = fs.lstatSync(file);
    if (!stat.isFile() || stat.nlink !== 1 || stat.ino !== named.ino || stat.dev !== named.dev) throw new Error('Unsafe session write');
    fs.writeFileSync(fd, bytes); fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
}
function replace(file, bytes) {
  assertSafeDestination(file);
  const temporary = `${file}.${crypto.randomUUID()}.tmp`; exclusive(temporary, bytes);
  try { assertSafeDestination(file); fs.renameSync(temporary, file); syncDirectory(path.dirname(file)); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
function syncDirectory(directory) { const fd = fs.openSync(directory, fs.constants.O_RDONLY); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
function size(directory) {
  if (!fs.existsSync(directory)) return 0;
  assertSafeDirectory(directory);
  let bytes = 0;
  for (const name of fs.readdirSync(directory)) {
    const file = path.join(directory, name), stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile()) || (stat.isFile() && stat.nlink !== 1)) throw new Error('Unsafe session archive entry');
    bytes += stat.isDirectory() ? size(file) : stat.size;
  }
  return bytes;
}
function capacity(directory, extra) {
  if (size(directory) + extra > SESSION_BYTES || size(path.dirname(directory)) + extra > ARCHIVE_BYTES) throw new Error('Session capacity reached; preserve proof and explicitly reconcile retention');
}
function locked(root, operation) {
  const directory = archive(root); assertSafeDirectory(directory); fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const lock = path.join(directory, '.questions.lock'), deadline = Date.now() + 10000; let fd;
  while (fd === undefined) {
    try { fd = fs.openSync(lock, 'wx', 0o600); }
    catch (error) { if (error.code !== 'EEXIST') throw error; if (Date.now() >= deadline) throw new Error('Session writer interrupted or busy; reconcile lock explicitly'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20); }
  }
  try { fs.writeFileSync(fd, serialize({ pid: process.pid })); fs.fsyncSync(fd); return operation(); }
  finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
function reference(root, ref) {
  if (typeof ref === 'string') ref = JSON.parse(read(path.resolve(root, ref), root, MAX_INPUT).toString('utf8'));
  shape(ref, ['schema_version', 'session_id', 'contract_sha256', 'evidence_ref']); version(ref.schema_version); id(ref.session_id);
  if (!/^[a-f0-9]{64}$/.test(ref.contract_sha256)) throw new Error('Invalid contract hash');
  shape(ref.evidence_ref, ['schema_version', 'run_id', 'run_dir', 'manifest_path', 'manifest_sha256', 'scope']);
  evidence.resolveReference({ root, ref: ref.evidence_ref }); return ref;
}
function load(root, sessionRef) {
  const ref = reference(root, sessionRef), directory = path.join(archive(root), ref.session_id);
  assertSafeDirectory(directory);
  const bytes = read(path.join(directory, 'contract.json'), directory, MAX_INPUT);
  if (hash(bytes) !== ref.contract_sha256) throw new Error('Changed session contract');
  const contract = JSON.parse(bytes.toString('utf8'));
  if (JSON.stringify(contract.evidence_ref) !== JSON.stringify(ref.evidence_ref)) throw new Error('Mixed evidence identities');
  const head = JSON.parse(read(path.join(directory, 'head.json'), directory).toString('utf8'));
  shape(head, ['sequence', 'hash']);
  if (!Number.isSafeInteger(head.sequence) || head.sequence < 0 || typeof head.hash !== 'string') throw new Error('Invalid session head');
  const entries = []; let previous = ref.contract_sha256;
  const names = fs.readdirSync(directory).sort();
  if (names.some(name => !['contract.json', 'head.json'].includes(name) && !/^\d{6}\.json$/.test(name)) || names.length !== head.sequence + 2) throw new Error('Missing, forked or interrupted ledger; explicit reconciliation required');
  for (let sequence = 1; sequence <= head.sequence; sequence++) {
    const record = read(path.join(directory, `${String(sequence).padStart(6, '0')}.json`), directory);
    const entry = JSON.parse(record.toString('utf8'));
    if (entry.sequence !== sequence || entry.previous !== previous) throw new Error('Reordered session ledger');
    previous = hash(record); entries.push(entry);
  }
  if (previous !== head.hash) throw new Error('Changed session ledger');
  return { root, ref, directory, contract, entries, head };
}
function append(session, event) {
  const sequence = session.head.sequence + 1;
  const bytes = serialize({ sequence, previous: session.head.hash, ...event }), head = { sequence, hash: hash(bytes) };
  capacity(session.directory, bytes.length + serialize(head).length * 2 + 1024);
  exclusive(path.join(session.directory, `${String(sequence).padStart(6, '0')}.json`), bytes);
  syncDirectory(session.directory); replace(path.join(session.directory, 'head.json'), serialize(head));
  session.entries.push(JSON.parse(bytes)); session.head = head;
}
function accounting(session) {
  const reservations = session.entries.filter(item => item.type === 'request_reserved'), completions = session.entries.filter(item => item.type === 'request_completed');
  let used = 0;
  for (const reserved of reservations) used += completions.find(item => item.event_id === reserved.event_id)?.bytes ?? reserved.allowance;
  return { reservations, completions, used, challenges: session.entries.filter(item => item.type === 'challenge_reserved'), responses: session.entries.filter(item => item.type === 'response_retained') };
}
function remaining(session) {
  const state = accounting(session), limits = session.contract.limits;
  return { requests: Math.max(0, limits.requests_per_review - state.reservations.length), response_bytes: Math.max(0, limits.response_bytes_per_review - state.used), challenges: Math.max(0, limits.challenges_per_review - state.challenges.length) };
}
function startSession({ root, evidenceRef, requiredReviewers, assignments, limits = {} }) {
  root = fs.realpathSync(path.resolve(root));
  assignments = validateAssignments({ requiredReviewers, assignments });
  shape(limits, Object.keys(DEFAULT_LIMITS), Object.keys(DEFAULT_LIMITS));
  const boundedLimits = { ...DEFAULT_LIMITS, ...limits };
  for (const [key, value] of Object.entries(boundedLimits)) if (!Number.isSafeInteger(value) || value < 0 || value > DEFAULT_LIMITS[key]) throw new Error('Limits may only lower hard ceilings');
  if (typeof evidenceRef !== 'object') throw new Error('Session start requires exact E2 reference object');
  shape(evidenceRef, ['schema_version', 'run_id', 'run_dir', 'manifest_path', 'manifest_sha256', 'scope']);
  const inspection = current(root, evidenceRef); assignments.forEach(item => authorized(inspection, item.artifact_ids));
  const contract = { schema_version: '1', evidence_ref: inspection.ref, required_reviewers: [...requiredReviewers], assignments, limits: boundedLimits };
  bounded(contract); const bytes = serialize(contract), ref = { schema_version: '1', session_id: `questions-${crypto.randomUUID()}`, contract_sha256: hash(bytes), evidence_ref: inspection.ref };
  return locked(root, () => {
    current(root, inspection.ref); const directory = path.join(archive(root), ref.session_id);
    capacity(directory, bytes.length + 1024); fs.mkdirSync(directory, { mode: 0o700 });
    exclusive(path.join(directory, 'contract.json'), bytes); exclusive(path.join(directory, 'head.json'), serialize({ sequence: 0, hash: ref.contract_sha256 })); syncDirectory(directory);
    return { session_ref: ref, limits: boundedLimits, required_reviewers: [...requiredReviewers] };
  });
}
function inspectSession({ root, sessionRef }) {
  root = fs.realpathSync(path.resolve(root));
  return locked(root, () => {
    const session = load(root, sessionRef), state = accounting(session), inspection = evidence.inspectRun({ root, ref: session.ref.evidence_ref });
    return { schema_version: '1', session_ref: session.ref, source: inspection.source, integrity: inspection.integrity, build_state: inspection.build_state, contract: session.contract, remaining: remaining(session), requests: state.reservations.map(item => ({ request_id: item.request_id, assignment_id: item.assignment_id, request_status: state.completions.find(done => done.event_id === item.event_id)?.resolution.request_status || session.entries.find(done => done.type === 'request_aborted' && done.event_id === item.event_id)?.request_status || 'interrupted', reserved_bytes: item.allowance, charged_bytes: state.completions.find(done => done.event_id === item.event_id)?.bytes ?? item.allowance, response_sha256: state.completions.find(done => done.event_id === item.event_id)?.response_sha256 || null, retained_sequence: state.completions.find(done => done.event_id === item.event_id)?.sequence || item.sequence })), challenges: state.challenges.map(item => ({ challenge_id: item.challenge.challenge_id, assignment_id: item.challenge.assignment_id, status: state.responses.some(response => response.kind === 'challenge' && response.subject_id === item.challenge.challenge_id) ? 'retained' : 'unresolved' })), responses: state.responses.map(item => ({ response_id: item.response_id, kind: item.kind, subject_id: item.subject_id, consumption_ref: item.consumption_ref })), claim_truth: 'not_assessed' };
  });
}
function validateRequest(request) {
  shape(request, ['schema_version', 'request_id', 'assignment_id', 'reviewer', 'artifact_id', 'extent', 'why_decisive']);
  version(request.schema_version); id(request.request_id); id(request.assignment_id); id(request.artifact_id); text(request.why_decisive); bounded(request);
  if (request.extent?.mode === 'full') shape(request.extent, ['mode']);
  else { shape(request.extent, ['mode', 'start_line', 'end_line']); if (request.extent.mode !== 'lines' || !Number.isSafeInteger(request.extent.start_line) || !Number.isSafeInteger(request.extent.end_line) || request.extent.start_line < 1 || request.extent.end_line < request.extent.start_line) throw new Error('Invalid request extent'); }
}
function resolveRequest({ root, sessionRef, request }) {
  root = fs.realpathSync(path.resolve(root));
  return locked(root, () => {
    const session = load(root, sessionRef), assignment = session.contract.assignments.find(item => item.assignment_id === request?.assignment_id);
    if (!assignment || request?.reviewer !== assignment.reviewer) throw new Error('Unknown assignment or reviewer; no source access');
    const requestHash = hash(serialize(request)), state = accounting(session), replay = state.reservations.find(item => item.request_id === request.request_id);
    if (replay) {
      if (replay.request_sha256 !== requestHash) throw new Error('Mismatching request replay');
      throw new Error('Request already reserved; inspect retained proof without redelivery');
    }
    let invalid = false; try { validateRequest(request); } catch (_) { invalid = true; }
    const ownCount = state.reservations.filter(item => item.assignment_id === assignment.assignment_id).length;
    if (state.reservations.length >= session.contract.limits.requests_per_review || ownCount >= session.contract.limits.requests_per_reviewer) {
      append(session, { type: 'request_refused', event_id: `refused-${crypto.randomUUID()}`, request_sha256: requestHash, assignment_id: assignment.assignment_id, reason: 'Request count exhausted' });
      throw new Error('Request count exhausted; refusal retained and decisive question remains unresolved');
    }
    const allowance = Math.min(session.contract.limits.response_bytes_per_request, remaining(session).response_bytes), eventId = `request-${crypto.randomUUID()}`;
    // Reserve durable cumulative output before any source retrieval. An unfinished reservation is never refunded.
    capacity(session.directory, allowance + MAX_INPUT + 16384);
    append(session, { type: 'request_reserved', event_id: eventId, request_id: invalid ? eventId : request.request_id, request_sha256: requestHash, assignment_id: assignment.assignment_id, allowance });
    let status = invalid ? 'denied' : 'fulfilled', reason = invalid ? 'Malformed request' : 'Authorized sealed artifact', identity = null, delivery = null;
    if (!invalid) {
      try {
        const inspection = current(root, session.ref.evidence_ref);
        const artifact = inspection.artifacts.find(item => item.id === request.artifact_id);
        if (!assignment.artifact_ids.includes(request.artifact_id)) { status = 'denied'; reason = 'Artifact outside assignment allowlist'; }
        else if (!artifact) { status = 'unavailable'; reason = 'Artifact absent from frozen inventory'; }
        else {
          identity = { run_id: inspection.ref.run_id, manifest_sha256: inspection.ref.manifest_sha256, artifact_id: artifact.id, artifact_sha256: artifact.sha256, artifact_bytes: artifact.bytes };
          if (request.extent.mode === 'full' && (artifact.coverage !== 'full' || artifact.bytes > allowance)) { status = 'exhausted'; reason = 'Complete proof cannot fit remaining serialized response allowance'; }
          else {
            const retrieved = evidence.retrieveArtifact({ root, ref: session.ref.evidence_ref, artifactId: artifact.id, ...(request.extent.mode === 'lines' ? { startLine: request.extent.start_line, endLine: request.extent.end_line } : {}), maxChars: evidence.DEFAULT_LIMITS.artifactBytes });
            if (request.extent.mode === 'full' && retrieved.coverage !== 'full') throw new Error('Complete proof unavailable');
            delivery = { encoding: 'utf8', content: retrieved.content, coverage: retrieved.coverage, start_line: retrieved.start_line, end_line: retrieved.end_line, omitted_before_lines: retrieved.omitted_before_lines, omitted_after_lines: retrieved.omitted_after_lines, omitted_characters: retrieved.omitted_characters };
          }
        }
        current(root, session.ref.evidence_ref);
      } catch (error) { status = /Current complete/.test(error.message) ? 'stale' : 'unavailable'; reason = status === 'stale' ? 'Evidence no longer current' : 'Requested proof unavailable'; delivery = null; }
    }
    const resolution = { schema_version: '1', request_id: invalid ? eventId : request.request_id, assignment_id: assignment.assignment_id, request_status: status, reason, evidence_identity: identity, delivery, remaining: null };
    function encodeResolution() {
      let bytes = 0;
      for (let i = 0; i < 5; i++) { resolution.remaining = { ...remaining(session), response_bytes: Math.max(0, session.contract.limits.response_bytes_per_review - (accounting(session).used - allowance + bytes)) }; bytes = serialize(resolution).length; }
      return serialize(resolution);
    }
    let bytes = encodeResolution();
    if (bytes.length > allowance) { resolution.request_status = 'exhausted'; resolution.reason = 'Serialized proof exceeds remaining response allowance'; resolution.delivery = null; resolution.evidence_identity = null; bytes = encodeResolution(); }
    if (bytes.length > allowance) {
      append(session, { type: 'request_aborted', event_id: eventId, request_status: 'exhausted', reason: 'Minimal response cannot fit' });
      throw new Error('Minimal response cannot fit; reservation remains exhausted and unresolved');
    }
    append(session, { type: 'request_completed', event_id: eventId, resolution, bytes: bytes.length, response_sha256: hash(bytes) });
    return resolution;
  });
}
function prepareChallenge({ root, sessionRef, challenge }) {
  shape(challenge, ['schema_version', 'challenge_id', 'assignment_id', 'question', 'original_contract', 'artifact_ids', 'user_constraints']);
  version(challenge.schema_version); id(challenge.challenge_id); id(challenge.assignment_id); text(challenge.question); text(challenge.original_contract); ids(challenge.artifact_ids);
  if (!Array.isArray(challenge.user_constraints) || challenge.user_constraints.length > 32) throw new Error('Invalid user constraints'); challenge.user_constraints.forEach(item => text(item, 1024)); bounded(challenge);
  root = fs.realpathSync(path.resolve(root));
  return locked(root, () => {
    const session = load(root, sessionRef), inspection = current(root, session.ref.evidence_ref), state = accounting(session);
    const assignment = session.contract.assignments.find(item => item.assignment_id === challenge.assignment_id);
    if (!assignment || challenge.artifact_ids.some(item => !assignment.artifact_ids.includes(item))) throw new Error('Challenge outside assignment authority');
    authorized(inspection, challenge.artifact_ids);
    if (state.challenges.some(item => item.challenge.challenge_id === challenge.challenge_id)) throw new Error('Challenge ID already reserved');
    if (!remaining(session).challenges) throw new Error('Challenge budget exhausted');
    append(session, { type: 'challenge_reserved', challenge });
    return { schema_version: '1', challenge, evidence_ref: session.ref.evidence_ref, isolation: 'restricted_prompt_only', required_supervisor_check: 'Inspect exact case-only export for peer-derived propositions before fresh dispatch', remaining: remaining(session) };
  });
}
function relative(value) { text(value, 4096); if (path.isAbsolute(value) || value.includes('\\') || value.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Result paths must be orchestrator-owned relative inputs'); return value; }
function recordResponse({ root, sessionRef, response }) {
  shape(response, ['schema_version', 'response_id', 'kind', 'subject_id', 'result_path', 'decision_path', 'artifact_ids']);
  version(response.schema_version); id(response.response_id); id(response.subject_id); relative(response.result_path); relative(response.decision_path); ids(response.artifact_ids); bounded(response);
  if (!['reviewer', 'challenge'].includes(response.kind)) throw new Error('Invalid response kind');
  root = fs.realpathSync(path.resolve(root));
  return locked(root, () => {
    const session = load(root, sessionRef), inspection = current(root, session.ref.evidence_ref), state = accounting(session);
    const subject = response.kind === 'reviewer' ? session.contract.assignments.find(item => item.assignment_id === response.subject_id) : state.challenges.find(item => item.challenge.challenge_id === response.subject_id)?.challenge;
    if (!subject || response.artifact_ids.some(item => !subject.artifact_ids.includes(item))) throw new Error('Unknown response subject or unauthorized artifact');
    if (state.responses.some(item => item.response_id === response.response_id || (item.kind === response.kind && item.subject_id === response.subject_id))) throw new Error('Response already retained');
    authorized(inspection, response.artifact_ids); capacity(session.directory, MAX_INPUT);
    const consumptionRef = evidence.recordConsumption({ root, ref: session.ref.evidence_ref, id: `questions-response-${hash(serialize([session.ref.session_id, response.response_id]))}`, kind: response.kind, resultPath: response.result_path, decisionPath: response.decision_path, artifactIds: response.artifact_ids });
    current(root, session.ref.evidence_ref);
    const retained = evidence.inspectConsumption({ root, ref: consumptionRef });
    if (retained.integrity !== 'current' || retained.source !== 'current' || retained.build_state !== 'complete') throw new Error('Response retention incomplete or stale');
    append(session, { type: 'response_retained', response_id: response.response_id, kind: response.kind, subject_id: response.subject_id, consumption_ref: consumptionRef });
    return { schema_version: '1', response_id: response.response_id, consumption_ref: consumptionRef, claim_truth: 'not_assessed' };
  });
}
function prepareSynthesis({ root, sessionRef }) {
  root = fs.realpathSync(path.resolve(root));
  return locked(root, () => {
    const session = load(root, sessionRef); current(root, session.ref.evidence_ref); const state = accounting(session), unresolved = [];
    for (const assignment of session.contract.assignments) if (!state.responses.some(item => item.kind === 'reviewer' && item.subject_id === assignment.assignment_id)) unresolved.push({ assignment_id: assignment.assignment_id, reason: 'Required reviewer response missing' });
    for (const refused of session.entries.filter(item => item.type === 'request_refused')) unresolved.push({ assignment_id: refused.assignment_id, reason: refused.reason });
    for (const request of state.reservations) {
      const completed = state.completions.find(item => item.event_id === request.event_id);
      if (!completed || completed.resolution.request_status !== 'fulfilled') unresolved.push({ assignment_id: request.assignment_id, request_id: request.request_id, reason: completed?.resolution.request_status || session.entries.find(item => item.type === 'request_aborted' && item.event_id === request.event_id)?.request_status || 'interrupted' });
    }
    for (const item of state.challenges) if (!state.responses.some(response => response.kind === 'challenge' && response.subject_id === item.challenge.challenge_id)) unresolved.push({ challenge_id: item.challenge.challenge_id, reason: 'Reserved challenge response missing' });
    for (const item of state.responses) { const proof = evidence.inspectConsumption({ root, ref: item.consumption_ref }); if (proof.integrity !== 'current' || proof.source !== 'current' || proof.build_state !== 'complete') throw new Error('Retained response no longer current'); }
    current(root, session.ref.evidence_ref);
    return { schema_version: '1', session_ref: session.ref, required_reviewers: session.contract.required_reviewers, responses: state.responses.map(item => ({ kind: item.kind, subject_id: item.subject_id, consumption_ref: item.consumption_ref })), unresolved, coverage: unresolved.length ? 'incomplete' : 'retained', remaining: remaining(session), claim_truth: 'not_assessed' };
  });
}
module.exports = { DEFAULT_LIMITS, validateAssignments, startSession, inspectSession, resolveRequest, prepareChallenge, recordResponse, prepareSynthesis };
