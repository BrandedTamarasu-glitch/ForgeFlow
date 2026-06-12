'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');

function rootProjectKey(dirName) {
  return dirName.replace(/(--worktrees-.+|-.worktrees-.+)$/, '');
}

function getIsoWeek(isoString) {
  const d = new Date(isoString);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function createZeroProjectSummary(key) {
  return {
    project: key,
    file_count: 0,
    event_totals: {
      verdict: 0,
      'auto-fix-round': 0,
      'command-invoked': 0,
      'finding-overturned': 0,
      'fleet-shard-complete': 0,
      'command-completed': 0,
      'auto-fix-applied': 0,
      'finding-verified': 0
    },
    verdicts: {
      arbiter: { APPROVE: 0, 'CONDITIONAL APPROVE': 0, REVISE: 0, BLOCK: 0 },
      compass: { CONFIRM: 0, CHALLENGE: 0 }
    },
    auto_fix: { rounds: 0, applied: 0, applied_failed: 0 }
  };
}

function bumpVerdict(target, reviewer, verdict) {
  if (reviewer === 'arbiter' && Object.prototype.hasOwnProperty.call(target.arbiter, verdict)) {
    target.arbiter[verdict]++;
  } else if (reviewer === 'compass' && Object.prototype.hasOwnProperty.call(target.compass, verdict)) {
    target.compass[verdict]++;
  }
}

function createZeroWeekBucket(week) {
  return {
    week,
    arbiter: { APPROVE: 0, 'CONDITIONAL APPROVE': 0, REVISE: 0, BLOCK: 0 },
    compass: { CONFIRM: 0, CHALLENGE: 0 }
  };
}

function addCounts(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    if (typeof value === 'number') target[key] = (target[key] || 0) + value;
  }
}

function mergeProjectSummary(target, source) {
  target.file_count += source.file_count || 0;
  addCounts(target.event_totals, source.event_totals);
  addCounts(target.verdicts.arbiter, source.verdicts && source.verdicts.arbiter);
  addCounts(target.verdicts.compass, source.verdicts && source.verdicts.compass);
  addCounts(target.auto_fix, source.auto_fix);
}

function mergeWeekBucket(target, source) {
  addCounts(target.arbiter, source.arbiter);
  addCounts(target.compass, source.compass);
}

function applyRecord(record, summary, weekMap) {
  if (Object.prototype.hasOwnProperty.call(summary.event_totals, record.event)) {
    summary.event_totals[record.event]++;
  }

  if (record.event === 'verdict' && record.detail) {
    const { reviewer, verdict } = record.detail;
    bumpVerdict(summary.verdicts, reviewer, verdict);
    const week = getIsoWeek(record.ts);
    if (!weekMap.has(week)) weekMap.set(week, createZeroWeekBucket(week));
    bumpVerdict(weekMap.get(week), reviewer, verdict);
  } else if (record.event === 'auto-fix-round') {
    summary.auto_fix.rounds++;
  } else if (record.event === 'auto-fix-applied' && record.detail) {
    if (record.detail.success === true) summary.auto_fix.applied++;
    else summary.auto_fix.applied_failed++;
  }
}

async function aggregateProjectFile(resolved, summary, weekMap) {
  let parseWarnings = 0;
  const rl = readline.createInterface({
    input: fs.createReadStream(resolved),
    crlfDelay: Infinity
  });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let record;
    try { record = JSON.parse(trimmed); } catch { parseWarnings++; continue; }
    const sv = record.schema_version;
    if (sv !== undefined && sv !== '1') { parseWarnings++; continue; }
    applyRecord(record, summary, weekMap);
  }
  return parseWarnings;
}

async function resolveProjectFile(metricsRoot, dirName, base) {
  const filePath = path.join(metricsRoot, dirName, 'memory', 'forgeflow-metrics.jsonl');
  let resolved;
  try { resolved = await fs.promises.realpath(filePath); } catch { return null; }
  if (!resolved.startsWith(base)) return null;
  let stat;
  try { stat = await fs.promises.stat(resolved); } catch { return null; }
  if (stat.size > 5 * 1024 * 1024) return { oversize: true };
  return { resolved };
}

async function scanMetrics(metricsRoot) {
  let parseWarnings = 0;
  const projectMap = new Map();
  const weekMap = new Map();

  let dirs;
  try {
    dirs = await fs.promises.readdir(metricsRoot, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'EACCES') {
      return { projects: [], verdicts: [], parse_warnings: 0 };
    }
    throw err;
  }

  const BASE = metricsRoot + path.sep;
  const projectDirs = dirs.filter(d => d.isDirectory() && !d.isSymbolicLink());

  for (const d of projectDirs) {
    const resolution = await resolveProjectFile(metricsRoot, d.name, BASE);
    if (!resolution) continue;
    if (resolution.oversize) { parseWarnings++; continue; }

    const key = rootProjectKey(d.name);
    if (!projectMap.has(key)) projectMap.set(key, createZeroProjectSummary(key));
    const summary = projectMap.get(key);
    summary.file_count++;

    parseWarnings += await aggregateProjectFile(resolution.resolved, summary, weekMap);
  }

  return {
    projects: [...projectMap.values()],
    verdicts: [...weekMap.values()].sort((a, b) => a.week.localeCompare(b.week)),
    parse_warnings: parseWarnings
  };
}

async function scanMetricsRoots(metricsRoots) {
  const roots = [...new Set((metricsRoots || []).filter(Boolean))];
  const projectMap = new Map();
  const weekMap = new Map();
  let parseWarnings = 0;

  for (const root of roots) {
    const result = await scanMetrics(root);
    parseWarnings += result.parse_warnings || 0;

    for (const project of result.projects || []) {
      if (!projectMap.has(project.project)) {
        projectMap.set(project.project, createZeroProjectSummary(project.project));
      }
      mergeProjectSummary(projectMap.get(project.project), project);
    }

    for (const week of result.verdicts || []) {
      if (!weekMap.has(week.week)) weekMap.set(week.week, createZeroWeekBucket(week.week));
      mergeWeekBucket(weekMap.get(week.week), week);
    }
  }

  return {
    projects: [...projectMap.values()],
    verdicts: [...weekMap.values()].sort((a, b) => a.week.localeCompare(b.week)),
    parse_warnings: parseWarnings
  };
}

module.exports = { scanMetrics, scanMetricsRoots };
