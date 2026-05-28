#!/usr/bin/env node
const path = require('path');
const { parseArgs: parsePatternArgs, rollupPatternLearnings, renderSourceMix } = require('./rollup-pattern-learnings');

function usage() {
  console.error('Usage: render-pattern-review.js [--root <dir>] [--patterns-dir <dir>] [--period week|month|all] [--min-projects N] [--min-occurrences N] [--json]');
}

function parseArgs(argv) {
  const opts = parsePatternArgs(argv, { exitOnError: false });
  opts.dryRun = true;
  return opts;
}

function buildPatternReview(opts = {}) {
  const result = rollupPatternLearnings({ ...opts, dryRun: true });
  const candidates = (result.candidates || []).map((candidate, index) => ({
    index: index + 1,
    title: candidate.title,
    status: candidate.promotion_candidate ? candidate.promotion_candidate.status : 'ready-for-human-review',
    projects: candidate.projects,
    occurrences: candidate.occurrences,
    max_severity: candidate.max_severity,
    sources: candidate.source_mix,
    samples: candidate.sample_learnings,
    next: candidate.promotion_candidate ? candidate.promotion_candidate.next : 'Review manually before promotion.',
    boundary: candidate.promotion_candidate ? candidate.promotion_candidate.boundary : 'Pattern promotion is manual and public-safe only.',
  }));
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root: path.resolve(opts.root || process.cwd()),
    patterns_dir: result.patterns_dir,
    period: result.period,
    candidates,
    redaction_checklist: [
      'Remove customer, tenant, account, repo, branch, and private host names.',
      'Remove source snippets, stack traces, private URLs, tokens, and file-system paths.',
      'Keep only the reusable failure mode, evidence threshold, and validation guidance.',
      'Update forgeflow-patterns manually only after human approval.',
    ],
    boundary: 'Pattern review is advisory and dry-run only. It never writes pattern files or promotes local project learnings automatically.',
  };
}

function renderMarkdown(review) {
  const lines = [
    '# Forgeflow Pattern Review',
    '',
    `Period: ${review.period}`,
    `Candidates: ${review.candidates.length}`,
    '',
    review.boundary,
    '',
    '## Redaction Checklist',
    '',
    ...review.redaction_checklist.map((item) => `- ${item}`),
    '',
    '## Candidates',
    '',
  ];
  if (review.candidates.length === 0) {
    lines.push('- None met the configured thresholds.');
  } else {
    for (const candidate of review.candidates) {
      lines.push(`### ${candidate.index}. ${candidate.title}`);
      lines.push('');
      lines.push(`- Status: ${candidate.status}`);
      lines.push(`- Projects: ${candidate.projects.join(', ') || '(none)'}`);
      lines.push(`- Occurrences: ${candidate.occurrences}`);
      lines.push(`- Max severity: ${candidate.max_severity}`);
      lines.push(`- Sources: ${renderSourceMix(candidate.sources)}`);
      lines.push(`- Next: ${candidate.next}`);
      lines.push(`- Boundary: ${candidate.boundary}`);
      lines.push('- Samples:');
      for (const sample of candidate.samples || []) {
        lines.push(`  - ${sample.project} (${sample.date || 'unknown'}, ${sample.source_kind || 'unknown'}): ${sample.learning}`);
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const review = buildPatternReview(opts);
  process.stdout.write(opts.json ? `${JSON.stringify(review, null, 2)}\n` : renderMarkdown(review));
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    usage();
    process.exit(err.exitCode || 1);
  }
}

module.exports = { buildPatternReview, parseArgs, renderMarkdown };
