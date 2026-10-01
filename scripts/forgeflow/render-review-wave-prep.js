#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { createHash } = require('crypto');
const { buildContextWavePlan } = require('./render-context-wave-plan');
const { buildContextWave } = require('./build-context-wave');
const { buildContextPack, jsonSummary } = require('./build-context-pack');
const { buildScopeManifest, deniedPath } = require('./build-scope-manifest');
const { inspectRun } = require('./review-evidence');
const store = require('./task-store');
const { assertSafeDirectory, safeReadTextFile, isPathInside } = require('./file-safety');
const { checkBudget, applyConfig } = require('./check-context-budget');

function usage() {
  console.error('Usage: render-review-wave-prep.js [--root <repo>] [--context-dir <dir>] [--target-tokens <n>] [--write-wave-files] [--json]');
  console.error('       --prepare --prep-id <id> --files <list> [--mode thin|full|deep] [--review-assignments <json>]');
  console.error('       [--lines <n>] [--tracked-lines <n>] [--untracked-lines <n>] [--task <text>] [--max-waves <1..16>]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), contextDir: '', targetTokens: 16000, writeWaveFiles: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--prepare') {
      opts.prepare = true;
    } else if (['--prep-id', '--files', '--mode', '--review-assignments', '--task', '--lines', '--tracked-lines', '--untracked-lines', '--max-waves'].includes(arg)) {
      const names = { '--prep-id': 'prepId', '--files': 'filesPath', '--mode': 'modeOverride', '--review-assignments': 'reviewAssignmentsPath', '--task': 'task', '--lines': 'linesChanged', '--tracked-lines': 'trackedLines', '--untracked-lines': 'untrackedLines', '--max-waves': 'maxWaves' };
      const value = requireValue(argv, arg, i++);
      opts[names[arg]] = ['--lines', '--tracked-lines', '--untracked-lines', '--max-waves'].includes(arg) ? Number(value) : value;
    } else if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--context-dir') {
      opts.contextDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--evidence-ref') {
      opts.evidenceRef = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--wave-dir') {
      opts.waveDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--target-tokens') {
      opts.targetTokensInput = requireValue(argv, arg, i);
      opts.targetTokens = Math.max(1000, Number.parseInt(requireValue(argv, arg, i), 10) || 16000);
      i += 1;
    } else if (arg === '--write-wave-files') {
      opts.writeWaveFiles = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (opts.prepare && opts.targetTokensInput !== undefined) opts.targetTokens = Number(opts.targetTokensInput);
  return opts;
}

function buildReviewWavePrep(opts = {}) {
  const wavePlan = buildContextWavePlan(opts);
  const firstWave = wavePlan.waves[0] || null;
  const splitRecommended = wavePlan.status === 'split-recommended' && wavePlan.waves.length > 1;
  const incomplete = wavePlan.status === 'incomplete';
  const needsNarrowerScope = wavePlan.status === 'needs-narrower-scope';
  const followThrough = incomplete
    ? {
      status: 'rebuild-context-pack',
      next_command: 'node scripts/forgeflow/build-context-pack.js --json',
      review_ready: false,
      stop_rule: 'Do not spawn reviewers until the context pack has files, telemetry, and synthesis input.',
      reason: `The latest context pack is incomplete: ${(wavePlan.incomplete_reasons || []).join('; ')}.`,
    }
    : (needsNarrowerScope
      ? {
        status: 'manual-scope-needed',
        next_command: 'Narrow the oversized file or provide a smaller file list, then rerun /forgeflow-review-wave-prep.',
        review_ready: false,
        stop_rule: 'Do not build or spawn reviewers for a wave that cannot fit the target on its own.',
        reason: 'At least one planned wave needs narrower scope before it can be safely built.',
      }
      : (splitRecommended && firstWave
      ? {
        status: firstWave.wave_file ? 'build-and-verify-first-wave' : 'wave-files-needed',
        next_command: firstWave.wave_file ? firstWave.command : '/forgeflow-review-wave-prep --write-wave-files',
        review_ready: false,
        stop_rule: 'Build and verify the first bounded wave before review; do not trim raw-required proof files.',
        reason: firstWave.wave_file
          ? `First review wave ${firstWave.name} has a file list but still needs a measured budget check.`
          : `First review wave ${firstWave.name} is planned, but wave files have not been written yet.`,
      }
      : {
        status: 'current-packet-ok',
        next_command: '/review',
        review_ready: true,
        stop_rule: 'Use the current context pack unless a later budget check moves it over target.',
        reason: 'Context is within budget or too small to split.',
      }));
  return {
    schema_version: '1',
    status: incomplete ? 'context-incomplete' : (needsNarrowerScope ? 'manual-scope-needed' : (splitRecommended ? 'split-before-review' : 'current-packet-ok')),
    root: wavePlan.root,
    context_dir: wavePlan.context_dir,
    evidence_ref: wavePlan.evidence_ref,
    source_status: wavePlan.source_status,
    current_compact_tokens: wavePlan.current_compact_tokens,
    target_compact_tokens: wavePlan.target_compact_tokens,
    over_by_tokens: wavePlan.over_by_tokens,
    wave_files_written: wavePlan.wave_files_written,
    incomplete_reasons: wavePlan.incomplete_reasons || [],
    first_wave: firstWave,
    waves: wavePlan.waves,
    next: incomplete
      ? 'Rebuild the context pack before review.'
      : (needsNarrowerScope
      ? 'Narrow the oversized file before review.'
      : (splitRecommended && firstWave
      ? firstWave.command
      : 'Use the current context pack for review.')),
    next_reason: incomplete
      ? `The latest context pack is incomplete: ${(wavePlan.incomplete_reasons || []).join('; ')}.`
      : (needsNarrowerScope
      ? 'A planned wave cannot fit the target on its own.'
      : (splitRecommended
      ? 'Context is over budget; start review with the first generated or planned wave.'
      : 'Context is within budget or too small to split.')),
    follow_through: followThrough,
    boundary: 'Review wave prep is advisory. It does not rebuild packets, spawn reviewers, edit source files, commit, or push.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Review Wave Prep',
    '',
    `Status: ${result.status}`,
    `Current compact tokens: ${result.current_compact_tokens}`,
    `Target compact tokens: ${result.target_compact_tokens}`,
    `Over by: ${result.over_by_tokens}`,
    '',
    result.boundary,
    '',
    '## First Wave',
    '',
  ];
  if (!result.first_wave) {
    lines.push('- None.');
  } else {
    lines.push(`- ${result.first_wave.name}: ${result.first_wave.files.length} file(s)`);
    if (result.first_wave.wave_file) lines.push(`  - File list: ${result.first_wave.wave_file}`);
    lines.push(`  - Command: ${result.first_wave.command}`);
  }
  lines.push('', `Next: ${result.next}`, `Why: ${result.next_reason}`, '');
  if (result.follow_through) {
    lines.push('## Follow Through', '');
    lines.push(`- Status: ${result.follow_through.status}`);
    lines.push(`- Next command: ${result.follow_through.next_command}`);
    lines.push(`- Review ready: ${result.follow_through.review_ready ? 'yes' : 'no'}`);
    lines.push(`- Stop rule: ${result.follow_through.stop_rule}`);
    lines.push('');
  }
  return lines.join('\n');
}

// Preparation is a fixed local pipeline. A task action claims each mutation before
// it starts; an interrupted/unknown action is inspected, never automatically retried.
function prepareReview(opts = {}) {
  let root, taskId, directory, currentStep = 'inputs';
  const result = { schema_version: '1', status: 'blocked', review_ready: false, packets: [], waves: [],
    boundary: 'Preparation only; no reviewer dispatch or review approval. Follow-up budgets belong to the parent evidence session.' };
  const block = (code, message) => ({ ...result, blocker: { step: currentStep, code, message } });
  try {
    root = store.assertWorkspace(path.resolve(opts.root || process.cwd()));
    const prepId = opts.prepId;
    if (typeof prepId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(prepId)) return block('invalid-prep-id', 'Provide a stable preparation id of 1 to 80 safe characters.');
    taskId = `review-prep-${prepId}`;
    directory = path.join(root, '.forgeflow', path.basename(root), 'review-preparations', prepId);
    result.task_id = taskId;
    result.receipt_path = path.join(directory, 'receipt.json');
    const hash = bytes => createHash('sha256').update(bytes).digest('hex');
    const read = (file, maximum = 128 * 1024) => {
      assertSafeDirectory(path.dirname(file));
      if (fs.lstatSync(file).size > maximum) throw new Error('Preparation input exceeds its byte limit');
      return safeReadTextFile(file, path.dirname(file)).content;
    };
    const filesPath = path.resolve(root, opts.filesPath || '');
    if (!opts.filesPath) return block('files-required', 'An explicit review file list is required.');
    const fileBytes = read(filesPath);
    const files = [...new Set(fileBytes.split(/\r?\n/).map(x => x.trim()).filter(Boolean))];
    if (!files.length || files.length > 500) return block('invalid-scope', 'Review scope must contain 1 to 500 files.');
    for (const file of files) {
      store.relativeFile(file);
      if (deniedPath(file)) return block('denied-scope', 'Review scope includes a denied source path; narrow explicitly.');
    }
    const mode = opts.modeOverride || 'full';
    if (!['thin', 'full', 'deep'].includes(mode)) return block('invalid-mode', 'Review mode must be thin, full or deep.');
    const maxWaves = opts.maxWaves ?? 8;
    if (!Number.isSafeInteger(maxWaves) || maxWaves < 1 || maxWaves > 16) return block('invalid-wave-limit', 'Maximum waves must be an integer from 1 to 16.');
    const target = opts.targetTokens ?? 16000;
    if (!Number.isSafeInteger(target) || target < 1000 || target > 1000000) return block('invalid-budget', 'Target tokens must be an integer from 1000 to 1000000.');
    for (const key of ['linesChanged', 'trackedLines', 'untrackedLines']) {
      if (opts[key] !== undefined && (!Number.isSafeInteger(opts[key]) || opts[key] < 0)) return block('invalid-line-count', 'Line counts must be nonnegative integers.');
    }
    if (opts.task && (typeof opts.task !== 'string' || opts.task.length > 2000)) return block('invalid-task', 'Task text exceeds its limit.');
    const assignmentBytes = opts.reviewAssignmentsPath ? read(path.resolve(root, opts.reviewAssignmentsPath), 64 * 1024) : null;
    const configFile = path.join(root, '.forgeflow-budget.json');
    const configBytes = fs.existsSync(configFile) ? read(configFile, 64 * 1024) : null;
    const config = configBytes === null ? {} : JSON.parse(configBytes);
    if (!config || Array.isArray(config) || typeof config !== 'object') return block('invalid-config', 'Budget configuration must be an object.');
    // Project limits can tighten but never relax the requested preparation target.
    const budgetOpts = applyConfig({ maxCompactTokens: target, maxCompactTokensSet: true, kindLimits: {}, warnOnly: false, warnOnlySet: true }, config);
    budgetOpts.maxCompactTokens = Math.min(target, Number(config.max_compact_tokens) > 0 ? Number(config.max_compact_tokens) : target);
    for (const kind of Object.keys(budgetOpts.kindLimits)) budgetOpts.kindLimits[kind] = Math.min(target, budgetOpts.kindLimits[kind]);
    const engineHash = hash(['render-review-wave-prep.js', 'build-context-wave.js', 'build-context-pack.js', 'render-context-wave-plan.js', 'build-scope-manifest.js', 'check-context-budget.js'].map(name => read(path.join(__dirname, name), 1024 * 1024)).join('\n'));
    const inputs = { files: hash(fileBytes), assignments: assignmentBytes === null ? null : hash(assignmentBytes), config: configBytes === null ? null : hash(configBytes), mode,
      target, maxWaves, task: opts.task || '', lines: opts.linesChanged ?? null, tracked: opts.trackedLines ?? null, untracked: opts.untrackedLines ?? null, engine: engineHash };
    const inputHash = hash(JSON.stringify(inputs));
    const source = store.sourceSnapshot(root);
    const cancelled = () => opts.signal?.aborted === true;
    const taskFile = path.join(store.taskDirectory(root), `${taskId}.json`);
    let task;
    if (fs.existsSync(taskFile)) {
      task = store.readTask(root, taskId);
      if (!store.sameSource(task.workspace, source)) return block('source-changed', 'Source changed; use a new preparation id.');
      if (task.actions.some(a => ['pending', 'unknown'].includes(a.status))) return block('unreconciled-action', 'Inspect and explicitly reconcile pending or unknown task actions before continuing.');
      const identity = task.actions.find(a => a.id === 'identity');
      if (!identity || identity.status !== 'confirmed' || identity.evidence !== inputHash) return block('inputs-changed', 'Preparation inputs changed or identity is incomplete; inspect the task and use a new id.');
    } else {
      if (cancelled()) return block('cancelled', 'Preparation cancelled before creating work.');
      // Atomic create establishes the owner. A racing caller cannot claim identity.
      task = store.createTask(root, { id: taskId, objective: 'Prepare pinned review packets without model dispatch', criteria: [{ id: 'prepared', description: 'Pinned preparation is verified before dispatch' }], phases: ['prepare'] });
      store.recordAction(root, taskId, { event_id: 'claim-identity', action_id: 'identity', status: 'pending', exclusive: true, description: 'Capture immutable preparation input identity' });
      assertSafeDirectory(directory); fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      store.atomicWrite(path.join(directory, 'inputs.json'), { input_hash: inputHash, inputs, source });
      store.recordAction(root, taskId, { event_id: 'finish-identity', action_id: 'identity', status: 'confirmed', description: 'Capture immutable preparation input identity', evidence: inputHash });
    }
    const validArtifact = artifact => store.inspectArtifact(root, artifact) === 'current';
    const step = (name, operation) => {
      currentStep = name;
      if (cancelled()) throw Object.assign(new Error('Preparation cancelled; completed steps retained.'), { code: 'cancelled' });
      task = store.readTask(root, taskId);
      if (task.actions.some(a => ['pending', 'unknown'].includes(a.status))) throw Object.assign(new Error('Another writer or interrupted action requires reconciliation.'), { code: 'unreconciled-action' });
      const prior = task.actions.find(a => a.id === name);
      const output = path.join(directory, `step-${name}.json`);
      if (prior) {
        if (prior.status !== 'confirmed') throw Object.assign(new Error('Reconciled nonperformed step requires a new preparation id; automatic retry is disabled.'), { code: 'new-prep-id-required' });
        const artifact = store.captureArtifact(root, path.relative(root, output));
        if (artifact.sha256 !== prior.evidence) throw Object.assign(new Error('Saved step result changed.'), { code: 'artifacts-changed' });
        const saved = JSON.parse(read(output, 16 * 1024 * 1024));
        if (!saved.artifacts.every(validArtifact)) throw Object.assign(new Error('Saved preparation artifact changed.'), { code: 'artifacts-changed' });
        return saved.result;
      }
      store.recordAction(root, taskId, { event_id: `claim-${name}`, action_id: name, status: 'pending', description: `Prepare ${name}`, exclusive: true });
      // Keep pending on exceptions: writes may have occurred and must be inspected.
      const completed = operation();
      const artifacts = (completed.artifactPaths || []).map(file => store.captureArtifact(root, path.relative(root, file)));
      store.atomicWrite(output, { result: completed.result, artifacts });
      const proof = store.captureArtifact(root, path.relative(root, output));
      store.recordAction(root, taskId, { event_id: `finish-${name}`, action_id: name, status: 'confirmed', description: `Prepare ${name}`, evidence: proof.sha256 });
      return completed.result;
    };
    const captured = step('capture-inputs', () => {
      const fileList = path.join(directory, 'files.txt');
      // task-store atomic writes are JSON; use safe existing writer for text lists.
      const { writeFileSafe } = require('./file-safety');
      writeFileSafe(fileList, fileBytes, { mode: 0o600 });
      const assignments = assignmentBytes === null ? null : path.join(directory, 'assignments.json');
      if (assignments) writeFileSafe(assignments, assignmentBytes, { mode: 0o600 });
      return { result: { filesPath: fileList, reviewAssignmentsPath: assignments }, artifactPaths: [fileList, assignments].filter(Boolean) };
    });
    const scope = step('scope', () => {
      const built = buildScopeManifest({ root, filesPath: captured.filesPath, query: opts.task || '', maxFilesPerLane: 500,
        out: path.join(directory, 'scope-manifest.json'), packetDir: path.join(directory, 'scope-packets'), telemetryOut: path.join(directory, 'scope-telemetry.json') });
      return { result: { path: built.out, denied: built.manifest.denied, omitted_counts: built.manifest.omitted_counts }, artifactPaths: [built.out, built.telemetry_path, ...Object.values(built.packets)] };
    });
    result.scope_manifest = scope.path;
    if (scope.denied.length || Object.values(scope.omitted_counts).some(Boolean)) return block('scope-incomplete', 'Scope helper denied or omitted required files.');
    const parent = step('context', () => {
      const pack = buildContextPack({ root, ...captured, modeOverride: mode, linesChanged: opts.linesChanged, trackedLines: opts.trackedLines,
        untrackedLines: opts.untrackedLines, task: opts.task || '', out: path.join(directory, 'context'), memoryIndex: false });
      const summary = jsonSummary(pack);
      const refFile = path.join(directory, 'parent-evidence-ref.json');
      store.atomicWrite(refFile, summary.evidence_ref);
      return { result: { ...summary, evidence_ref_file: refFile }, artifactPaths: [refFile] };
    });
    Object.assign(result, parent);
    const verify = packet => {
      const observed = inspectRun({ root, ref: packet.evidence_ref });
      if (observed.build_state !== 'complete' || observed.integrity !== 'current' || observed.source !== 'current') throw Object.assign(new Error('Pinned context evidence is incomplete, changed or stale.'), { code: 'evidence-not-current' });
      const budget = checkBudget([path.join(packet.run_dir, 'context-telemetry.json')], budgetOpts);
      if (budget.files !== 1 || budget.skipped) throw Object.assign(new Error('Required context telemetry is missing or invalid.'), { code: 'telemetry-missing' });
      return budget;
    };
    currentStep = 'budget';
    const parentBudget = verify(parent);
    result.budget = parentBudget;
    if (!parent.files.length || !parent.required_reviewers?.length || !parent.packet_count) return block('context-incomplete', 'Context lacks files or required reviewer packets.');
    if (parent.files.length !== files.length || files.some(file => !parent.files.includes(file))) return block('scope-incomplete', 'Compiled context does not cover the complete requested scope.');
    if (parentBudget.status === 'pass') result.packets = [parent];
    else {
      const plan = step('wave-plan', () => ({ result: buildContextWavePlan({ root, contextDir: parent.run_dir, evidenceRef: parent.evidence_ref,
        waveDir: path.join(directory, 'waves'), targetTokens: budgetOpts.maxCompactTokens, writeWaveFiles: false }) }));
      result.waves = plan.waves;
      if (plan.status !== 'split-recommended' || plan.waves.length <= 1 || plan.waves.length > maxWaves) return block('manual-scope-needed', 'Scope cannot be split within the wave limit and budget; narrow it explicitly.');
      const assignedArtifacts = new Set(parent.review_assignments.flatMap(assignment => assignment.artifact_ids));
      const requiredProofFiles = parent.authorized_evidence_artifacts.filter(artifact => artifact.source_path && assignedArtifacts.has(artifact.id)).map(artifact => artifact.source_path);
      for (let i = 0; i < plan.waves.length; i += 1) {
        const wave = plan.waves[i];
        const child = step(`wave-${i + 1}`, () => {
          const built = buildContextWave({ root, contextDir: parent.run_dir, evidenceRef: parent.evidence_ref, waveDir: path.join(directory, 'waves'),
            wave: wave.name, targetTokens: budgetOpts.maxCompactTokens, modeOverride: mode, reviewAssignmentsPath: captured.reviewAssignmentsPath, requiredProofFiles });
          if (!built.built_wave) throw Object.assign(new Error('Wave prerequisite could not build a packet; inspect retained results.'), { code: 'wave-build-blocked' });
          const packet = built.built_wave;
          const refFile = path.join(directory, `wave-${i + 1}-evidence-ref.json`);
          store.atomicWrite(refFile, packet.evidence_ref);
          return { result: { ...packet, evidence_ref_file: refFile }, artifactPaths: [refFile, path.resolve(root, packet.file_list)] };
        });
        result.packets.push(child);
        const budget = verify(child);
        const childReviewers = child.required_reviewers || [];
        if (JSON.stringify([...childReviewers].sort()) !== JSON.stringify([...parent.required_reviewers].sort()) ||
          JSON.stringify(child.review_assignments) !== JSON.stringify(parent.review_assignments) ||
          wave.files.some(file => !child.files.includes(file)) || wave.proof_files.some(file => !child.files.includes(file))) return block('proof-or-roster-loss', 'Wave did not retain required roster, focused assignments or proof; narrow manually.');
        if (budget.status !== 'pass') return block('manual-scope-needed', 'A retained wave still exceeds its measured budget; narrow manually.');
      }
      const union = new Set(result.packets.flatMap(packet => packet.files));
      if (files.some(file => !union.has(file))) return block('wave-coverage-incomplete', 'Bounded waves do not cover the complete scope.');
    }
    currentStep = 'verify';
    if (cancelled()) return block('cancelled', 'Preparation cancelled; completed packets retained.');
    const currentAssignments = opts.reviewAssignmentsPath ? read(path.resolve(root, opts.reviewAssignmentsPath), 64 * 1024) : null;
    const currentConfig = fs.existsSync(configFile) ? read(configFile, 64 * 1024) : null;
    if (hash(read(filesPath)) !== inputs.files || (currentAssignments === null ? null : hash(currentAssignments)) !== inputs.assignments ||
      (currentConfig === null ? null : hash(currentConfig)) !== inputs.config) return block('inputs-changed', 'Preparation inputs changed during work; completed results retained for inspection.');
    if (!store.sameSource(source, store.sourceSnapshot(root))) return block('source-changed', 'Source changed during preparation.');
    // Reinspect every run on reuse, not only the advisory latest projection.
    verify(parent);
    for (const packet of result.packets) verify(packet);
    const receipt = step('receipt', () => {
      const ready = { ...result, status: 'ready', review_ready: true, blocker: null, source, input_hash: inputHash };
      store.atomicWrite(result.receipt_path, ready);
      return { result: ready, artifactPaths: [result.receipt_path] };
    });
    return receipt;
  } catch (error) {
    const message = String(error.message || 'Preparation dependency failed').replace(/[\u0000-\u001f]/g, ' ').slice(0, 300);
    return { ...block(error.code || 'preparation-failed', message), next_command: taskId ? `Inspect task ${taskId}; reconcile pending actions explicitly before using a new preparation id.` : 'Correct the named preparation input before retrying.' };
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = opts.prepare ? prepareReview(opts) : buildReviewWavePrep(opts);
  process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : (opts.prepare ? `${result.status}: ${result.blocker?.message || 'Pinned preparation is ready; review approval is not assessed.'}\n` : renderMarkdown(result)));
  if (opts.prepare && !result.review_ready) process.exitCode = 1;
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    usage();
    process.exit(1);
  }
}

module.exports = { buildReviewWavePrep, prepareReview, parseArgs, renderMarkdown };
