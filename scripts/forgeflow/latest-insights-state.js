#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { safeReadTextFile } = require('./file-safety');

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) return '';
  return result.stdout.trimEnd();
}

function currentGitState(root) {
  const topLevel = git(['rev-parse', '--show-toplevel'], root);
  if (!topLevel) return { available: false, commit_short: '', dirty: false };
  return {
    available: true,
    commit_short: git(['rev-parse', '--short', 'HEAD'], root),
    dirty: git(['status', '--short'], root).split(/\r?\n/).filter(Boolean).length > 0,
  };
}

function repoRoot(cwd = process.cwd()) {
  return git(['rev-parse', '--show-toplevel'], cwd) || cwd;
}

function freshnessStatus(items) {
  if (items.some((item) => item.severity === 'missing')) return 'missing';
  if (items.some((item) => item.severity === 'attention')) return 'attention';
  return 'current';
}

function latestInsightsFreshness(report, root) {
  const current = currentGitState(root);
  const recorded = report && report.git ? report.git : {};
  const issues = [];
  if (!report) {
    issues.push({
      code: 'latest-insights-missing',
      severity: 'missing',
      message: 'No latest-insights report is available.',
    });
  } else if (!recorded || (!recorded.commit_short && recorded.available !== false)) {
    issues.push({
      code: 'latest-insights-provenance-missing',
      severity: 'attention',
      message: 'Latest-insights report does not include git provenance.',
    });
  } else if (current.available && current.commit_short && current.commit_short !== recorded.commit_short) {
    issues.push({
      code: 'latest-insights-commit-stale',
      severity: 'attention',
      message: `Latest insights were generated for ${recorded.commit_short}, current HEAD is ${current.commit_short}.`,
    });
  }
  if (current.available && current.dirty && !recorded.dirty) {
    issues.push({
      code: 'latest-insights-dirty-stale',
      severity: 'attention',
      message: 'Current worktree has local changes that the latest clean insights report did not include.',
    });
  }
  return {
    status: freshnessStatus(issues),
    current_commit: current.commit_short || '',
    current_dirty: Boolean(current.dirty),
    issues,
  };
}

function latestInsightsReadiness(projectDir, root) {
  const file = path.join(projectDir, 'context', 'latest', 'latest-insights-report.json');
  if (!fs.existsSync(file)) {
    return {
      status: 'missing',
      path: file,
      reason: 'latest-insights-report.json not found',
      check_status: '',
      issue_count: 0,
      generated_at: '',
      commit_short: '',
      dirty: false,
      freshness: latestInsightsFreshness(null, root),
    };
  }
  try {
    const parsed = JSON.parse(safeReadTextFile(file, projectDir).content);
    return {
      status: parsed.status || 'unknown',
      path: file,
      reason: parsed.reason || '',
      check_status: parsed.check_status || '',
      issue_count: Number(parsed.issue_count || 0),
      generated_at: parsed.generated_at || '',
      commit_short: parsed.git && parsed.git.commit_short ? parsed.git.commit_short : '',
      dirty: Boolean(parsed.git && parsed.git.dirty),
      freshness: latestInsightsFreshness(parsed, root),
    };
  } catch (_err) {
    return {
      status: 'invalid',
      path: file,
      reason: 'latest-insights-report.json is not valid JSON',
      check_status: '',
      issue_count: 0,
      generated_at: '',
      commit_short: '',
      dirty: false,
      freshness: { status: 'invalid', current_commit: '', current_dirty: false, issues: [] },
    };
  }
}

module.exports = {
  currentGitState,
  latestInsightsFreshness,
  latestInsightsReadiness,
  repoRoot,
};
