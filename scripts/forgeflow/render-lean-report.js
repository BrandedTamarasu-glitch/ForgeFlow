#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { isPathInside, safeReadTextFile, writeFileSafe, writeJsonSafe } = require('./file-safety');
const { buildTelemetryQuality } = require('./render-telemetry-quality');

const BOUNDARIES = [
  'local-only',
  'aggregate-first',
  'no raw code snippets',
  'no hosted telemetry',
  'no automatic workflow changes',
];

function usage() {
  console.error('Usage: render-lean-report.js [--root <repo>] [--project-dir <dir>] [--metrics-root <dir>] [--write] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', metricsRoot: '', write: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--metrics-root') {
      opts.metricsRoot = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--write') {
      opts.write = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function defaultProjectDir(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function isoNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function safeProjectDir(projectDir) {
  const resolved = path.resolve(projectDir);
  if (!fs.existsSync(resolved)) return resolved;
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) throw new Error(`Refusing symlinked project directory: ${projectDir}`);
  if (!stat.isDirectory()) throw new Error(`Project directory is not a directory: ${projectDir}`);
  return resolved;
}

function readJson(file, projectDir, label, invalid) {
  if (!fs.existsSync(file)) return { label, status: 'missing', path: file, value: null };
  try {
    const value = JSON.parse(safeReadTextFile(file, projectDir).content);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('expected JSON object');
    return { label, status: 'present', path: file, value };
  } catch (err) {
    invalid.push({ label, path: file, reason: err.message });
    return { label, status: 'invalid', path: file, value: null };
  }
}

function readText(file, projectDir, label, invalid) {
  if (!fs.existsSync(file)) return { label, status: 'missing', path: file, value: '' };
  try {
    return { label, status: 'present', path: file, value: safeReadTextFile(file, projectDir).content };
  } catch (err) {
    invalid.push({ label, path: file, reason: err.message });
    return { label, status: 'invalid', path: file, value: '' };
  }
}

function gitNumstat(root) {
  const result = spawnSync('git', ['diff', '--numstat', 'HEAD'], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) return { files_changed: 0, lines_added: 0, lines_removed: 0, available: false };
  let files = 0;
  let added = 0;
  let removed = 0;
  for (const line of String(result.stdout || '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [add, del] = line.split(/\s+/);
    files += 1;
    added += Number.parseInt(add, 10) || 0;
    removed += Number.parseInt(del, 10) || 0;
  }
  return { files_changed: files, lines_added: added, lines_removed: removed, available: true };
}

function leanDecisionSignals(source) {
  const value = source.value || {};
  const decision = value.decision || {};
  const ceiling = decision.ceiling || value.ceiling || {};
  const reuse = decision.reuse_candidates || value.reuse_candidates || [];
  const avoid = decision.avoid_first || value.avoid_first || [];
  const validation = decision.validation_minimum || value.validation_minimum || [];
  const doNotSimplify = decision.do_not_simplify || value.do_not_simplify || [];
  return {
    present: source.status === 'present',
    decision: decision.decision || value.status || 'unknown',
    reuse_candidates: Array.isArray(reuse) ? reuse.length : 0,
    avoid_first_items: Array.isArray(avoid) ? avoid.length : 0,
    validation_minimum_items: Array.isArray(validation) ? validation.length : 0,
    do_not_simplify_items: Array.isArray(doNotSimplify) ? doNotSimplify.length : 0,
    known_ceiling: ceiling.known_ceiling || value.known_ceiling || '',
    upgrade_trigger: ceiling.upgrade_trigger || value.upgrade_trigger || '',
    implementation_note_candidate: Boolean(value.implementation_note_candidate),
  };
}

function noteSignals(source) {
  const text = source.value || '';
  const lower = text.toLowerCase();
  return {
    present: source.status === 'present',
    ceiling_notes: (lower.match(/known ceiling|lean path selected|upgrade trigger/g) || []).length,
    follow_up_mentions: (lower.match(/follow-up|follow up|upgrade when|upgrade trigger/g) || []).length,
    validation_mentions: (lower.match(/validation|tested|smoke|suite|check/g) || []).length,
  };
}

function reviewSignals(source) {
  const value = source.value || {};
  const findings = Array.isArray(value.findings) ? value.findings : [];
  return {
    present: source.status === 'present',
    findings_count: Number(value.findings_count || findings.length || 0),
    estimated_net_removable_lines: Number(value.estimated_net_removable_lines || 0),
    clean: value.status === 'clean',
  };
}

function outputContractSignals(source) {
  const value = source.value || {};
  const issues = Array.isArray(value.issues) ? value.issues : [];
  return {
    present: source.status === 'present',
    status: value.status || source.status,
    lean_checked_count: Number(value.lean_checked_count || 0),
    lean_warning_count: issues.filter((item) => String(item.code || '').startsWith('lean-')).length,
  };
}

function decideLeanStatus(signals, invalid) {
  if (invalid.length > 0) return { status: 'attention', decision: 'fix-evidence', reason: 'One or more lean evidence artifacts are invalid or unsafe to read.' };
  if (!signals.lean_decision.present) return { status: 'thin', decision: 'collect-evidence', reason: 'No lean-decision artifact is present yet.' };
  if (signals.telemetry.status !== 'ready') return { status: 'watch', decision: 'keep-read-only', reason: 'Lean evidence exists, but telemetry quality is still too thin for routing or workflow changes.' };
  if (signals.lean_review.findings_count > 0 || signals.output_contract.lean_warning_count > 0) {
    return { status: 'watch', decision: 'refine-lean-work', reason: 'Lean checks found review or prose-budget follow-up work; keep guidance advisory.' };
  }
  return { status: 'ready', decision: 'continue-dogfood', reason: 'Lean artifacts and telemetry are usable for local dogfood comparison, not automatic policy changes.' };
}

function outputPath(projectDir, basename) {
  const file = path.join(projectDir, 'context', basename);
  const resolved = path.resolve(file);
  if (!isPathInside(path.resolve(projectDir), resolved)) throw new Error('Lean report output must stay inside --project-dir');
  return resolved;
}

function buildLeanReport(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = safeProjectDir(opts.projectDir || defaultProjectDir(root));
  const contextDir = path.join(projectDir, 'context');
  const latestDir = path.join(contextDir, 'latest');
  const invalid = [];
  const sources = {
    leanDecision: readJson(path.join(contextDir, 'lean-decision.json'), projectDir, 'lean decision', invalid),
    leanReview: readJson(path.join(contextDir, 'lean-review.json'), projectDir, 'lean review', invalid),
    outputContract: readJson(path.join(contextDir, 'output-contract.json'), projectDir, 'output contract', invalid),
    contextTelemetry: readJson(path.join(latestDir, 'context-telemetry.json'), projectDir, 'context telemetry', invalid),
    implementationNotes: readText(path.join(projectDir, 'implementation-notes.md'), projectDir, 'implementation notes', invalid),
  };
  const telemetry = buildTelemetryQuality({ root, projectDir, metricsRoot: opts.metricsRoot });
  const diff = gitNumstat(root);
  const signals = {
    lean_decision: leanDecisionSignals(sources.leanDecision),
    implementation_notes: noteSignals(sources.implementationNotes),
    lean_review: reviewSignals(sources.leanReview),
    output_contract: outputContractSignals(sources.outputContract),
    diff,
    telemetry: {
      status: telemetry.status,
      evidence_score: telemetry.evidence_score,
      trusted_sources: telemetry.trusted_sources || [],
      weakest_sources: telemetry.weakest_sources || [],
    },
    context_tokens: {
      compact_tokens: Number(sources.contextTelemetry.value?.compact_tokens || sources.contextTelemetry.value?.estimated_compact_tokens || 0),
      estimated_saved_tokens: Number(sources.contextTelemetry.value?.estimated_saved_tokens || sources.contextTelemetry.value?.saved_tokens || 0),
    },
  };
  const verdict = decideLeanStatus(signals, invalid);
  const result = {
    schema_version: '1',
    generated_at: isoNow(),
    root,
    project_dir: projectDir,
    status: verdict.status,
    lean_decision: verdict.decision,
    reason: verdict.reason,
    boundary: `Read-only lean report; ${BOUNDARIES.join(', ')}.`,
    signals,
    invalid_artifacts: invalid,
    automation_boundaries: BOUNDARIES,
    next: verdict.status === 'attention'
      ? '/forgeflow-lean-report'
      : (signals.lean_decision.present ? '/forgeflow-lean-review' : '/forgeflow-lean-decision --task "<work item>"'),
    next_reason: verdict.reason,
    artifacts: {},
  };
  if (opts.write) {
    const markdownPath = outputPath(projectDir, 'lean-report.md');
    const jsonPath = outputPath(projectDir, 'lean-report.json');
    writeFileSafe(markdownPath, renderMarkdown(result));
    writeJsonSafe(jsonPath, result);
    result.artifacts = { markdown: markdownPath, json: jsonPath };
  }
  return result;
}

function renderMarkdown(result) {
  const s = result.signals;
  const lines = [
    '# Forgeflow Lean Report',
    '',
    `Generated at: ${result.generated_at}`,
    `Status: ${result.status}`,
    `Lean decision: ${result.lean_decision}`,
    '',
    result.boundary,
    '',
    '## Signals',
    '',
    `- Lean decision present: ${s.lean_decision.present ? 'yes' : 'no'}`,
    `- Reuse candidates: ${s.lean_decision.reuse_candidates}`,
    `- Avoid-first items: ${s.lean_decision.avoid_first_items}`,
    `- Validation minimum items: ${s.lean_decision.validation_minimum_items}`,
    `- Ceiling notes: ${s.implementation_notes.ceiling_notes}`,
    `- Current diff: ${s.diff.files_changed} files, +${s.diff.lines_added}/-${s.diff.lines_removed}`,
    `- Lean review findings: ${s.lean_review.findings_count}`,
    `- Prose-budget warnings: ${s.output_contract.lean_warning_count}`,
    `- Telemetry status: ${s.telemetry.status} (${s.telemetry.evidence_score})`,
    `- Context savings tokens: ${s.context_tokens.estimated_saved_tokens}`,
    '',
    '## Boundaries',
    '',
  ];
  for (const item of result.automation_boundaries) lines.push(`- ${item}`);
  lines.push('', '## Invalid Artifacts', '');
  if (result.invalid_artifacts.length === 0) lines.push('- None.');
  else for (const item of result.invalid_artifacts) lines.push(`- ${item.label}: ${item.reason}`);
  lines.push('', `Next: ${result.next}`, `Why: ${result.next_reason}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildLeanReport(opts);
  process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
  if (result.status === 'attention') process.exit(1);
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

module.exports = { buildLeanReport, parseArgs, renderMarkdown };
