#!/usr/bin/env node
// Exercise the installed local pathway; no host model or network is dispatched.
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const path = require('path');
const { spawnSync } = require('child_process');
const { RUNTIME_HELPERS, manifestEntry } = require('./install-manifest');
const root = path.resolve(__dirname, '../..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'review-evidence-hosts-'));
function run(cmd, args, cwd, expected = 0) {
  const result = spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, expected, `${cmd} ${args.join(' ')}: ${result.error || result.stderr || result.stdout}`);
  return result.stdout;
}
for (const target of ['claude', 'codex']) {
  const home = path.join(work, target, 'home');
  const project = path.join(work, target, 'project');
  fs.mkdirSync(project, { recursive: true });
  for (const source of RUNTIME_HELPERS) {
    const entry = manifestEntry(source, home, target);
    if (!entry || entry.preserve) continue;
    fs.mkdirSync(path.dirname(entry.destination), { recursive: true });
    fs.copyFileSync(path.join(root, source), entry.destination);
    if (entry.executable) fs.chmodSync(entry.destination, 0o755);
  }
  const helper = path.join(home, 'forgeflow/scripts/forgeflow');
  const cli = (name, args, expected = 0) => run(process.execPath, [path.join(helper, name), ...args], project, expected);
  run('git', ['init', '-q'], project);
  run('git', ['config', 'user.name', 'Local Test'], project);
  run('git', ['config', 'user.email', 'test@example.invalid'], project);
  fs.writeFileSync(path.join(project, '.gitignore'), '.forgeflow/\n');
  fs.writeFileSync(path.join(project, 'source.js'), 'module.exports = 1;\n');
  run('git', ['add', '.gitignore', 'source.js'], project);
  run('git', ['commit', '-qm', 'initial'], project);
  fs.writeFileSync(path.join(project, 'source.js'), 'module.exports = 2;\n');
  const maintainedPath = target === 'claude' ? 'commands/review.md' : '.agents/skills/forgeflow-review/SKILL.md';
  const maintained = fs.readFileSync(path.join(root, maintainedPath), 'utf8');
  const blocks = [...maintained.matchAll(/```bash\n([\s\S]*?)```/g)].map(match => match[1]);
  const buildBlock = blocks.find(block => block.includes('CONTEXT_BUILD_JSON=$('));
  assert.ok(buildBlock && buildBlock.includes('render-review-wave-prep.js'), `${maintainedPath} executable preparation block`);
  const activeBlock = blocks.find(block => block.includes('ACTIVE_REVIEW_PACKET_DIR=$(')) || '';
  const fileList = path.join(project, '.forgeflow', 'files.txt');
  fs.mkdirSync(path.dirname(fileList), { recursive: true });
  fs.writeFileSync(fileList, 'source.js\n');
  const assignmentsInput = path.join(project, '.forgeflow', 'assignments.json');
  const sourceId = `source-${crypto.createHash('sha256').update('source.js').digest('hex')}`;
  const requiredReviewers = ['builder_reviewer', 'guardian_reviewer', 'designer_reviewer', 'coordinator_reviewer'];
  const assignments = requiredReviewers.map((reviewer, i) => ({ assignment_id: `scope-${i}`, reviewer,
    question: 'Does the source.js exported value remain a number for its existing consumers?',
    artifact_ids: [sourceId, 'git-diff-full'], expected_evidence: ['Exact exported source and full change diff.'] }));
  fs.writeFileSync(assignmentsInput, JSON.stringify({ schema_version: '1', assignments }));
  const savedBuild = path.join(work, target, 'actual-build.json');
  const savedPinned = path.join(work, target, 'actual-ref.json');
  const shell = [
    'set -e',
    `HELPER_DIR=${JSON.stringify(helper)}`,
    `FORGEFLOW_HELPER_DIR=${JSON.stringify(helper)}`,
    `PROJECT_ROOT=${JSON.stringify(project)}`,
    `FORGEFLOW_DIR=${JSON.stringify(path.join(project, '.forgeflow', path.basename(project)))}`,
    `REVIEW_FILES_UNIQUE=${JSON.stringify(fileList)}`,
    `REVIEW_ASSIGNMENTS_INPUT=${JSON.stringify(assignmentsInput)}`,
    'ROUTING_MODE=full-mode; REVIEW_MODE=full',
    'SAFE_ARGUMENTS="local evidence validation"',
    'LINES_CHANGED=2; TRACKED_LINES_CHANGED=2; UNTRACKED_LINES_CHANGED=0; ROUTE_ARGS=(--mode full); CI_MODE=false',
    buildBlock,
    'REVIEW_PACKET_INDEX=0',
    activeBlock,
    `printf '%s' "$CONTEXT_BUILD_JSON" > ${JSON.stringify(savedBuild)}`,
    `cp "$CONTEXT_EVIDENCE_REF" ${JSON.stringify(savedPinned)}`,
  ].join('\n');
  const shellFile = path.join(work, target, 'maintained-preparation.sh');
  fs.writeFileSync(shellFile, shell);
  run('bash', [shellFile], project);
  const first = JSON.parse(fs.readFileSync(savedBuild, 'utf8'));
  assert.deepEqual(JSON.parse(fs.readFileSync(savedPinned, 'utf8')), first.evidence_ref);
  assert.ok(first.review_ready && first.receipt_path && first.run_dir && first.evidence_ref.manifest_sha256);
  assert.equal(first.packets.length, 1);
  assert.equal(first.focused_questions, 'enabled');
  assert.deepEqual(first.required_reviewers, requiredReviewers);
  assert.deepEqual(first.review_assignments, assignments);
  const savedRef = path.join(work, target, 'pinned-reference.json');
  fs.writeFileSync(savedRef, JSON.stringify(first.evidence_ref));
  const refArgs = ['--root', project, '--ref', savedRef];
  cli('review-evidence-cli.js', ['inspect', ...refArgs, '--require-current']);
  cli('check-context-budget.js', ['--root', project, '--file', path.join(first.run_dir, 'context-telemetry.json'), '--warn-only', '--json']);
  const manifestBefore = fs.readFileSync(first.evidence_ref.manifest_path);
  const manifest = JSON.parse(manifestBefore);
  const artifact = manifest.artifacts.find((item) => item.kind === 'source') || manifest.artifacts[0];
  assert.ok(artifact);
  cli('review-evidence-cli.js', ['retrieve', ...refArgs, '--artifact', artifact.id, '--raw-required']);
  const resultPath = path.join(project, '.forgeflow', 'actual-result.txt');
  const decisionPath = path.join(project, '.forgeflow', 'actual-decision.txt');
  fs.writeFileSync(resultPath, 'Observed source bytes in the selected retained artifact.\n');
  fs.writeFileSync(decisionPath, 'Local test decision only; no model review performed.\n');
  const sidecar = JSON.parse(cli('review-evidence-cli.js', ['record', ...refArgs, '--id', 'local-consumption', '--kind', 'review', '--result', resultPath, '--decision', decisionPath, '--artifacts', artifact.id]));
  assert.ok(sidecar);
  assert.deepEqual(fs.readFileSync(first.evidence_ref.manifest_path), manifestBefore, 'consumption cannot mutate seal');
  const next = JSON.parse(cli('build-context-pack.js', ['--root', project, '--mode', 'full', '--no-memory-index', '--json']));
  assert.notEqual(next.run_dir, first.run_dir);
  cli('review-evidence-cli.js', ['inspect', ...refArgs, '--require-current']);
  assert.deepEqual(fs.readFileSync(first.evidence_ref.manifest_path), manifestBefore, 'rebuild cannot mutate selected identity');
  // Execute the maintained E3 session snippets on both disposable installed runtimes.
  // These retained local fixture responses exercise connectivity, not model quality or PR acceptance.
  const sessionInput = path.join(project, '.forgeflow', 'session-input.json');
  fs.writeFileSync(sessionInput, JSON.stringify({ schema_version: '1', evidence_ref: first.evidence_ref,
    required_reviewers: requiredReviewers, assignments, limits: {} }));
  const sessionSaved = path.join(project, '.forgeflow', 'pinned-session.json');
  function sessionBlock(operation, vars = {}, suffix = '') {
    const selectedBlock = blocks.find(value => value.includes(`review-questions-cli.js" ${operation} --root`));
    const block = operation === 'inspect' ? selectedBlock?.split('\n').find(line => line.startsWith('node ') && line.includes('review-questions-cli.js" inspect')) : selectedBlock;
    assert.ok(block, `${maintainedPath}: executable ${operation}`);
    const shellFile = path.join(work, target, `maintained-${operation}.sh`);
    const text = ['set -e', `FORGEFLOW_HELPER_DIR=${JSON.stringify(helper)}`, `PROJECT_ROOT=${JSON.stringify(project)}`,
      `REVIEW_SESSION_REF=${JSON.stringify(sessionSaved)}`,
      ...Object.entries(vars).map(([key, value]) => `${key}=${JSON.stringify(value)}`), block, suffix].join('\n');
    fs.writeFileSync(shellFile, text);
    return run('bash', [shellFile], project);
  }
  sessionBlock('start', { REVIEW_SESSION_INPUT: sessionInput }, `cp "$REVIEW_SESSION_REF" ${JSON.stringify(sessionSaved)}`);
  const sessionRef = JSON.parse(fs.readFileSync(sessionSaved, 'utf8'));
  assert.deepEqual(sessionRef.evidence_ref, first.evidence_ref);
  const initialSession = JSON.parse(sessionBlock('inspect'));
  assert.deepEqual(initialSession.contract.required_reviewers, requiredReviewers);
  const requestInput = path.join(project, '.forgeflow', 'request-input.json');
  fs.writeFileSync(requestInput, JSON.stringify({ schema_version: '1', request_id: 'source-proof', assignment_id: assignments[0].assignment_id,
    reviewer: requiredReviewers[0], artifact_id: sourceId, extent: { mode: 'full' }, why_decisive: 'The exact export resolves the consumer type question.' }));
  const resolution = JSON.parse(sessionBlock('request', { REVIEW_REQUEST_INPUT: requestInput }));
  assert.equal(resolution.request_status, 'fulfilled');
  assert.equal(resolution.delivery.content, 'module.exports = 2;\n');
  const challengeInput = path.join(project, '.forgeflow', 'challenge-input.json');
  fs.writeFileSync(challengeInput, JSON.stringify({ schema_version: '1', challenge_id: 'export-alternatives', assignment_id: assignments[0].assignment_id,
    question: 'Which runtime values can the changed source export, and which observation distinguishes them?',
    original_contract: 'Change the exported numeric constant while preserving the existing CommonJS consumer interface.',
    artifact_ids: [sourceId, 'git-diff-full'], user_constraints: ['Preserve the original source scope.'] }));
  const prepared = JSON.parse(sessionBlock('challenge', { REVIEW_CHALLENGE_INPUT: challengeInput }));
  assert.equal(prepared.challenge.challenge_id, 'export-alternatives');
  const responseInput = path.join(project, '.forgeflow', 'response-input.json');
  function retain(kind, subjectId, index) {
    const resultRelative = `.forgeflow/response-${index}.txt`, decisionRelative = `.forgeflow/decision-${index}.txt`;
    fs.writeFileSync(path.join(project, resultRelative), 'Local CLI fixture observed the numeric source export; no host model was dispatched.\n');
    fs.writeFileSync(path.join(project, decisionRelative), 'Local fixture decision retained for integration safety only.\n');
    fs.writeFileSync(responseInput, JSON.stringify({ schema_version: '1', response_id: `response-${index}`, kind,
      subject_id: subjectId, result_path: resultRelative, decision_path: decisionRelative, artifact_ids: [sourceId] }));
    sessionBlock('response', { REVIEW_RESPONSE_INPUT: responseInput });
  }
  assignments.forEach((assignment, index) => retain('reviewer', assignment.assignment_id, index));
  retain('challenge', 'export-alternatives', 'challenge');
  const synthesis = JSON.parse(sessionBlock('synthesis'));
  assert.deepEqual(synthesis.required_reviewers, requiredReviewers);
  assert.equal(synthesis.responses.length, 5);
  assert.equal(synthesis.coverage, 'retained');
  assert.deepEqual(synthesis.unresolved, []);
  assert.equal(synthesis.claim_truth, 'not_assessed');
  fs.writeFileSync(path.join(project, 'source.js'), 'module.exports = 3;\n');
  cli('review-evidence-cli.js', ['inspect', ...refArgs, '--require-current'], 1);
  cli('review-questions-cli.js', ['synthesis', '--root', project, '--session', sessionSaved, '--json'], 1);
}
// Verify the maintained entry points use selected telemetry and fail-fast pinning.
for (const file of ['commands/review.md', '.agents/skills/forgeflow-review/SKILL.md']) {
  const body = fs.readFileSync(path.join(root, file), 'utf8');
  assert.ok(body.includes('CONTEXT_BUILD_JSON=$('));
  assert.ok(body.includes('r.run_dir') && body.includes('r.evidence_ref?.manifest_sha256'));
  assert.ok(body.includes('r.review_ready') && body.includes('render-review-wave-prep.js') && body.includes('--prepare --prep-id'));
  assert.ok(body.includes('packets') && body.includes('parent') && body.includes('pending'));
  assert.ok(body.includes('--result <saved-actual-result-path>') && body.includes('--decision <saved-actual-decision-path>'));
  assert.ok(!body.includes('LEAN_REVIEW_MD="${CONTEXT_PACK_DIR}/lean-review.md"'));
}
console.log('review evidence installed hosts: ok (local CLI only; no live host/model qualification)');
