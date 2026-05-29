#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { checkProjectLearnings } = require('./check-project-learnings');
const { readAgentFeedback, readReviewOutcomes } = require('./build-project-intelligence');
const { readNextWorkOutcomes } = require('./record-next-work-outcome');
const { buildRollup, readRecords } = require('./rollup-first-run-results');
const { compactUserProfile } = require('./user-profile');
const { readLearningSignalPolicy } = require('./learning-signal-policy');

function usage() {
  console.error('Usage: show-learning-status.js [--root <dir>] [--project-dir <dir>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
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

function statusRank(status) {
  if (['fail', 'blocked', 'invalid'].includes(status)) return 3;
  if (['warn', 'attention', 'stale', 'missing', 'empty'].includes(status)) return 2;
  if (['present', 'pass', 'current'].includes(status)) return 0;
  return 1;
}

function summarizeOverall(sections) {
  const max = Math.max(...sections.map((section) => statusRank(section.status)));
  if (max >= 3) return 'fail';
  if (max >= 2) return 'attention';
  return 'pass';
}

function bucketFor(section) {
  if (!section.next || /^continue-/.test(section.next)) return 'healthy';
  if (statusRank(section.status) >= 3 || /fix|repair|health|check|calibrate/.test(section.next)) return 'fix_first';
  return 'watch';
}

function groupRecommendations(sections) {
  const groups = { fix_first: [], watch: [], healthy: [] };
  for (const section of sections) {
    groups[bucketFor(section)].push({ source: section.name, action: section.next || 'continue' });
  }
  return groups;
}

function qualityFor(section, nextWork = null) {
  let score = 100;
  const notes = [];
  if (section.status === 'missing' || section.status === 'empty') {
    score -= 35;
    notes.push('sparse');
  }
  if (section.status === 'stale') {
    score -= 30;
    notes.push('stale');
  }
  if (section.issues > 0) {
    score -= Math.min(35, section.issues * 8);
    notes.push('issues-present');
  }
  if (section.records === 0) {
    score -= 15;
  }
  if (section.name === 'next-work-outcomes' && nextWork && nextWork.confidence_calibration) {
    const high = nextWork.confidence_calibration.high || null;
    if (high && high.total >= 2 && high.useful_rate < 0.5) {
      score -= 25;
      notes.push('high-confidence-needs-calibration');
    }
    const totals = Object.values(nextWork.confidence_calibration).reduce((acc, item) => ({
      total: acc.total + (item.total || 0),
      corrective: acc.corrective + (item.corrective || 0),
    }), { total: 0, corrective: 0 });
    if (totals.total >= 3 && totals.corrective / totals.total >= 0.5) {
      score -= 15;
      notes.push('corrective-heavy');
    }
  }
  const bounded = Math.max(0, Math.min(100, score));
  return {
    source: section.name,
    status: section.status,
    score: bounded,
    confidence: bounded >= 80 ? 'high' : bounded >= 55 ? 'medium' : 'low',
    use: bounded >= 80 ? 'use-directly-with-current-evidence' : bounded >= 55 ? 'use-with-caution' : 'verify-before-use',
    notes,
  };
}

function ageDays(file) {
  if (!file || !fs.existsSync(file)) return null;
  const mtime = fs.statSync(file).mtimeMs;
  return Math.max(0, Math.floor((Date.now() - mtime) / 86400000));
}

function decayFor(section, projectDir, policy) {
  const files = {
    'project-learnings': path.join(projectDir, 'project-learnings.md'),
    'user-profile': path.join(projectDir, 'project-experience-profile.jsonl'),
    'agent-feedback': path.join(projectDir, 'agent-feedback.jsonl'),
    'review-outcomes': path.join(projectDir, 'review-outcomes.jsonl'),
    'next-work-outcomes': path.join(projectDir, 'next-work-outcomes.jsonl'),
  };
  const days = ageDays(files[section.name]);
  const reinforced = section.records >= policy.reinforcement_records;
  let penalty = 0;
  const notes = [];
  if (days === null) {
    penalty = section.records > 0 ? 0 : policy.missing_penalty;
    notes.push('no-timestamped-artifact');
  } else if (days > policy.stale_unreinforced_days && !reinforced) {
    penalty = policy.stale_penalty;
    notes.push('stale-unreinforced');
  } else if (days > policy.aging_unreinforced_days && !reinforced) {
    penalty = policy.aging_penalty;
    notes.push('aging-unreinforced');
  } else if (reinforced) {
    notes.push('reinforced');
  }
  return {
    source: section.name,
    age_days: days,
    reinforced,
    penalty,
    notes,
  };
}

function buildSignalQuality(sections, nextWork, projectDir = '', policy = readLearningSignalPolicy(projectDir).policy) {
  const signals = sections.map((section) => {
    const quality = qualityFor(section, nextWork);
    const decay = decayFor(section, projectDir, policy);
    const score = Math.max(0, quality.score - decay.penalty);
    return {
      ...quality,
      score,
      confidence: score >= 80 ? 'high' : score >= 55 ? 'medium' : 'low',
      use: score >= 80 ? 'use-directly-with-current-evidence' : score >= 55 ? 'use-with-caution' : 'verify-before-use',
      decay,
      notes: [...quality.notes, ...decay.notes],
    };
  });
  const average = signals.length > 0 ? Math.round(signals.reduce((sum, item) => sum + item.score, 0) / signals.length) : 0;
  return {
    status: signals.some((item) => item.confidence === 'low') ? 'attention' : 'pass',
    average_score: average,
    signals,
    policy,
    boundary: 'Signal quality scores rank local guidance trust only. Age and reinforcement can lower trust, but scores do not approve work or replace current code, tests, review, or user instructions.',
  };
}

function firstRunSummary(projectDir) {
  const records = readRecords(projectDir);
  const rollup = buildRollup(records);
  return {
    status: rollup.records > 0 ? 'present' : 'missing',
    records: rollup.records,
    invalid_records: rollup.invalid_records,
    recommendation: rollup.recommendation,
  };
}

function buildLearningStatus(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const projectLearnings = checkProjectLearnings({ projectDir });
  const userProfile = compactUserProfile({ root, projectDir }, 1200);
  const agentFeedback = readAgentFeedback(projectDir);
  const reviewOutcomes = readReviewOutcomes(projectDir);
  const nextWork = readNextWorkOutcomes(projectDir);
  const firstRun = firstRunSummary(projectDir);
  const learningPolicy = readLearningSignalPolicy(projectDir);
  const sections = [
    {
      name: 'project-learnings',
      status: projectLearnings.status,
      records: projectLearnings.candidates || 0,
      issues: projectLearnings.issues.length,
      next: projectLearnings.status === 'pass' ? 'continue-using-project-learnings' : 'forgeflow-learnings --project --check',
    },
    {
      name: 'user-profile',
      status: userProfile.result.check.status,
      records: userProfile.result.check.records.active,
      issues: userProfile.result.check.issues.length + userProfile.result.check.conflicts.length,
      next: userProfile.result.check.status === 'pass' ? 'continue-using-profile-guidance' : 'forgeflow-profile-review',
    },
    {
      name: 'agent-feedback',
      status: agentFeedback.status,
      records: agentFeedback.records,
      issues: agentFeedback.invalid_lines || 0,
      next: (agentFeedback.by_signal && ((agentFeedback.by_signal.incorrect || 0) + (agentFeedback.by_signal.unclear || 0) + (agentFeedback.by_signal.ignored || 0)) > 0) ? 'review-corrective-agent-feedback' : 'continue-recording-agent-feedback',
    },
    {
      name: 'review-outcomes',
      status: reviewOutcomes.status,
      records: reviewOutcomes.records,
      issues: reviewOutcomes.invalid_lines || 0,
      next: (reviewOutcomes.learning_signals && ((reviewOutcomes.learning_signals.false_positive || 0) + (reviewOutcomes.learning_signals.missed_issue || 0) + (reviewOutcomes.learning_signals.stale_guidance || 0)) > 0) ? 'triage-review-outcome-learning-signals' : 'continue-recording-review-outcomes',
    },
    {
      name: 'next-work-outcomes',
      status: nextWork.status,
      records: nextWork.records,
      issues: nextWork.invalid_lines || 0,
      next: nextWork.recommendation,
    },
    {
      name: 'first-run-results',
      status: firstRun.status,
      records: firstRun.records,
      issues: firstRun.invalid_records,
      next: firstRun.recommendation,
    },
  ];
  const recommendations = sections
    .filter((section) => section.next && !/^continue-/.test(section.next))
    .map((section) => ({ source: section.name, action: section.next }));
  const recommendationGroups = groupRecommendations(sections);
  const signalQuality = buildSignalQuality(sections, nextWork, projectDir, learningPolicy.policy);
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    project_dir: projectDir,
    status: summarizeOverall(sections),
    sections,
    recommendations,
    recommendation_groups: recommendationGroups,
    signal_quality: signalQuality,
    learning_signal_policy: {
      status: learningPolicy.status,
      file: learningPolicy.file,
      error: learningPolicy.error || '',
    },
    boundary: 'Learning status is advisory local evidence. It does not approve work, promote patterns, or override current code, tests, review, or user instructions.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Learning Status',
    '',
    `Status: ${result.status}`,
    `Project: ${result.project_dir}`,
    '',
    result.boundary,
    '',
    '## Signals',
    '',
  ];
  for (const section of result.sections) {
    lines.push(`- ${section.name}: ${section.status} (${section.records} record(s), ${section.issues} issue(s))`);
    if (section.next) lines.push(`  - Next: ${section.next}`);
  }
  lines.push('', '## Fix First', '');
  if (result.recommendation_groups.fix_first.length === 0) lines.push('- None.');
  else for (const item of result.recommendation_groups.fix_first) lines.push(`- ${item.source}: ${item.action}`);
  lines.push('', '## Watch', '');
  if (result.recommendation_groups.watch.length === 0) lines.push('- None.');
  else for (const item of result.recommendation_groups.watch) lines.push(`- ${item.source}: ${item.action}`);
  lines.push('', '## Healthy', '');
  if (result.recommendation_groups.healthy.length === 0) lines.push('- None.');
  else for (const item of result.recommendation_groups.healthy) lines.push(`- ${item.source}: ${item.action}`);
  lines.push('', '## Signal Quality', '', `- Status: ${result.signal_quality.status}`, `- Average score: ${result.signal_quality.average_score}`, `- Boundary: ${result.signal_quality.boundary}`);
  lines.push(`- Policy: ${result.learning_signal_policy.status} (${result.learning_signal_policy.file})`);
  for (const item of result.signal_quality.signals) {
    lines.push(`- ${item.source}: ${item.confidence} (${item.score}) - ${item.use}`);
    lines.push(`  - Decay: ${item.decay.age_days === null ? 'unknown age' : `${item.decay.age_days} day(s)`}, ${item.decay.reinforced ? 'reinforced' : 'not reinforced'}, penalty ${item.decay.penalty}`);
    if (item.notes.length > 0) lines.push(`  - Notes: ${item.notes.join(', ')}`);
  }
  lines.push('');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildLearningStatus(opts);
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

module.exports = { buildLearningStatus, buildSignalQuality, firstRunSummary, groupRecommendations, parseArgs, qualityFor, renderMarkdown };
