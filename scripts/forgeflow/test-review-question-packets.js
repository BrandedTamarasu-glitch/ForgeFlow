#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildContextPack, sourceArtifactId, jsonSummary } = require('./build-context-pack');
const { inspectRun } = require('./review-evidence');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'review-question-packets-'));
const priorHome = process.env.FORGEFLOW_CONFIG_HOME;
process.env.FORGEFLOW_CONFIG_HOME = path.join(root, '.forgeflow', 'config');
function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.error?.message || result.stderr);
}
try {
  git(['init']);
  git(['config', 'user.name', 'Local Validation']);
  git(['config', 'user.email', 'validation@example.invalid']);
  fs.writeFileSync(path.join(root, 'acceptance.js'), 'module.exports = phase => phase === "final";\n');
  git(['add', 'acceptance.js']);
  git(['commit', '-m', 'Original contract']);
  fs.writeFileSync(path.join(root, 'acceptance.js'), 'module.exports = phase => ["pre", "final"].includes(phase);\n');
  const inputs = path.join(root, '.forgeflow', 'inputs');
  fs.mkdirSync(inputs, { recursive: true });
  const filesPath = path.join(inputs, 'files.txt');
  fs.writeFileSync(filesPath, 'acceptance.js\n');
  const opts = { root, filesPath, modeOverride: 'full', task: 'Preserve phase obligations', maxDiffChars: 18000, maxMemoryChars: 8000 };
  const legacy = buildContextPack(opts);
  assert.strictEqual(legacy.synthesis_input.focused_questions, 'not_enabled');
  const artifactId = sourceArtifactId(root, path.join(root, 'acceptance.js'));
  assert(legacy.synthesis_input.authorized_evidence_artifacts.some(item => item.id === artifactId && item.source_path === 'acceptance.js'));
  const assignments = legacy.synthesis_input.required_reviewers.map((reviewer, index) => ({
    assignment_id: `phase-${index + 1}`, reviewer,
    question: `Does acceptance.js preserve pre-integration obligations when phase becomes final for review lane ${index + 1}?`,
    artifact_ids: [artifactId, 'git-diff-full'], expected_evidence: ['Full acceptance.js predicate and caller-phase contract.'],
  }));
  const reviewAssignmentsPath = path.join(inputs, 'assignments.json');
  function writeAssignments(value) { fs.writeFileSync(reviewAssignmentsPath, JSON.stringify(value)); }
  writeAssignments({ schema_version: '1', assignments });
  const enabled = buildContextPack({ ...opts, reviewAssignmentsPath });
  assert.strictEqual(enabled.synthesis_input.focused_questions, 'enabled');
  assert.deepStrictEqual(enabled.synthesis_input.review_assignments, assignments);
  assert.deepStrictEqual(enabled.route.agents, legacy.route.agents);
  assert.deepStrictEqual(jsonSummary(enabled).review_assignments, assignments);
  const inspection = inspectRun({ root, ref: enabled.evidence_ref });
  assert.strictEqual(inspection.source, 'current');
  assert(inspection.artifacts.some(item => item.kind === 'options' && item.provenance.source_path === reviewAssignmentsPath));
  assert(inspection.artifacts.some(item => item.id === artifactId && item.kind === 'source'));
  for (const assignment of assignments) {
    const packet = fs.readFileSync(path.join(root, enabled.synthesis_input.agent_packets[assignment.reviewer]), 'utf8');
    assert(packet.includes(assignment.question));
    assert(packet.includes(artifactId));
    assert(packet.includes('why_decisive'));
    assert(packet.includes('Preserve all ordinary domain responsibilities'));
    assert(packet.includes('## Local Rule Pack'));
    assert(packet.includes('## Output Contract'));
  }
  const audit = { ...assignments[1], assignment_id: 'phase-audit', reviewer: 'guardian_auditor' };
  writeAssignments({ schema_version: '1', assignments: [...assignments, audit] });
  const deep = buildContextPack({ ...opts, modeOverride: 'deep', reviewAssignmentsPath });
  assert(deep.synthesis_input.required_reviewers.includes('guardian_auditor'));
  assert(deep.route.agents.included.includes('guardian_auditor'));
  assert(fs.readFileSync(path.join(root, deep.synthesis_input.agent_packets.guardian_auditor), 'utf8').includes(audit.question));
  writeAssignments({ schema_version: '1', assignments });
  assert.throws(() => buildContextPack({ ...opts, modeOverride: 'deep', reviewAssignmentsPath }), /Incomplete required reviewer/);
  for (const value of [
    { schema_version: '1', assignments, command: 'read live' },
    { schema_version: '2', assignments },
    { schema_version: '1', assignments: assignments.slice(1) },
    { schema_version: '1', assignments: [...assignments, assignments[0]] },
    { schema_version: '1', assignments: assignments.map((item, index) => index ? item : { ...item, artifact_ids: ['input-999'] }) },
    { schema_version: '1', assignments: assignments.map((item, index) => index ? item : { ...item, question: '' }) },
  ]) {
    writeAssignments(value);
    assert.throws(() => buildContextPack({ ...opts, reviewAssignmentsPath }));
  }
  writeAssignments({ schema_version: '1', assignments: [] });
  assert.throws(() => buildContextPack({ ...opts, modeOverride: 'skip', reviewAssignmentsPath }), /Skip route/);
  fs.writeFileSync(reviewAssignmentsPath, ' '.repeat(64 * 1024 + 1));
  assert.throws(() => buildContextPack({ ...opts, reviewAssignmentsPath }));
  const cli = spawnSync(process.execPath, [path.join(__dirname, 'build-context-pack.js'), '--review-assignments'], { encoding: 'utf8' });
  assert.notStrictEqual(cli.status, 0);
  assert(cli.stderr.includes('--review-assignments requires a JSON file'));
  console.log('ok focused review packets: legacy coverage, stable IDs, exact assignments, sealed inputs and strict rejection');
} finally {
  if (priorHome === undefined) delete process.env.FORGEFLOW_CONFIG_HOME;
  else process.env.FORGEFLOW_CONFIG_HOME = priorHome;
  fs.rmSync(root, { recursive: true, force: true });
}
