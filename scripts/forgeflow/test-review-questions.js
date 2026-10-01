'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync, spawn } = require('child_process');
const evidence = require('./review-evidence');
const questions = require('./review-questions');
let passed = 0;
function check(name, operation) { operation(); passed++; process.stdout.write(`ok ${passed} - ${name}\n`); }
function repository() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'review-questions-'));
  for (const args of [['init', '-q']]) { const result = spawnSync('git', args, { cwd: root }); assert.equal(result.status, 0); }
  fs.writeFileSync(path.join(root, 'source.txt'), 'first\nsecond\nthird\nfourth\nlast\n');
  const git = args => { const result = spawnSync('git', args, { cwd: root }); assert.equal(result.status, 0); };
  git(['add', 'source.txt']); git(['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'base']);
  return root;
}
function fixture(limits = {}, extra = []) {
  const root = repository(), run = evidence.beginRun({ root, scope: ['source.txt'] });
  evidence.captureInput(run, { id: 'source', path: 'source.txt', kind: 'source' });
  evidence.captureInput(run, { id: 'advisory', bytes: 'memory', kind: 'advisory' });
  for (const item of extra) evidence.captureInput(run, item);
  const ref = evidence.sealRun(run);
  const assignments = [{ assignment_id: 'boundary', reviewer: 'builder_reviewer', question: 'Does source.txt preserve the final caller boundary?', artifact_ids: ['source', ...extra.filter(item => item.kind === 'source').map(item => item.id)], expected_evidence: ['Complete caller source with its branch guards'] }];
  const started = questions.startSession({ root, evidenceRef: ref, requiredReviewers: ['builder_reviewer'], assignments, limits });
  return { root, ref, assignments, sessionRef: started.session_ref };
}
function request(f, requestId = 'first', overrides = {}) { return questions.resolveRequest({ root: f.root, sessionRef: f.sessionRef, request: { schema_version: '1', request_id: requestId, assignment_id: 'boundary', reviewer: 'builder_reviewer', artifact_id: 'source', extent: { mode: 'full' }, why_decisive: 'The final caller branch distinguishes the competing interpretations', ...overrides } }); }
function directory(f) { return path.join(f.root, '.forgeflow', path.basename(f.root), 'context', 'question-sessions', f.sessionRef.session_id); }
function child(code) { return new Promise((resolve, reject) => { const process = spawn(global.process.execPath, ['-e', code], { env: global.process.env }); let out = '', err = ''; process.stdout.on('data', data => { out += data; }); process.stderr.on('data', data => { err += data; }); process.on('error', reject); process.on('close', status => resolve({ status, out, err })); }); }
(async () => {
  check('exact assignments enforce full specialist roster and concrete questions', () => {
    const f = fixture(); assert.equal(questions.validateAssignments({ requiredReviewers: ['builder_reviewer'], assignments: f.assignments }).length, 1);
    for (const bad of [{ ...f.assignments[0], command: 'read' }, { ...f.assignments[0], question: 'Review code?' }, { ...f.assignments[0], expected_evidence: [] }]) assert.throws(() => questions.validateAssignments({ requiredReviewers: ['builder_reviewer'], assignments: [bad] }));
    assert.throws(() => questions.validateAssignments({ requiredReviewers: ['architect_reviewer'], assignments: f.assignments }));
    assert.throws(() => questions.validateAssignments({ requiredReviewers: ['builder_reviewer', 'guardian_reviewer'], assignments: f.assignments }));
  });
  check('start excludes advisory artifacts unknown ref fields and expanded limits', () => {
    const f = fixture();
    assert.throws(() => questions.startSession({ root: f.root, evidenceRef: f.ref, requiredReviewers: ['builder_reviewer'], assignments: [{ ...f.assignments[0], artifact_ids: ['advisory'] }] }), /authorized/);
    assert.throws(() => questions.startSession({ root: f.root, evidenceRef: { ...f.ref, latest: true }, requiredReviewers: ['builder_reviewer'], assignments: f.assignments }), /unknown/);
    assert.throws(() => questions.startSession({ root: f.root, evidenceRef: f.ref, requiredReviewers: ['builder_reviewer'], assignments: f.assignments, limits: { requests_per_review: 5 } }), /lower/);
  });
  check('full delivery retains exact bytes and serialized UTF8 accounting', () => {
    const f = fixture(), result = request(f);
    assert.equal(result.request_status, 'fulfilled'); assert.equal(result.delivery.content, fs.readFileSync(path.join(f.root, 'source.txt'), 'utf8'));
    assert.equal(result.delivery.coverage, 'full'); assert.equal(Object.hasOwn(result.delivery, 'content_base64'), false);
    const state = questions.inspectSession(f); assert.equal(state.requests[0].charged_bytes, Buffer.byteLength(JSON.stringify(result), 'utf8'));
    assert.equal(result.remaining.response_bytes, questions.DEFAULT_LIMITS.response_bytes_per_review - state.requests[0].charged_bytes);
  });
  check('line preview includes neighbors and explicit omissions', () => {
    const f = fixture(), result = request(f, 'lines', { extent: { mode: 'lines', start_line: 3, end_line: 3 } });
    assert.equal(result.delivery.content, 'second\nthird\nfourth'); assert.equal(result.delivery.start_line, 2); assert.equal(result.delivery.omitted_before_lines, 1); assert.equal(result.delivery.coverage, 'excerpted');
  });
  check('denied malformed attempts consume counts and no source access', () => {
    const f = fixture(); const result = request(f, 'bad', { command: 'cat', path: 'source.txt' }); assert.equal(result.request_status, 'denied'); assert.equal(result.delivery, null);
    request(f, 'denied', { artifact_id: 'advisory' }); assert.throws(() => request(f, 'third'), /exhausted/);
    const synthesis = questions.prepareSynthesis(f); assert(synthesis.unresolved.some(item => /exhausted/.test(item.reason))); assert.equal(synthesis.remaining.requests, 2);
  });
  check('unknown assignments and reviewers cannot retrieve or spend another assignment', () => {
    const f = fixture(); assert.throws(() => request(f, 'unknown', { assignment_id: 'other' }), /Unknown/); assert.throws(() => request(f, 'other', { reviewer: 'guardian_reviewer' }), /Unknown/); assert.equal(questions.inspectSession(f).requests.length, 0);
  });
  check('completed replay retains identity and never redelivers free evidence', () => {
    const f = fixture(); request(f); assert.throws(() => request(f), /already reserved/); const state = questions.inspectSession(f); assert.match(state.requests[0].response_sha256, /^[a-f0-9]{64}$/); assert.equal(state.requests.length, 1);
    assert.throws(() => request(f, 'first', { why_decisive: 'A changed reason must not silently reuse completed proof' }), /Mismatching/);
  });
  check('multibyte escaping and metadata count toward the full ceiling', () => {
    const f = fixture({ response_bytes_per_request: 1024 }, [{ id: 'utf8', kind: 'source', bytes: '😀'.repeat(220) }]);
    const result = request(f, 'unicode', { artifact_id: 'utf8' }); assert.equal(result.request_status, 'exhausted'); assert.equal(result.delivery, null); assert(questions.inspectSession(f).requests[0].charged_bytes <= 1024);
  });
  check('zero response budget preserves durable exhausted state and emits no evidence', () => {
    const f = fixture({ response_bytes_per_review: 0 }); assert.throws(() => request(f), /Minimal response/);
    const state = questions.inspectSession(f); assert.equal(state.requests[0].request_status, 'exhausted'); assert.equal(state.remaining.response_bytes, 0); assert(questions.prepareSynthesis(f).unresolved.some(item => item.reason === 'exhausted'));
  });
  check('binary and incomplete proof never masquerade as full delivery', () => {
    const f = fixture({}, [{ id: 'binary', kind: 'source', bytes: Buffer.from([255, 254]) }, { id: 'excerpt', kind: 'source', bytes: 'partial', coverage: 'excerpted' }]);
    assert.equal(request(f, 'binary', { artifact_id: 'binary' }).request_status, 'unavailable'); assert.equal(request(f, 'excerpt', { artifact_id: 'excerpt' }).request_status, 'exhausted');
  });
  check('challenge strictly restricts neutral inputs and reserves before response', () => {
    const f = fixture(), challenge = { schema_version: '1', challenge_id: 'neutral', assignment_id: 'boundary', question: 'Which source branch distinguishes the caller alternatives?', original_contract: 'Preserve the caller boundary in source.txt', artifact_ids: ['source'], user_constraints: ['Retain original task scope'] };
    assert.throws(() => questions.prepareChallenge({ ...f, challenge: { ...challenge, verdict: 'approve' } }), /unknown/);
    questions.prepareChallenge({ ...f, challenge }); questions.prepareChallenge({ ...f, challenge: { ...challenge, challenge_id: 'second' } }); assert.throws(() => questions.prepareChallenge({ ...f, challenge: { ...challenge, challenge_id: 'third' } }), /budget/);
    assert.equal(questions.prepareSynthesis(f).unresolved.filter(item => item.challenge_id).length, 2);
  });
  check('actual complete response bytes are retained through E2 and inspected for synthesis', () => {
    const f = fixture(); fs.mkdirSync(path.join(f.root, '.forgeflow', 'inputs'), { recursive: true }); fs.writeFileSync(path.join(f.root, '.forgeflow', 'inputs', 'result'), 'Actual scoped source assessment\n'); fs.writeFileSync(path.join(f.root, '.forgeflow', 'inputs', 'decision'), '{"supported":false}\n');
    const response = { schema_version: '1', response_id: 'result', kind: 'reviewer', subject_id: 'boundary', result_path: '.forgeflow/inputs/result', decision_path: '.forgeflow/inputs/decision', artifact_ids: ['source'] };
    const retained = questions.recordResponse({ ...f, response }); assert.equal(evidence.inspectConsumption({ root: f.root, ref: retained.consumption_ref }).integrity, 'current'); assert.equal(questions.prepareSynthesis(f).coverage, 'retained');
    assert.throws(() => questions.recordResponse({ ...f, response }), /already/); fs.appendFileSync(path.join(retained.consumption_ref.directory, 'result'), 'changed'); assert.throws(() => questions.prepareSynthesis(f), /no longer current/);
  });
  check('response paths refuse traversal symlinks and hardlinks', () => {
    const f = fixture(); fs.mkdirSync(path.join(f.root, '.forgeflow', 'inputs'), { recursive: true }); const input = path.join(f.root, '.forgeflow', 'inputs', 'result'); fs.writeFileSync(input, 'response'); fs.symlinkSync(input, path.join(f.root, '.forgeflow', 'inputs', 'symbol')); fs.linkSync(input, path.join(f.root, '.forgeflow', 'inputs', 'hard'));
    const response = { schema_version: '1', response_id: 'safe', kind: 'reviewer', subject_id: 'boundary', result_path: '.forgeflow/inputs/result', decision_path: '.forgeflow/inputs/symbol', artifact_ids: ['source'] };
    assert.throws(() => questions.recordResponse({ ...f, response: { ...response, result_path: '../escape' } }), /relative/);
    assert.throws(() => questions.recordResponse({ ...f, response }), /Unsafe/); fs.unlinkSync(path.join(f.root, '.forgeflow', 'inputs', 'hard')); assert.throws(() => questions.recordResponse({ ...f, response }), /Unsafe/);
  });
  check('stale source refuses start challenge response synthesis and fresh request delivery', () => {
    const f = fixture(); fs.appendFileSync(path.join(f.root, 'source.txt'), 'drift');
    assert.throws(() => questions.startSession({ root: f.root, evidenceRef: f.ref, requiredReviewers: ['builder_reviewer'], assignments: f.assignments }), /Current/); assert.throws(() => questions.prepareSynthesis(f), /Current/);
    assert.throws(() => questions.prepareChallenge({ ...f, challenge: { schema_version: '1', challenge_id: 'stale', assignment_id: 'boundary', question: 'Which source branch governs the caller boundary?', original_contract: 'Preserve caller boundary', artifact_ids: ['source'], user_constraints: [] } }), /Current/);
    assert.throws(() => questions.recordResponse({ ...f, response: { schema_version: '1', response_id: 'stale', kind: 'reviewer', subject_id: 'boundary', result_path: '.forgeflow/result', decision_path: '.forgeflow/decision', artifact_ids: ['source'] } }), /Current/);
    assert.equal(request(f).request_status, 'stale');
  });
  check('ledger tampering missing tail and unsafe contract aliases reject', () => {
    const f = fixture(); request(f); fs.appendFileSync(path.join(directory(f), '000001.json'), ' '); assert.throws(() => questions.inspectSession(f), /ledger/);
    const next = fixture(); request(next); fs.unlinkSync(path.join(directory(next), '000002.json')); assert.throws(() => questions.inspectSession(next), /ledger/);
    const alias = fixture(); fs.linkSync(path.join(directory(alias), 'contract.json'), path.join(alias.root, 'alias')); assert.throws(() => questions.inspectSession(alias), /Unsafe/);
  });
  check('session directory and state files use restricted modes', () => { const f = fixture(); assert.equal(fs.statSync(directory(f)).mode & 0o777, 0o700); assert.equal(fs.statSync(path.join(directory(f), 'contract.json')).mode & 0o777, 0o600); });
  const concurrent = fixture();
  const requestValue = name => ({ schema_version: '1', request_id: name, assignment_id: 'boundary', reviewer: 'builder_reviewer', artifact_id: 'source', extent: { mode: 'full' }, why_decisive: 'Caller branch determines the source contract' });
  const results = await Promise.all(['a', 'b', 'c'].map(name => child(`const q=require(${JSON.stringify(path.join(__dirname, 'review-questions'))});try{q.resolveRequest(${JSON.stringify({ root: concurrent.root, sessionRef: concurrent.sessionRef, request: requestValue(name) })});process.stdout.write('ok')}catch(e){process.stderr.write(e.message);process.exitCode=1}`)));
  check('concurrent processes serialize cumulative per-reviewer reservations', () => { assert.equal(results.filter(item => item.status === 0).length, 2); assert.equal(questions.inspectSession(concurrent).requests.length, 2); assert(questions.prepareSynthesis(concurrent).unresolved.some(item => /exhausted/.test(item.reason))); });
  const crash = fixture(); const exited = await child(`const e=require(${JSON.stringify(path.join(__dirname, 'review-evidence'))});const q=require(${JSON.stringify(path.join(__dirname, 'review-questions'))});e.retrieveArtifact=()=>process.exit(9);q.resolveRequest(${JSON.stringify({ root: crash.root, sessionRef: crash.sessionRef, request: requestValue('crash') })})`);
  check('crash reservation survives restart without refund after explicit lock reconciliation', () => {
    assert.equal(exited.status, 9); const lock = path.join(path.dirname(directory(crash)), '.questions.lock'); assert(fs.existsSync(lock)); fs.unlinkSync(lock);
    const state = questions.inspectSession(crash); assert.equal(state.requests[0].request_status, 'interrupted'); assert.equal(state.requests[0].charged_bytes, 65536); assert.equal(state.remaining.response_bytes, 65536); assert.throws(() => request(crash, 'crash', requestValue('crash')), /already reserved/);
  });
  check('prospective session and archive ceilings preserve existing ledger bytes', () => {
    const f = fixture(); request(f);
    const record = path.join(directory(f), '000002.json'), padded = Buffer.concat([fs.readFileSync(record), Buffer.alloc(4 * 1024 * 1024 - 4096, 32)]); fs.writeFileSync(record, padded);
    const digest = require('crypto').createHash('sha256').update(padded).digest('hex'); fs.writeFileSync(path.join(directory(f), 'head.json'), JSON.stringify({ sequence: 2, hash: digest }));
    const original = fs.readFileSync(path.join(directory(f), 'head.json')); assert.throws(() => request(f, 'capacity'), /capacity/); assert.deepEqual(fs.readFileSync(path.join(directory(f), 'head.json')), original);
    const next = fixture(); fs.mkdirSync(path.join(path.dirname(directory(next)), 'retained')); fs.writeFileSync(path.join(path.dirname(directory(next)), 'retained', 'capacity'), Buffer.alloc(64 * 1024 * 1024)); assert.throws(() => request(next), /capacity/);
  });
  process.stdout.write(`${passed} focused safety checks passed; real-PR acceptance remains separate\n`);
})().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
