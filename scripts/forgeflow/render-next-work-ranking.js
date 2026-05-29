#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { safeReadTextFile } = require('./file-safety');
const { shellQuote } = require('./privacy-boundary');

function usage() {
  console.error('Usage: render-next-work-ranking.js [--root <repo>] [--project-dir <dir>] [--target-tokens <n>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', targetTokens: 16000, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--target-tokens') {
      opts.targetTokens = Math.max(1000, Number.parseInt(requireValue(argv, arg, i), 10) || 16000);
      i += 1;
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

function readJson(file, root) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(safeReadTextFile(file, root).content);
  } catch (_err) {
    return null;
  }
}

function priorityBase(priority) {
  return { high: 80, medium: 60, low: 40 }[priority] || 50;
}

function band(score) {
  if (score >= 80) return 'high';
  if (score >= 55) return 'medium';
  return 'low';
}

function pushCandidate(candidates, candidate) {
  const score = Math.max(0, Math.min(100, Math.round(candidate.score || 0)));
  const title = candidate.title || '';
  const source = candidate.source || 'local-artifacts';
  candidates.push({
    title,
    score,
    confidence: band(score),
    evidence_strength: candidate.evidence_strength || 'weak',
    source,
    why: candidate.why || '',
    start_with: candidate.start_with || [],
    validate_with: candidate.validate_with || [],
    demote_when: candidate.demote_when || [],
    outcome_prompt: candidate.outcome_prompt || `record-next-work-outcome --title ${shellQuote(title)} --source ${shellQuote(source)} --outcome ${shellQuote('<useful|ignored|incorrect|blocked>')}`,
    proof_boundary: candidate.proof_boundary || 'Advisory ranking only; verify against current code, tests, and review evidence before acting.',
  });
}

function fromProjectItems(candidates, intelligence) {
  for (const item of intelligence.next_work_items || []) {
    const confidenceScore = item.confidence && Number.isFinite(item.confidence.score)
      ? item.confidence.score
      : priorityBase(item.priority);
    pushCandidate(candidates, {
      title: item.title,
      score: confidenceScore,
      evidence_strength: item.evidence_strength || 'weak',
      source: item.source || 'project-intelligence',
      why: item.why,
      start_with: item.start_with || [],
      validate_with: item.validate_with || [],
      demote_when: [
        'The underlying project-intelligence signal is refreshed and no longer appears.',
        'Focused validation or review evidence shows the item is lower risk than ranked.',
      ],
      proof_boundary: item.proof_boundary,
    });
  }
}

function contextBudgetCandidate(candidates, projectDir, targetTokens) {
  const telemetry = readJson(path.join(projectDir, 'context', 'latest', 'context-telemetry.json'), projectDir);
  const compact = Number(telemetry && telemetry.estimated_compact_tokens || 0);
  if (compact <= targetTokens) return;
  pushCandidate(candidates, {
    title: 'Split over-budget context into generated review waves',
    score: 90,
    evidence_strength: 'strong',
    source: 'context-telemetry',
    why: `Latest context pack is ${compact - targetTokens} compact tokens over the ${targetTokens} target.`,
    start_with: ['scripts/forgeflow/render-context-wave-plan.js --write-wave-files'],
    validate_with: ['node scripts/forgeflow/test-render-context-wave-plan.js', 'node scripts/forgeflow/check-context-budget.js --root .forgeflow --warn-only --json'],
    demote_when: ['Latest context telemetry is under the target compact-token budget.'],
  });
}

function failureDigestCandidate(candidates, intelligence) {
  const freshness = intelligence.freshness || {};
  const artifact = intelligence.artifacts || {};
  if (artifact.failure_digest || freshness.failure_digest === 'current') return;
  pushCandidate(candidates, {
    title: 'Capture the next failed validation as a compact failure digest',
    score: freshness.failure_digest === 'attention' ? 75 : 50,
    evidence_strength: freshness.failure_digest === 'attention' ? 'medium' : 'weak',
    source: 'failure-digest',
    why: 'No usable latest failure digest is available, so failed-command context cannot yet be reused compactly.',
    start_with: ['scripts/forgeflow/capture-command-output.js --mode test --command <cmd> --out .forgeflow/<project>/context/latest/failure-digest.md'],
    validate_with: ['node scripts/forgeflow/test-capture-command-output.js', 'node scripts/forgeflow/test-failure-digest.js'],
    demote_when: ['A fresh usable failure digest exists for the current checkout.', 'No validation failure has occurred in the current work item.'],
  });
}

function outcomeCalibrationCandidate(candidates, intelligence) {
  const review = intelligence.review_outcomes || {};
  const feedback = intelligence.agent_feedback || {};
  const nextWork = intelligence.next_work_confidence || {};
  const missing = [review.status, feedback.status, nextWork.status].filter((status) => status === 'missing').length;
  if (missing === 0) return;
  pushCandidate(candidates, {
    title: 'Record outcome evidence to calibrate next-work recommendations',
    score: 65 + missing * 5,
    evidence_strength: missing >= 2 ? 'medium' : 'weak',
    source: 'outcome-calibration',
    why: `${missing} calibration source(s) are missing, so next-work ranking is conservative and history-light.`,
    start_with: ['scripts/forgeflow/record-next-work-outcome.js', 'scripts/forgeflow/record-review-outcome.js', 'scripts/forgeflow/record-agent-feedback.js'],
    validate_with: ['node scripts/forgeflow/test-record-next-work-outcome.js', 'node scripts/forgeflow/test-record-review-outcome.js', 'node scripts/forgeflow/test-rollup-agent-feedback.js'],
    demote_when: ['Outcome records exist and confidence calibration has enough recent examples.'],
  });
}

function profileCandidate(candidates, intelligence) {
  const profile = intelligence.user_profile || {};
  if (profile.status !== 'warn' && profile.status !== 'fail') return;
  pushCandidate(candidates, {
    title: 'Bootstrap explicit user operating and project experience preferences',
    score: profile.status === 'fail' ? 75 : 60,
    evidence_strength: 'medium',
    source: 'user-profile',
    why: `User profile status is ${profile.status}; agents are using default collaboration and project-style guidance.`,
    start_with: ['scripts/forgeflow/render-profile-review.js', 'scripts/forgeflow/check-user-profile.js --json'],
    validate_with: ['node scripts/forgeflow/test-user-profile.js', 'node scripts/forgeflow/test-profile-compliance.js'],
    demote_when: ['Profile quality gate passes and compact profile guidance is injected.'],
    proof_boundary: 'Only explicit user-confirmed preferences should be recorded; never infer profile guidance from behavior alone.',
  });
}

function registryCandidate(candidates, intelligence) {
  const hot = intelligence.hot_files || [];
  const registrySignals = hot.filter((item) => /install-manifest|health-check|release|update-forgeflow|smoke-check/.test(item));
  if (registrySignals.length === 0) return;
  pushCandidate(candidates, {
    title: 'Consolidate runtime helper and command inventory around a shared registry',
    score: 55 + Math.min(20, registrySignals.length * 5),
    evidence_strength: 'medium',
    source: 'hot-files',
    why: `Inventory-related hot files appear in project intelligence: ${registrySignals.slice(0, 3).join('; ')}.`,
    start_with: ['scripts/forgeflow/install-manifest.js', 'scripts/forgeflow/test-install-manifest.js', 'scripts/forgeflow/test-update-forgeflow.js'],
    validate_with: ['node scripts/forgeflow/test-install-manifest.js', 'node scripts/forgeflow/test-update-forgeflow.js', 'node scripts/forgeflow/test-command-coverage.js'],
    demote_when: ['A shared registry covers install/update/release/smoke inventory and tests prove parity.'],
  });
}

function buildNextWorkRanking(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const intelligence = readJson(path.join(projectDir, 'context', 'project-intelligence-rollup.json'), projectDir) || {};
  const candidates = [];
  fromProjectItems(candidates, intelligence);
  contextBudgetCandidate(candidates, projectDir, Math.max(1000, Number(opts.targetTokens || 16000)));
  failureDigestCandidate(candidates, intelligence);
  outcomeCalibrationCandidate(candidates, intelligence);
  profileCandidate(candidates, intelligence);
  registryCandidate(candidates, intelligence);
  candidates.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return {
    schema_version: '1',
    status: candidates.length > 0 ? 'ranked' : 'no-candidates',
    root,
    project_dir: projectDir,
    generated_from: path.join(projectDir, 'context', 'project-intelligence-rollup.json'),
    candidate_count: candidates.length,
    candidates,
    next: candidates[0] ? candidates[0].title : 'No ranked next-work candidates.',
    boundary: 'Next-work ranking is read-only advisory guidance. It does not refresh artifacts, edit files, spawn agents, commit, or push.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Next Work Ranking',
    '',
    `Status: ${result.status}`,
    `Candidates: ${result.candidate_count}`,
    '',
    result.boundary,
    '',
    '## Ranked Candidates',
    '',
  ];
  if (result.candidates.length === 0) lines.push('- None.');
  for (const item of result.candidates) {
    lines.push(`- ${item.score} ${item.confidence}: ${item.title}`);
    lines.push(`  - Source: ${item.source}; evidence: ${item.evidence_strength}`);
    lines.push(`  - Why: ${item.why}`);
    if (item.start_with.length) lines.push(`  - Start: ${item.start_with.join('; ')}`);
    if (item.validate_with.length) lines.push(`  - Validate: ${item.validate_with.join('; ')}`);
    if (item.demote_when.length) lines.push(`  - Demote when: ${item.demote_when.join('; ')}`);
    if (item.outcome_prompt) lines.push(`  - Capture after action: ${item.outcome_prompt}`);
  }
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildNextWorkRanking(opts);
  process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
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

module.exports = { buildNextWorkRanking, parseArgs, renderMarkdown };
