#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { adviseContext } = require('./advise-context');
const { compareCodeMapTrend, readCodeMapHistory } = require('./show-code-map');

function usage() {
  console.error('Usage: show-project-trends.js [--project-dir <dir>] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) {
    console.error(`Missing value for ${name}`);
    usage();
    process.exit(2);
  }
  return value;
}

function parseArgs(argv) {
  const opts = {
    projectDir: '',
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      usage();
      process.exit(2);
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

function readFile(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function latestCodeMapTrend(history) {
  const records = Array.isArray(history) ? history.filter((item) => item && item.summary) : [];
  if (records.length < 2) return { status: records.length === 1 ? 'first-run' : 'missing' };
  return compareCodeMapTrend(records[records.length - 1], records.slice(0, -1));
}

function parseProjectLearnings(markdown) {
  const sourceLine = String(markdown || '').split(/\r?\n/).find((line) => line.startsWith('- Code map history:')) || '';
  const consumedTrend = /trend\s+compared/.test(sourceLine);
  return {
    present: Boolean(markdown),
    consumed_code_map_trend: consumedTrend,
    code_map_history_source: sourceLine.replace(/^- /, ''),
  };
}

function topList(items, limit = 5) {
  return (items || []).slice(0, limit);
}

function showProjectTrends(opts = {}) {
  const root = opts.root || repoRoot();
  const projectDir = opts.projectDir || defaultProjectDir(root);
  const contextDir = path.join(projectDir, 'context');
  const historyPath = path.join(contextDir, 'code-map-history.jsonl');
  const learningsPath = path.join(projectDir, 'project-learnings.md');
  const history = readCodeMapHistory(historyPath);
  const trend = latestCodeMapTrend(history);
  const latest = history.length > 0 ? history[history.length - 1] : null;
  const advisor = adviseContext({
    root: projectDir,
    codeMapHistoryFiles: fs.existsSync(historyPath) ? [historyPath] : [],
  });

  return {
    schema_version: '1',
    project_dir: projectDir,
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    paths: {
      code_map_history: fs.existsSync(historyPath) ? path.relative(root, historyPath) : null,
      project_learnings: fs.existsSync(learningsPath) ? path.relative(root, learningsPath) : null,
    },
    code_map: {
      history_snapshots: history.length,
      latest_generated_at: latest ? latest.generated_at || '' : '',
      latest_commit: latest ? latest.commit_short || '' : '',
      latest_dirty: latest ? Boolean(latest.dirty) : false,
      summary: latest ? latest.summary || null : null,
      trend,
      new_high_fan_in: topList(trend.new_high_fan_in),
      new_high_fan_out: topList(trend.new_high_fan_out),
    },
    project_learnings: parseProjectLearnings(readFile(learningsPath)),
    advisor: {
      budget_status: advisor.budget.status,
      code_topology_status: advisor.code_topology.status,
      code_map_trends_status: advisor.code_map_trends.status,
      recommendation_actions: advisor.recommendations.map((item) => item.action),
      estimated_compact_tokens: advisor.summary.totals.estimated_compact_tokens,
      estimated_saved_tokens: advisor.summary.totals.estimated_saved_tokens,
      percent_saved: advisor.summary.percent_saved,
    },
  };
}

function renderMarkdown(result) {
  const trend = result.code_map.trend || {};
  return [
    '# Forgeflow Project Trends',
    '',
    `Project: ${result.project_dir}`,
    `Generated at: ${result.generated_at}`,
    '',
    '## Code Map Trend',
    '',
    `- Status: ${trend.status || 'missing'}`,
    `- History snapshots: ${result.code_map.history_snapshots}`,
    `- Latest snapshot: ${result.code_map.latest_generated_at || '(none)'}`,
    `- Source files delta: ${trend.source_files_delta ?? 0}`,
    `- Local edges delta: ${trend.local_edges_delta ?? 0}`,
    `- Unresolved imports delta: ${trend.unresolved_imports_delta ?? 0}`,
    `- Changed sections delta: ${trend.changed_sections_delta ?? 0}`,
    `- New high fan-in: ${result.code_map.new_high_fan_in.length > 0 ? result.code_map.new_high_fan_in.join(', ') : '(none)'}`,
    `- New high fan-out: ${result.code_map.new_high_fan_out.length > 0 ? result.code_map.new_high_fan_out.join(', ') : '(none)'}`,
    '',
    '## Project Learnings',
    '',
    `- Present: ${result.project_learnings.present ? 'yes' : 'no'}`,
    `- Consumed code-map trend: ${result.project_learnings.consumed_code_map_trend ? 'yes' : 'no'}`,
    result.project_learnings.code_map_history_source ? `- Source: ${result.project_learnings.code_map_history_source}` : '- Source: (none)',
    '',
    '## Advisor',
    '',
    `- Budget: ${result.advisor.budget_status}`,
    `- Code topology: ${result.advisor.code_topology_status}`,
    `- Code map trends: ${result.advisor.code_map_trends_status}`,
    `- Percent saved: ${result.advisor.percent_saved}%`,
    `- Recommendations: ${result.advisor.recommendation_actions.join(', ') || '(none)'}`,
  ].join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = showProjectTrends(opts);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${renderMarkdown(result)}\n`);
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
  latestCodeMapTrend,
  parseProjectLearnings,
  renderMarkdown,
  showProjectTrends,
};
