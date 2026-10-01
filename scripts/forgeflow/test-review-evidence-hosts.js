#!/usr/bin/env node
// Exercise the installed local pathway; no host model or network is dispatched.
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
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
  const budgetBlock = blocks.find(block => block.includes('check-context-budget.js') && block.includes('CONTEXT_PACK_DIR'));
  assert.ok(buildBlock && budgetBlock, `${maintainedPath} executable preparation blocks`);
  const fileList = path.join(project, '.forgeflow', 'files.txt');
  fs.mkdirSync(path.dirname(fileList), { recursive: true });
  fs.writeFileSync(fileList, 'source.js\n');
  const savedBuild = path.join(work, target, 'actual-build.json');
  const savedPinned = path.join(work, target, 'actual-ref.json');
  const shell = [
    'set -e',
    `HELPER_DIR=${JSON.stringify(helper)}`,
    `FORGEFLOW_HELPER_DIR=${JSON.stringify(helper)}`,
    `PROJECT_ROOT=${JSON.stringify(project)}`,
    `FORGEFLOW_DIR=${JSON.stringify(path.join(project, '.forgeflow', path.basename(project)))}`,
    `REVIEW_FILES_UNIQUE=${JSON.stringify(fileList)}`,
    'SAFE_ARGUMENTS="local evidence validation"',
    'LINES_CHANGED=2; TRACKED_LINES_CHANGED=2; UNTRACKED_LINES_CHANGED=0; ROUTE_ARGS=(--mode full); CI_MODE=false',
    buildBlock,
    budgetBlock,
    `printf '%s' "$CONTEXT_BUILD_JSON" > ${JSON.stringify(savedBuild)}`,
    `cp "$CONTEXT_EVIDENCE_REF" ${JSON.stringify(savedPinned)}`,
    'rm "$CONTEXT_EVIDENCE_REF"',
  ].join('\n');
  const shellFile = path.join(work, target, 'maintained-preparation.sh');
  fs.writeFileSync(shellFile, shell);
  run('bash', [shellFile], project);
  const first = JSON.parse(fs.readFileSync(savedBuild, 'utf8'));
  assert.deepEqual(JSON.parse(fs.readFileSync(savedPinned, 'utf8')), first.evidence_ref);
  assert.ok(first.run_dir && first.evidence_ref.manifest_sha256);
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
  fs.writeFileSync(path.join(project, 'source.js'), 'module.exports = 3;\n');
  cli('review-evidence-cli.js', ['inspect', ...refArgs, '--require-current'], 1);
}
// Verify the maintained entry points use selected telemetry and fail-fast pinning.
for (const file of ['commands/review.md', '.agents/skills/forgeflow-review/SKILL.md']) {
  const body = fs.readFileSync(path.join(root, file), 'utf8');
  assert.ok(body.includes('CONTEXT_BUILD_JSON=$('));
  assert.ok(body.includes('r.run_dir') && body.includes('r.evidence_ref?.manifest_sha256'));
  assert.ok(body.includes('--require-current || exit 1'));
  assert.ok(body.includes('--file "${CONTEXT_PACK_DIR}/context-telemetry.json"') || body.includes('--file "$CONTEXT_PACK_DIR/context-telemetry.json"'));
  assert.ok(body.includes('--result <saved-actual-result-path>') && body.includes('--decision <saved-actual-decision-path>'));
  assert.ok(!body.includes('LEAN_REVIEW_MD="${CONTEXT_PACK_DIR}/lean-review.md"'));
}
console.log('review evidence installed hosts: ok (local CLI only; no live host/model qualification)');
