#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { publicSafeBlocker } = require('./privacy-boundary');

const CATEGORY_ACTIONS = {
  install: 'improve installer output, manifest coverage, or clean-checkout verification',
  health: 'improve /forgeflow-health diagnostics or settings docs',
  settings: 'improve /forgeflow-health diagnostics or settings docs',
  'template-installer': 'improve installer output, manifest coverage, or clean-checkout verification',
  'codex-discovery': 'improve Codex first-run verification and restart guidance',
  'agent-routing': 'tune routing docs, reviewer prompts, or evidence standards',
  'context-budget': 'add examples, advisor guidance, or budget defaults based on evidence',
  'review-quality': 'tune routing docs, reviewer prompts, or evidence standards',
  privacy: 'tighten sharing boundaries and public-summary inspection',
  docs: 'move the missing step closer to the start path',
};

function usage() {
  console.error('Usage: rollup-pilot-evidence.js [--project-dir <dir>] [--out <path>] [--json]');
}

function argumentError(message, exitOnError) {
  if (exitOnError) {
    console.error(message);
    usage();
    process.exit(2);
  }
  const err = new Error(message);
  err.exitCode = 2;
  throw err;
}

function requireValue(argv, name, index, exitOnError = true) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) {
    argumentError(`Missing value for ${name}`, exitOnError);
  }
  return value;
}

function parseArgs(argv, options = {}) {
  const exitOnError = options.exitOnError !== false;
  const opts = {
    projectDir: '',
    out: '',
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i, exitOnError));
      i += 1;
    } else if (arg === '--out') {
      opts.out = path.resolve(requireValue(argv, arg, i, exitOnError));
      i += 1;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      if (exitOnError) process.exit(0);
      return opts;
    } else {
      argumentError(`Unknown argument: ${arg}`, exitOnError);
    }
  }
  return opts;
}

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) return '';
  return result.stdout.trimEnd();
}

function repoRoot(cwd = process.cwd()) {
  return git(['rev-parse', '--show-toplevel'], cwd) || cwd;
}

function defaultProjectDir(root) {
  return path.join(root, '.forgeflow', path.basename(root));
}

function stripQuotes(value) {
  const trimmed = String(value || '').trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    try {
      return JSON.parse(trimmed);
    } catch (_err) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function parseFlatYaml(content) {
  const record = {};
  for (const raw of String(content || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z0-9_ -]+):\s*(.*)$/);
    if (!match) continue;
    record[match[1].trim()] = stripQuotes(match[2]);
  }
  return record;
}

function countInto(map, value) {
  const key = String(value || '').trim() || 'unknown';
  map[key] = (map[key] || 0) + 1;
}

function parseInteger(value) {
  const number = Number.parseInt(String(value || '').trim(), 10);
  return Number.isFinite(number) ? number : 0;
}

function splitCategories(value) {
  return String(value || '')
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function sortedCounts(counts) {
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function recommendation(rollup) {
  if (rollup.pilot_count === 0) return 'run-another-pilot';
  if (rollup.blocked_first_review_count > 0 || rollup.repeat_issue_count > 0) return 'fix-now';
  if (stateSignalsNeedFix(rollup)) return 'fix-now';
  if ((rollup.adoption_decisions['expand-small-team'] || 0) > 0) return 'expand-small-team';
  if ((rollup.adoption_decisions.defer || 0) > 0) return 'defer';
  return 'run-another-pilot';
}

function stateSignalsNeedFix(rollup) {
  return hasCount(rollup.project_intelligence_readiness, ['blocked', 'needs-refresh', 'needs-triage'])
    || hasCount(rollup.living_project_map_status, ['missing', 'unclear', 'not-useful'])
    || hasCount(rollup.agent_feedback_signal, ['missing', 'unclear', 'negative', 'incorrect']);
}

function nextFixLayer(supportCategories) {
  const [top] = Object.keys(sortedCounts(supportCategories));
  return CATEGORY_ACTIONS[top] || '';
}

function publicSafeCounts(counts) {
  const safeCounts = {};
  for (const [name, count] of Object.entries(counts || {})) {
    const safeName = publicSafeBlocker(name) || 'unclassified-support-category';
    safeCounts[safeName] = (safeCounts[safeName] || 0) + count;
  }
  return sortedCounts(safeCounts);
}

function readEvidenceFiles(projectDir) {
  const evidenceDir = path.join(projectDir, 'pilot-evidence');
  if (!fs.existsSync(evidenceDir)) return [];
  return fs.readdirSync(evidenceDir)
    .filter((file) => /\.(ya?ml)$/i.test(file))
    .sort()
    .map((file) => path.join(evidenceDir, file));
}

function buildRollup(records, files = []) {
  const runtimes = {};
  const projectTypes = {};
  const healthResults = {};
  const adoptionDecisions = {};
  const supportCategories = {};
  let blocked = 0;
  let confirmed = 0;
  let rejected = 0;
  let deferred = 0;
  let reviewMinutes = 0;
  const projectIntelligenceReadiness = {};
  const livingProjectMapStatus = {};
  const agentFeedbackSignal = {};

  for (const record of records) {
    countInto(runtimes, record.runtime);
    countInto(projectTypes, record.project_type);
    countInto(healthResults, record.health_result);
    countInto(adoptionDecisions, record.adoption_decision);
    countInto(projectIntelligenceReadiness, record.project_intelligence_readiness);
    countInto(livingProjectMapStatus, record.living_project_map_status);
    countInto(agentFeedbackSignal, record.agent_feedback_signal);
    confirmed += parseInteger(record.confirmed_findings);
    rejected += parseInteger(record.rejected_findings);
    deferred += parseInteger(record.deferred_findings);
    reviewMinutes += parseInteger(record.review_minutes);
    if (['fail', 'blocked', 'stop-and-fix'].includes(record.health_result) || record.adoption_decision === 'stop-and-fix') {
      blocked += 1;
    }
    for (const category of splitCategories(record.support_categories)) {
      countInto(supportCategories, category);
    }
  }

  const repeated = Object.values(supportCategories).filter((count) => count >= 2).length;
  const projectIntelligenceCounts = sortedCounts(projectIntelligenceReadiness);
  const livingMapCounts = sortedCounts(livingProjectMapStatus);
  const agentFeedbackCounts = sortedCounts(agentFeedbackSignal);
  const rollup = {
    schema_version: '1',
    pilot_count: records.length,
    files,
    runtimes: sortedCounts(runtimes),
    project_types: sortedCounts(projectTypes),
    health_results: sortedCounts(healthResults),
    adoption_decisions: sortedCounts(adoptionDecisions),
    blocked_first_review_count: blocked,
    repeat_issue_count: repeated,
    support_categories: sortedCounts(supportCategories),
    findings: {
      confirmed,
      rejected,
      deferred,
    },
    review_minutes: reviewMinutes,
  };
  rollup.project_intelligence_readiness = projectIntelligenceCounts;
  rollup.living_project_map_status = livingMapCounts;
  rollup.agent_feedback_signal = agentFeedbackCounts;
  rollup.next_fix_layer = nextFixLayer(rollup.support_categories);
  rollup.decision = recommendation(rollup);
  rollup.decision_explanation = decisionExplanation(rollup);
  return rollup;
}

function hasCount(counts, keys) {
  return keys.some((key) => (counts[key] || 0) > 0);
}

function decisionExplanation(rollup) {
  const setupFriction = rollup.blocked_first_review_count > 0 || rollup.repeat_issue_count > 0;
  const intelligenceBlocked = hasCount(rollup.project_intelligence_readiness, ['blocked', 'needs-refresh', 'needs-triage', 'unknown']);
  const livingMapWeak = hasCount(rollup.living_project_map_status, ['missing', 'unclear', 'not-useful', 'unknown']);
  const feedbackWeak = hasCount(rollup.agent_feedback_signal, ['missing', 'unclear', 'negative', 'incorrect', 'unknown']);
  const reasons = [];
  if (setupFriction) reasons.push('setup or first-review friction is still blocking repeatability');
  if (intelligenceBlocked) reasons.push('project-intelligence readiness needs refresh or triage');
  if (livingMapWeak) reasons.push('living project-map signal is missing or unclear');
  if (feedbackWeak) reasons.push('agent-feedback signal is missing, unclear, or corrective');
  if (reasons.length === 0) reasons.push('pilot evidence does not show blocking setup, intelligence, living-map, or feedback issues');
  return {
    decision: rollup.decision,
    setup_friction: setupFriction ? 'attention' : 'clear',
    project_intelligence: intelligenceBlocked ? 'attention' : 'usable',
    living_project_map: livingMapWeak ? 'attention' : 'usable',
    agent_feedback: feedbackWeak ? 'attention' : 'usable',
    reasons,
  };
}

function renderMarkdown(rollup) {
  const lines = [
    '# Pilot Evidence Rollup',
    '',
    `Pilot count: ${rollup.pilot_count}`,
    `Decision: ${rollup.decision}`,
    `Blocked first reviews: ${rollup.blocked_first_review_count}`,
    `Repeated issue categories: ${rollup.repeat_issue_count}`,
    `Review minutes: ${rollup.review_minutes}`,
    `Findings: ${rollup.findings.confirmed} confirmed, ${rollup.findings.rejected} rejected, ${rollup.findings.deferred} deferred`,
  ];
  if (rollup.next_fix_layer) lines.push(`Next fix layer: ${rollup.next_fix_layer}`);
  if (rollup.decision_explanation) {
    lines.push(
      `Decision explanation: ${rollup.decision_explanation.reasons.join('; ')}`,
      `Setup friction: ${rollup.decision_explanation.setup_friction}`,
      `Project intelligence: ${rollup.decision_explanation.project_intelligence}`,
      `Living project map: ${rollup.decision_explanation.living_project_map}`,
      `Agent feedback: ${rollup.decision_explanation.agent_feedback}`,
    );
  }
  lines.push('', '## Health Results', '');
  const healthResults = Object.entries(rollup.health_results);
  if (healthResults.length === 0) {
    lines.push('- none recorded');
  } else {
    for (const [name, count] of healthResults) lines.push(`- ${name}: ${count}`);
  }
  lines.push('', '## Runtimes', '');
  const runtimes = Object.entries(rollup.runtimes);
  if (runtimes.length === 0) {
    lines.push('- none recorded');
  } else {
    for (const [name, count] of runtimes) lines.push(`- ${name}: ${count}`);
  }
  lines.push('', '## Project Types', '');
  const projectTypes = Object.entries(rollup.project_types);
  if (projectTypes.length === 0) {
    lines.push('- none recorded');
  } else {
    for (const [name, count] of projectTypes) lines.push(`- ${name}: ${count}`);
  }
  lines.push('', '## Support Categories', '');
  const categories = Object.entries(publicSafeCounts(rollup.support_categories));
  if (categories.length === 0) {
    lines.push('- none recorded');
  } else {
    for (const [name, count] of categories) lines.push(`- ${name}: ${count}`);
  }
  lines.push('', '## Adoption Decisions', '');
  const decisions = Object.entries(rollup.adoption_decisions);
  if (decisions.length === 0) {
    lines.push('- none recorded');
  } else {
    for (const [name, count] of decisions) lines.push(`- ${name}: ${count}`);
  }
  lines.push('', '## Readiness Signals', '');
  lines.push('Project intelligence readiness:', '', ...countLines(rollup.project_intelligence_readiness));
  lines.push('', 'Living project map status:', '', ...countLines(rollup.living_project_map_status));
  lines.push('', 'Agent feedback signal:', '', ...countLines(rollup.agent_feedback_signal));
  return `${lines.join('\n')}\n`;
}

function countLines(counts) {
  const entries = Object.entries(counts || {});
  if (entries.length === 0) return ['- none recorded'];
  return entries.map(([name, count]) => `- ${name}: ${count}`);
}

function rollupPilotEvidence(opts = {}) {
  const root = repoRoot();
  const projectDir = opts.projectDir || defaultProjectDir(root);
  const files = readEvidenceFiles(projectDir);
  const records = files.map((file) => parseFlatYaml(fs.readFileSync(file, 'utf8')));
  const rollup = buildRollup(records, files);
  if (opts.out) {
    fs.mkdirSync(path.dirname(opts.out), { recursive: true });
    fs.writeFileSync(opts.out, renderMarkdown(rollup), 'utf8');
  }
  return {
    ...rollup,
    project_dir: projectDir,
    out: opts.out || '',
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = rollupPilotEvidence(opts);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (opts.out) {
    console.log(`Pilot evidence rollup written to ${opts.out}`);
  } else {
    process.stdout.write(renderMarkdown(result));
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = {
  buildRollup,
  decisionExplanation,
  parseArgs,
  parseFlatYaml,
  publicSafeCounts,
  rollupPilotEvidence,
  stateSignalsNeedFix,
  renderMarkdown,
  splitCategories,
};
