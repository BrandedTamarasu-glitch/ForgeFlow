#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildCodeTopology } = require('./build-code-topology');
const { safeReadTextFile, writeFileSafe } = require('./file-safety');
const DEFAULT_HISTORY_LIMIT = 50;

function usage() {
  console.error('Usage: show-code-map.js [--root <dir>] [--project-dir <dir>] [--out <markdown>] [--max-hotspots <n>] [--history-limit <n>] [--json]');
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
    root: '',
    out: '',
    maxHotspots: 10,
    historyLimit: DEFAULT_HISTORY_LIMIT,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--out') {
      opts.out = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--max-hotspots') {
      opts.maxHotspots = Number.parseInt(requireValue(argv, arg, i), 10);
      i += 1;
    } else if (arg === '--history-limit') {
      opts.historyLimit = Number.parseInt(requireValue(argv, arg, i), 10);
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

function defaultOut(root, projectDir = defaultProjectDir(root)) {
  return path.join(projectDir, 'context', 'project-code-map.md');
}

function defaultHistoryPath(root, projectDir = defaultProjectDir(root)) {
  return path.join(projectDir, 'context', 'code-map-history.jsonl');
}

function defaultAcceptancePath(projectDir) {
  return path.join(projectDir, 'code-map-accept.json');
}

function historyPathForTopologyOut(topologyOut) {
  const dir = path.dirname(topologyOut);
  const contextDir = path.basename(dir) === 'latest' ? path.dirname(dir) : dir;
  return path.join(contextDir, 'code-map-history.jsonl');
}

function md(value) {
  return String(value || '').replace(/([\\`*_{}\[\]()#+\-.!|>])/g, '\\$1');
}

function safeLimit(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function topMarkdownSections(topology, limit = 8) {
  return (topology.markdown_sections || [])
    .slice()
    .sort((a, b) => b.sections.length - a.sections.length || a.path.localeCompare(b.path))
    .slice(0, limit)
    .map((item) => ({
      path: item.path,
      section_count: item.sections.length,
      sections: item.sections.slice(0, 5),
    }));
}

function changedSectionList(topology) {
  return Object.entries(topology.changed_sections || {})
    .flatMap(([file, sections]) => sections.map((section) => ({ file, ...section })))
    .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
    .slice(0, 20);
}

function unresolvedImportReason(item) {
  const specifier = String(item.specifier || '');
  if (!specifier.startsWith('.')) return 'external package import';
  const ext = path.extname(specifier);
  if (ext && !['.js', '.jsx', '.ts', '.tsx'].includes(ext)) return 'unsupported source extension';
  return 'no matching local JS/TS file or index file found';
}

function dynamicImportReason(item) {
  const expression = String(item.expression || '');
  if (/^['"][^'"]+['"]$/.test(expression)) return 'literal dynamic import; static graph skips runtime import() edges';
  return 'non-literal dynamic import; target is only known at runtime';
}

const ASSET_OR_DATA_EXTENSIONS = new Set([
  '.avif', '.bmp', '.css', '.csv', '.gif', '.ico', '.jpeg', '.jpg', '.json', '.md',
  '.mp3', '.mp4', '.pdf', '.png', '.scss', '.svg', '.txt', '.webp', '.woff', '.woff2',
]);
const SOURCE_SUFFIX_EXTENSIONS = new Set([
  '.api', '.component', '.config', '.constant', '.constants', '.context', '.hook',
  '.hooks', '.model', '.models', '.schema', '.service', '.store', '.type', '.types',
  '.util', '.utils',
]);

function literalImportValue(expression) {
  const match = String(expression || '').match(/^['"]([^'"]+)['"]$/);
  return match ? match[1] : '';
}

function importGapCategory(item, kind) {
  if (item.scope === 'test-fixture') {
    return {
      category: 'test-fixture',
      severity: 'info',
      expected: true,
      action: 'Treat as fixture/test-only topology noise unless the current change touches this fixture.',
    };
  }

  if (kind === 'dynamic') {
    const literal = literalImportValue(item.expression);
    if (!literal) {
      return {
        category: 'runtime-dynamic-import',
        severity: 'info',
        expected: true,
        action: 'Runtime expression is intentional in many routers/i18n loaders; inspect only when this path is in scope.',
      };
    }
    if (literal.startsWith('.') || literal.startsWith('@/') || literal.startsWith('~/')) {
      return {
        category: 'dynamic-local-or-alias',
        severity: 'review',
        expected: false,
        action: 'Confirm bundler aliases and lazy-route targets are valid, or add resolver support if this is expected.',
      };
    }
    return {
      category: 'dynamic-package',
      severity: 'info',
      expected: true,
      action: 'Package dynamic import is usually intentional; verify dependency presence if this file is in scope.',
    };
  }

  const specifier = String(item.specifier || '');
  const ext = path.extname(specifier);
  if (ASSET_OR_DATA_EXTENSIONS.has(ext.toLowerCase())) {
    return {
      category: 'asset-or-data-import',
      severity: 'info',
      expected: true,
      action: 'No source graph edge is expected; verify bundler asset/data handling only when this import is in scope.',
    };
  }
  if (SOURCE_SUFFIX_EXTENSIONS.has(ext.toLowerCase())) {
    return {
      category: 'source-suffix-resolution-gap',
      severity: 'review',
      expected: false,
      action: 'Check for a matching source file such as .ts/.tsx, or extend topology resolution for this naming suffix.',
    };
  }
  if (specifier.startsWith('@/') || specifier.startsWith('~/')) {
    return {
      category: 'alias-resolution-gap',
      severity: 'review',
      expected: false,
      action: 'Confirm tsconfig/bundler alias config or add alias resolution support to the topology helper.',
    };
  }
  if (specifier.startsWith('.')) {
    return {
      category: 'local-module-missing',
      severity: 'review',
      expected: false,
      action: 'Confirm the target module exists, add an index file, or fix the import path.',
    };
  }
  return {
    category: 'external-or-alias-gap',
    severity: 'review',
    expected: false,
    action: 'Confirm this is an external package, configured alias, or unresolved dependency.',
  };
}

function importGapScope(source) {
  const normalized = String(source || '').replace(/\\/g, '/');
  const base = path.basename(normalized);
  if (
    normalized.includes('/fixtures/')
    || normalized.startsWith('fixtures/')
    || normalized.includes('/__fixtures__/')
    || normalized.includes('/test/')
    || normalized.includes('/tests/')
    || normalized.includes('/__tests__/')
    || /^test[-.]/.test(base)
    || /[-.]test\.[cm]?[jt]sx?$/.test(base)
    || /[-.]spec\.[cm]?[jt]sx?$/.test(base)
  ) {
    return 'test-fixture';
  }
  return 'production';
}

function importGapCounts(unresolved, skippedDynamic) {
  const counts = {
    unresolved_total: unresolved.length,
    skipped_dynamic_total: skippedDynamic.length,
    unresolved_production_total: unresolved.filter((item) => item.scope === 'production').length,
    skipped_dynamic_production_total: skippedDynamic.filter((item) => item.scope === 'production').length,
    unresolved_test_fixture_total: unresolved.filter((item) => item.scope === 'test-fixture').length,
    skipped_dynamic_test_fixture_total: skippedDynamic.filter((item) => item.scope === 'test-fixture').length,
  };
  counts.production_total = counts.unresolved_production_total + counts.skipped_dynamic_production_total;
  counts.test_fixture_total = counts.unresolved_test_fixture_total + counts.skipped_dynamic_test_fixture_total;
  return counts;
}

function importGapTriage(unresolved, skippedDynamic) {
  const all = [
    ...unresolved.map((item) => ({ ...item, gap_type: 'unresolved' })),
    ...skippedDynamic.map((item) => ({ ...item, gap_type: 'dynamic' })),
  ];
  const categories = {};
  let expectedTotal = 0;
  let needsReviewTotal = 0;
  let acceptedTotal = 0;
  for (const item of all) {
    const category = item.triage && item.triage.category ? item.triage.category : 'unknown';
    if (!categories[category]) {
      categories[category] = {
        category,
        severity: item.triage ? item.triage.severity : 'review',
        expected: item.triage ? Boolean(item.triage.expected) : false,
        total: 0,
        unresolved: 0,
        skipped_dynamic: 0,
        examples: [],
        action: item.triage ? item.triage.action : 'Inspect import gap.',
      };
    }
    const bucket = categories[category];
    bucket.total += 1;
    if (item.gap_type === 'unresolved') bucket.unresolved += 1;
    if (item.gap_type === 'dynamic') bucket.skipped_dynamic += 1;
    if (bucket.examples.length < 3) {
      bucket.examples.push({
        source: item.source,
        specifier: item.specifier || '',
        expression: item.expression || '',
        scope: item.scope,
      });
    }
    if (item.accepted) acceptedTotal += 1;
    if (item.triage && item.triage.expected) expectedTotal += 1;
    else needsReviewTotal += 1;
  }
  return {
    expected_total: expectedTotal,
    accepted_total: acceptedTotal,
    needs_review_total: needsReviewTotal,
    categories: Object.values(categories).sort((a, b) => {
      if (a.expected !== b.expected) return a.expected ? 1 : -1;
      return b.total - a.total || a.category.localeCompare(b.category);
    }),
  };
}

function acceptanceKey(item, gapType) {
  const source = String(item.source || '');
  if (gapType === 'dynamic') return `dynamic\x00${source}\x00${String(item.expression || '')}`;
  return `unresolved\x00${source}\x00${String(item.specifier || '')}`;
}

function invalidAcceptance(entry) {
  const source = String(entry && entry.source ? entry.source : '');
  const specifier = String(entry && entry.specifier ? entry.specifier : '');
  const expression = String(entry && entry.expression ? entry.expression : '');
  if (!source) return 'missing source';
  if ((specifier && expression) || (!specifier && !expression)) return 'provide exactly one of specifier or expression';
  if ([source, specifier, expression].some((value) => /[*?]/.test(value))) return 'wildcards are not accepted';
  if (entry.gap_type && !['unresolved', 'dynamic'].includes(entry.gap_type)) return 'gap_type must be unresolved or dynamic';
  if (specifier && entry.gap_type === 'dynamic') return 'dynamic acceptances must use expression';
  if (expression && entry.gap_type === 'unresolved') return 'unresolved acceptances must use specifier';
  return '';
}

function lifecycleWarnings(entry) {
  const warnings = [];
  const note = String(entry && entry.note ? entry.note : '').trim();
  const acceptedAt = String(entry && entry.accepted_at ? entry.accepted_at : '').trim();
  const expiresAt = String(entry && entry.expires_at ? entry.expires_at : '').trim();
  if (!note) warnings.push('add a maintainer note so this acceptance can be reviewed later');
  if (acceptedAt && !validLifecycleDate(acceptedAt)) warnings.push('accepted_at must use YYYY-MM-DD');
  if (expiresAt) {
    const expires = expiryTime(expiresAt);
    if (!validLifecycleDate(expiresAt) || Number.isNaN(expires)) warnings.push('expires_at must use YYYY-MM-DD');
    else if (expires < Date.now()) warnings.push('acceptance is expired');
  }
  return warnings;
}

function validLifecycleDate(value) {
  const text = String(value || '').trim();
  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateOnly) return false;
  const year = Number.parseInt(dateOnly[1], 10);
  const month = Number.parseInt(dateOnly[2], 10);
  const day = Number.parseInt(dateOnly[3], 10);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function expiryTime(value) {
  const text = String(value || '').trim();
  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const year = Number.parseInt(dateOnly[1], 10);
    const month = Number.parseInt(dateOnly[2], 10);
    const day = Number.parseInt(dateOnly[3], 10);
    return new Date(year, month - 1, day + 1).getTime() - 1;
  }
  return Date.parse(text);
}

function loadCodeMapAcceptances(projectDir) {
  const file = defaultAcceptancePath(projectDir);
  if (!fs.existsSync(file)) {
    return {
      path: file,
      status: 'missing',
      records: [],
      invalid_entries: [],
    };
  }
  let parsed;
  try {
    parsed = JSON.parse(safeReadTextFile(file, projectDir).content);
  } catch (err) {
    return {
      path: file,
      status: 'invalid',
      records: [],
      invalid_entries: [{ reason: err.message }],
    };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      path: file,
      status: 'invalid',
      records: [],
      invalid_entries: [{ reason: 'acceptance file must be a JSON object' }],
    };
  }
  if (!Array.isArray(parsed.accepted_gaps)) {
    return {
      path: file,
      status: 'invalid',
      records: [],
      invalid_entries: [{ reason: 'accepted_gaps must be an array' }],
    };
  }
  const entries = parsed.accepted_gaps;
  const records = [];
  const invalidEntries = [];
  for (const [index, entry] of entries.entries()) {
    const reason = invalidAcceptance(entry);
    if (reason) {
      invalidEntries.push({ index, reason });
      continue;
    }
    const gapType = entry.expression ? 'dynamic' : 'unresolved';
    records.push({
      index,
      gap_type: gapType,
      source: entry.source,
      specifier: entry.specifier || '',
      expression: entry.expression || '',
      category: entry.category || '',
      scope: entry.scope || '',
      note: entry.note || '',
      accepted_at: entry.accepted_at || '',
      expires_at: entry.expires_at || '',
      warnings: lifecycleWarnings(entry),
      matched: false,
    });
  }
  const lifecycleWarningCount = records.reduce((total, record) => total + record.warnings.length, 0);
  return {
    path: file,
    status: invalidEntries.length > 0 || lifecycleWarningCount > 0 ? 'attention' : 'loaded',
    records,
    invalid_entries: invalidEntries,
  };
}

function applyAcceptance(item, gapType, acceptances) {
  if (!acceptances || !Array.isArray(acceptances.records) || acceptances.records.length === 0) return item;
  const key = acceptanceKey(item, gapType);
  const match = acceptances.records.find((record) => {
    if (acceptanceKey(record, record.gap_type) !== key) return false;
    if (record.category && (!item.triage || item.triage.category !== record.category)) return false;
    if (record.scope && item.scope !== record.scope) return false;
    return true;
  });
  if (!match) return item;
  match.matched = true;
  const triage = {
    category: 'accepted-local',
    severity: 'info',
    expected: true,
    action: 'Accepted by local code-map-accept.json. Recheck periodically; this is not proof of runtime correctness.',
  };
  return {
    ...item,
    accepted: true,
    acceptance: {
      index: match.index,
      note: match.note,
    },
    triage,
    action: triage.action,
  };
}

function acceptanceSummary(acceptances) {
  if (!acceptances) return null;
  const stale = (acceptances.records || [])
    .filter((record) => !record.matched)
    .map((record) => ({
      index: record.index,
      source: record.source,
      specifier: record.specifier,
      expression: record.expression,
      category: record.category,
      scope: record.scope,
    }));
  const acceptedTotal = (acceptances.records || []).filter((record) => record.matched).length;
  return {
    path: acceptances.path,
    status: acceptances.status,
    accepted_total: acceptedTotal,
    stale_total: stale.length,
    invalid_total: (acceptances.invalid_entries || []).length,
    lifecycle_warning_total: (acceptances.records || []).reduce((total, record) => total + (record.warnings || []).length, 0),
    stale_entries: stale.slice(0, 8),
    invalid_entries: (acceptances.invalid_entries || []).slice(0, 8),
    lifecycle_warnings: (acceptances.records || [])
      .filter((record) => (record.warnings || []).length > 0)
      .slice(0, 8)
      .map((record) => ({
        index: record.index,
        source: record.source,
        specifier: record.specifier,
        expression: record.expression,
        warnings: record.warnings,
      })),
  };
}

function importGapSummary(topology, limit = 8, opts = {}) {
  const acceptances = opts.acceptances || null;
  const allUnresolved = (topology.unresolved || []).map((item) => ({
    source: item.source,
    specifier: item.specifier,
    kind: item.kind,
    scope: importGapScope(item.source),
    reason: unresolvedImportReason(item),
  })).map((item) => {
    const triage = importGapCategory(item, 'unresolved');
    return applyAcceptance({ ...item, triage, action: triage.action }, 'unresolved', acceptances);
  });
  const allSkippedDynamic = (topology.skipped_dynamic || []).map((item) => ({
    source: item.source,
    expression: item.expression,
    scope: importGapScope(item.source),
    reason: dynamicImportReason(item),
  })).map((item) => {
    const triage = importGapCategory(item, 'dynamic');
    return applyAcceptance({ ...item, triage, action: triage.action }, 'dynamic', acceptances);
  });
  const counts = importGapCounts(allUnresolved, allSkippedDynamic);
  const triage = importGapTriage(allUnresolved, allSkippedDynamic);
  return {
    unresolved: allUnresolved.slice(0, limit),
    skipped_dynamic: allSkippedDynamic.slice(0, limit),
    triage,
    acceptance: acceptanceSummary(acceptances),
    limits: {
      unresolved: limit,
      skipped_dynamic: limit,
      ...counts,
    },
  };
}

function projectCodeMapSummary(topology, artifacts, opts = {}) {
  const maxHotspots = safeLimit(opts.maxHotspots, 8);
  const acceptances = loadCodeMapAcceptances(opts.projectDir || defaultProjectDir(topology.root));
  return {
    schema_version: '1',
    generated_at: topology.generated_at,
    root: topology.root,
    provenance: topology.provenance || null,
    summary: topology.summary,
    high_fan_in: topology.high_fan_in.slice(0, maxHotspots),
    high_fan_out: topology.high_fan_out.slice(0, maxHotspots),
    resolved_edges: topology.resolved_edges || null,
    unsupported_languages: topology.unsupported_languages || null,
    changed_sections: changedSectionList(topology),
    changed_file_neighbors: topology.changed_file_neighbors.slice(0, maxHotspots).map((item) => ({
      path: item.path,
      fan_in: item.fan_in,
      fan_out: item.fan_out,
      sections: item.sections.slice(0, maxHotspots),
      changed_sections: item.changed_sections.slice(0, maxHotspots),
      read_next: item.read_next.slice(0, maxHotspots),
    })),
    import_gaps: importGapSummary(topology, maxHotspots, { acceptances }),
    markdown_sections: topMarkdownSections(topology, maxHotspots),
    artifacts,
    limits: [
      'Static JS/TS import graph only.',
      'Sections are source symbol and Markdown heading hints.',
      'Not a runtime call graph, control-flow graph, data-flow graph, or dependency severity model.',
    ],
  };
}

function readCodeMapHistory(historyPath) {
  if (!historyPath || !fs.existsSync(historyPath)) return [];
  let content = '';
  try {
    content = safeReadTextFile(historyPath, path.dirname(historyPath)).content;
  } catch (_err) {
    return [];
  }
  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (_err) {
        return null;
      }
    })
    .filter(Boolean);
}

function codeMapHistoryRecord(summary) {
  return {
    schema_version: '1',
    generated_at: summary.generated_at,
    source: summary.provenance ? summary.provenance.source : 'unknown',
    branch: summary.provenance ? summary.provenance.branch : '',
    commit_short: summary.provenance ? summary.provenance.commit_short : '',
    dirty: summary.provenance ? Boolean(summary.provenance.dirty) : false,
    summary: {
      source_files: summary.summary.source_files,
      local_edges: summary.summary.local_edges,
      unresolved_imports: summary.summary.unresolved_imports,
      skipped_dynamic_imports: summary.summary.skipped_dynamic_imports,
      sections: summary.summary.sections || 0,
      changed_sections: summary.summary.changed_sections || 0,
      markdown_section_files: summary.summary.markdown_section_files || 0,
      resolved_alias_edges: summary.resolved_edges ? summary.resolved_edges.alias || 0 : 0,
      resolved_dynamic_edges: summary.resolved_edges ? summary.resolved_edges.dynamic || 0 : 0,
    },
    high_fan_in: summary.high_fan_in.slice(0, 5).map((item) => ({
      path: item.path,
      fan_in: item.fan_in,
      fan_out: item.fan_out,
    })),
    high_fan_out: summary.high_fan_out.slice(0, 5).map((item) => ({
      path: item.path,
      fan_in: item.fan_in,
      fan_out: item.fan_out,
    })),
    changed_sections: summary.changed_sections.slice(0, 20).map((item) => ({
      file: item.file,
      name: item.name,
      kind: item.kind,
    })),
  };
}

function pathSet(items) {
  return new Set((items || []).map((item) => item.path).filter(Boolean));
}

function setDelta(current, previous) {
  return [...current].filter((item) => !previous.has(item)).slice(0, 10);
}

function compareCodeMapTrend(current, history) {
  const previous = history.length > 0 ? history[history.length - 1] : null;
  if (!previous || !previous.summary) {
    return { status: 'first-run' };
  }
  const currentFanIn = pathSet(current.high_fan_in);
  const previousFanIn = pathSet(previous.high_fan_in);
  const currentFanOut = pathSet(current.high_fan_out);
  const previousFanOut = pathSet(previous.high_fan_out);
  return {
    status: 'compared',
    previous_generated_at: previous.generated_at || '',
    source_files_delta: current.summary.source_files - (previous.summary.source_files || 0),
    local_edges_delta: current.summary.local_edges - (previous.summary.local_edges || 0),
    unresolved_imports_delta: current.summary.unresolved_imports - (previous.summary.unresolved_imports || 0),
    skipped_dynamic_imports_delta: current.summary.skipped_dynamic_imports - (previous.summary.skipped_dynamic_imports || 0),
    sections_delta: current.summary.sections - (previous.summary.sections || 0),
    changed_sections_delta: current.summary.changed_sections - (previous.summary.changed_sections || 0),
    new_high_fan_in: setDelta(currentFanIn, previousFanIn),
    new_high_fan_out: setDelta(currentFanOut, previousFanOut),
    removed_high_fan_in: setDelta(previousFanIn, currentFanIn),
    removed_high_fan_out: setDelta(previousFanOut, currentFanOut),
  };
}

function livingProjectMapFromTrend(trend = {}) {
  const categories = [];
  if (!trend || trend.status === 'first-run') {
    categories.push({
      category: 'baseline',
      severity: 'info',
      count: 1,
      paths: [],
      next_action: 'Run forgeflow-code-map again after a work slice to compare structural movement.',
    });
  } else if (trend.status === 'compared') {
    const newHotspots = [...new Set([...(trend.new_high_fan_in || []), ...(trend.new_high_fan_out || [])])];
    const coolingHotspots = [...new Set([...(trend.removed_high_fan_in || []), ...(trend.removed_high_fan_out || [])])];
    const importGapDeltas = [
      { metric: 'unresolved imports', delta: trend.unresolved_imports_delta || 0 },
      { metric: 'skipped dynamic imports', delta: trend.skipped_dynamic_imports_delta || 0 },
    ];
    if (newHotspots.length > 0) {
      categories.push({
        category: 'new-hotspot',
        severity: 'attention',
        count: newHotspots.length,
        paths: newHotspots.slice(0, 8),
        next_action: 'Review new central files before changing nearby behavior.',
      });
    }
    if (coolingHotspots.length > 0) {
      categories.push({
        category: 'cooling-hotspot',
        severity: 'info',
        count: coolingHotspots.length,
        paths: coolingHotspots.slice(0, 8),
        next_action: 'Treat removed hotspots as lower-priority context unless the current work touched them.',
      });
    }
    for (const item of importGapDeltas.filter((entry) => entry.delta > 0)) {
      categories.push({
        category: 'import-gap-growth',
        severity: 'attention',
        count: item.delta,
        paths: [],
        metric: item.metric,
        next_action: `Run forgeflow-code-map and inspect ${item.metric} before review.`,
      });
    }
    for (const item of importGapDeltas.filter((entry) => entry.delta < 0)) {
      categories.push({
        category: 'import-gap-reduction',
        severity: 'info',
        count: Math.abs(item.delta),
        paths: [],
        metric: item.metric,
        next_action: `Keep the ${item.metric} resolver assumptions documented if the reduction came from topology support.`,
      });
    }
    if ((trend.changed_sections_delta || 0) > 0) {
      categories.push({
        category: 'changed-section-churn',
        severity: 'attention',
        count: trend.changed_sections_delta,
        paths: [],
        next_action: 'Focus validation on changed sections and their read-next neighbors.',
      });
    }
    if ((trend.source_files_delta || 0) > 0 || (trend.local_edges_delta || 0) > 0 || (trend.sections_delta || 0) > 0) {
      categories.push({
        category: 'graph-growth',
        severity: 'info',
        count: 1,
        score: Math.max(0, trend.source_files_delta || 0) + Math.max(0, trend.local_edges_delta || 0) + Math.max(0, trend.sections_delta || 0),
        deltas: {
          source_files: Math.max(0, trend.source_files_delta || 0),
          local_edges: Math.max(0, trend.local_edges_delta || 0),
          sections: Math.max(0, trend.sections_delta || 0),
        },
        paths: [],
        next_action: 'Check whether new files and edges are covered by focused tests or review scope.',
      });
    }
    if (categories.length === 0) {
      categories.push({
        category: 'stable-structure',
        severity: 'info',
        count: 1,
        paths: [],
        next_action: 'Use the current map as review context; no structural movement needs separate triage.',
      });
    }
  } else {
    categories.push({
      category: 'missing-history',
      severity: 'attention',
      count: 1,
      paths: [],
      next_action: 'Run forgeflow-code-map to seed code-map history.',
    });
  }
  return {
    schema_version: '1',
    status: categories.some((item) => item.severity === 'attention') ? 'attention' : 'stable',
    trend_status: trend.status || 'missing',
    categories,
    next_actions: [...new Set(categories.map((item) => item.next_action))],
    caveat: 'Static JS/TS import and section trend only; not a runtime call graph or dependency severity model.',
  };
}

function compactCodeMapHistory(history, limit = DEFAULT_HISTORY_LIMIT) {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_HISTORY_LIMIT;
  if (!Array.isArray(history) || history.length <= safeLimit) return history || [];
  return history.slice(history.length - safeLimit);
}

function writeCodeMapHistory(historyPath, history) {
  writeFileSafe(historyPath, history.map((item) => JSON.stringify(item)).join('\n') + (history.length > 0 ? '\n' : ''), 'utf8');
}

function attachCodeMapHistory(root, summary, historyPath, opts = {}) {
  const history = readCodeMapHistory(historyPath);
  const record = codeMapHistoryRecord(summary);
  const trend = compareCodeMapTrend(record, history);
  summary.history = {
    path: path.relative(root, historyPath),
    previous_runs: history.length,
    recorded: false,
    trend,
  };
  summary.living_project_map = livingProjectMapFromTrend(trend);
  if (opts.record !== false) {
    const retainedHistory = compactCodeMapHistory([...history, record], opts.limit);
    writeCodeMapHistory(historyPath, retainedHistory);
    summary.history.recorded = true;
    summary.history.retained_runs = retainedHistory.length;
    summary.history.retention_limit = Number.isFinite(opts.limit) && opts.limit > 0 ? opts.limit : DEFAULT_HISTORY_LIMIT;
  }
  return summary.history;
}

function renderList(items, renderItem) {
  return items.length > 0 ? items.map(renderItem) : ['(none)'];
}

function renderTrend(summary) {
  if (!summary.history) return ['(not recorded)'];
  const trend = summary.history.trend || {};
  if (trend.status !== 'compared') {
    return [
      `- History: ${md(summary.history.path)} (${summary.history.previous_runs} previous runs)`,
      `- Retained snapshots: ${summary.history.retained_runs || summary.history.previous_runs}`,
      '- Trend: first recorded code-map snapshot',
    ];
  }
  return [
    `- History: ${md(summary.history.path)} (${summary.history.previous_runs} previous runs)`,
    `- Retained snapshots: ${summary.history.retained_runs || summary.history.previous_runs}`,
    `- Source files delta: ${trend.source_files_delta}`,
    `- Local edges delta: ${trend.local_edges_delta}`,
    `- Unresolved imports delta: ${trend.unresolved_imports_delta}`,
    `- Changed sections delta: ${trend.changed_sections_delta}`,
    `- New high fan-in: ${trend.new_high_fan_in.length > 0 ? trend.new_high_fan_in.map(md).join(', ') : '(none)'}`,
    `- New high fan-out: ${trend.new_high_fan_out.length > 0 ? trend.new_high_fan_out.map(md).join(', ') : '(none)'}`,
  ];
}

function renderProjectCodeMap(summary) {
  const lines = [
    '# Forgeflow Project Code Map',
    '',
    `Generated at: ${summary.generated_at}`,
    `Root: ${summary.root}`,
    '',
    '## Provenance',
    '',
    ...(summary.provenance
      ? [
        `- Source: ${md(summary.provenance.source || 'unknown')}`,
        `- Branch: ${md(summary.provenance.branch || 'unknown')}`,
        `- Commit: ${md(summary.provenance.commit_short || 'unknown')}`,
        `- Worktree: ${summary.provenance.dirty ? 'dirty' : 'clean'}`,
        `- Changed files: ${summary.provenance.changed_files}`,
        `- Untracked files: ${summary.provenance.untracked_files}`,
      ]
      : ['- Git provenance unavailable']),
    '',
    '## Summary',
    '',
    `- Source files: ${summary.summary.source_files}`,
    `- Local edges: ${summary.summary.local_edges}`,
    `- External imports: ${summary.summary.external_imports}`,
    `- Unresolved imports: ${summary.summary.unresolved_imports}`,
    `- Skipped dynamic imports: ${summary.summary.skipped_dynamic_imports}`,
    `- Unsupported-language files: ${summary.summary.unsupported_source_files || 0}`,
    `- Sections mapped: ${summary.summary.sections}`,
    `- Changed sections: ${summary.summary.changed_sections}`,
    `- Markdown section files: ${summary.summary.markdown_section_files}`,
    '',
    '## Resolved Edge Types',
    '',
    ...(summary.resolved_edges
      ? [
        `- Relative edges: ${summary.resolved_edges.relative}`,
        `- Alias edges: ${summary.resolved_edges.alias}`,
        `- Literal dynamic edges: ${summary.resolved_edges.dynamic}`,
        `- Source-suffix edges: ${summary.resolved_edges.source_suffix}`,
        `- JS/JSX compatibility edges: ${summary.resolved_edges.js_compat}`,
      ]
      : ['(not available)']),
    '',
    '## Unsupported Language Scope',
    '',
    ...(summary.unsupported_languages && summary.unsupported_languages.languages.length > 0
      ? [
        `- Status: ${summary.unsupported_languages.status}`,
        `- Files outside JS/TS graph: ${summary.unsupported_languages.total_files}`,
        ...summary.unsupported_languages.languages.slice(0, 8).map((item) => `- ${md(item.language)} (${md(item.extension)}): ${item.count} file(s)`),
        `- Guidance: ${md(summary.unsupported_languages.guidance)}`,
      ]
      : ['- None detected.']),
    '',
    '### Alias Edge Examples',
    '',
    ...renderList(summary.resolved_edges && summary.resolved_edges.examples ? summary.resolved_edges.examples.alias || [] : [], (item) => `- ${md(item.source)}: ${md(item.specifier)} -> ${md(item.target)} (${md(item.kind)})`),
    '',
    '### Literal Dynamic Edge Examples',
    '',
    ...renderList(summary.resolved_edges && summary.resolved_edges.examples ? summary.resolved_edges.examples.dynamic || [] : [], (item) => `- ${md(item.source)}: ${md(item.specifier)} -> ${md(item.target)} (${md(item.kind)})`),
    '',
    '## Trends',
    '',
    ...renderTrend(summary),
    '',
    '## Living Project Map',
    '',
    `- Status: ${summary.living_project_map ? summary.living_project_map.status : 'missing'}`,
    `- Caveat: ${summary.living_project_map ? summary.living_project_map.caveat : 'Static map unavailable.'}`,
    ...(summary.living_project_map ? summary.living_project_map.categories.flatMap((item) => [
      `- ${md(item.category)}: ${item.score === undefined ? item.count : `score ${item.score}`} (${md(item.severity)})`,
      ...(item.metric ? [`  - Metric: ${md(item.metric)}`] : []),
      ...(item.deltas ? [`  - Deltas: source files +${item.deltas.source_files}, local edges +${item.deltas.local_edges}, sections +${item.deltas.sections}`] : []),
      `  - Next: ${md(item.next_action)}`,
      ...(item.paths.length > 0 ? [`  - Paths: ${item.paths.map(md).join(', ')}`] : []),
    ]) : ['(none)']),
    '',
    '## High Fan-In',
    '',
    ...renderList(summary.high_fan_in, (item) => `- ${md(item.path)} (fan-in ${item.fan_in}, fan-out ${item.fan_out})`),
    '',
    '## High Fan-Out',
    '',
    ...renderList(summary.high_fan_out, (item) => `- ${md(item.path)} (fan-in ${item.fan_in}, fan-out ${item.fan_out})`),
    '',
    '## Changed Sections',
    '',
    ...renderList(summary.changed_sections, (item) => `- ${md(item.file)}: ${md(item.kind)} ${md(item.name)} (${item.line}-${item.end_line}; changed ${item.changed_lines.join(', ')})`),
    '',
    '## Changed File Neighborhoods',
    '',
  ];
  for (const item of summary.changed_file_neighbors) {
    lines.push(`### ${md(item.path)}`, '', `- fan-in: ${item.fan_in}`, `- fan-out: ${item.fan_out}`);
    if (item.sections.length > 0) {
      lines.push('- sections:', ...item.sections.map((section) => `  - ${md(section.kind)} ${md(section.name)} (${section.line}-${section.end_line})`));
    }
    if (item.read_next.length > 0) {
      lines.push('- read next:', ...item.read_next.map((next) => `  - ${md(next.path)} (${md(next.reason)})`));
    }
    lines.push('');
  }
  if (summary.changed_file_neighbors.length === 0) lines.push('(none)', '');
  lines.push('## Markdown Section Files', '');
  lines.push(...renderList(summary.markdown_sections, (item) => `- ${md(item.path)} (${item.section_count} headings): ${item.sections.map((section) => md(section.name)).join(', ')}`), '');
  lines.push('## Import Gaps', '');
  const gaps = summary.import_gaps || { unresolved: [], skipped_dynamic: [], limits: {} };
  lines.push(`- Unresolved imports shown: ${gaps.unresolved.length}/${gaps.limits.unresolved_total || 0}`);
  lines.push(`- Skipped dynamic imports shown: ${gaps.skipped_dynamic.length}/${gaps.limits.skipped_dynamic_total || 0}`);
  lines.push(`- Production-scope gaps: ${gaps.limits.production_total || 0}`);
  lines.push(`- Test/fixture-scope gaps: ${gaps.limits.test_fixture_total || 0}`);
  if (gaps.triage) {
    lines.push(`- Likely expected gaps: ${gaps.triage.expected_total || 0}`);
    lines.push(`- Locally accepted gaps: ${gaps.triage.accepted_total || 0}`);
    lines.push(`- Needs review: ${gaps.triage.needs_review_total || 0}`);
  }
  if (gaps.acceptance) {
    lines.push(`- Acceptance file: ${md(gaps.acceptance.status)} (${md(gaps.acceptance.path)})`);
    lines.push(`- Stale acceptances: ${gaps.acceptance.stale_total || 0}`);
    lines.push(`- Invalid acceptances: ${gaps.acceptance.invalid_total || 0}`);
    lines.push(`- Lifecycle warnings: ${gaps.acceptance.lifecycle_warning_total || 0}`);
  }
  lines.push('', '### Triage', '');
  lines.push(...renderList((gaps.triage && gaps.triage.categories) || [], (item) => `- ${md(item.category)}: ${item.total} (${md(item.severity)}). ${md(item.action)}`), '');
  if (gaps.acceptance && (gaps.acceptance.stale_total > 0 || gaps.acceptance.invalid_total > 0)) {
    lines.push('', '### Local Acceptance Attention', '');
    lines.push(...renderList(gaps.acceptance.stale_entries || [], (item) => `- stale #${item.index}: ${md(item.source)} ${md(item.specifier || item.expression || '')}`));
    lines.push(...renderList(gaps.acceptance.invalid_entries || [], (item) => `- invalid #${item.index === undefined ? '?' : item.index}: ${md(item.reason)}`), '');
  }
  if (gaps.acceptance && gaps.acceptance.lifecycle_warning_total > 0) {
    lines.push('', '### Local Acceptance Lifecycle', '');
    lines.push(...renderList(gaps.acceptance.lifecycle_warnings || [], (item) => `- #${item.index}: ${md(item.source)} ${md(item.specifier || item.expression || '')} - ${item.warnings.map(md).join('; ')}`), '');
  }
  lines.push('', '### Unresolved Imports', '');
  lines.push(...renderList(gaps.unresolved, (item) => `- ${md(item.source)}: ${md(item.specifier)} (${md(item.kind)}, ${md(item.scope)}, ${md(item.triage ? item.triage.category : 'untriaged')}) - ${md(item.reason)}. ${md(item.action)}`), '');
  lines.push('### Skipped Dynamic Imports', '');
  lines.push(...renderList(gaps.skipped_dynamic, (item) => `- ${md(item.source)}: dynamic import ${md(item.expression)} (${md(item.scope)}, ${md(item.triage ? item.triage.category : 'untriaged')}) - ${md(item.reason)}. ${md(item.action)}`), '');
  lines.push('## Artifacts', '');
  lines.push(`- Graph: ${summary.artifacts.graph}`);
  lines.push(`- Review focus: ${summary.artifacts.review_focus}`);
  lines.push(`- Telemetry: ${summary.artifacts.telemetry}`);
  lines.push('', '## Limits', '', ...summary.limits.map((item) => `- ${item}`));
  return `${lines.join('\n')}\n`;
}

function showCodeMap(opts = {}) {
  const root = opts.root || repoRoot();
  const projectDir = opts.projectDir || defaultProjectDir(root);
  const topologyOut = path.join(projectDir, 'context', 'code-topology.json');
  const reviewFocusOut = path.join(projectDir, 'context', 'code-topology-review-focus.md');
  const telemetryOut = path.join(projectDir, 'context', 'code-topology-telemetry.json');
  const result = buildCodeTopology({
    root,
    out: topologyOut,
    markdownOut: reviewFocusOut,
    telemetryOut,
    maxHotspots: opts.maxHotspots,
    compact: true,
    source: 'show-code-map',
  });
  const artifacts = {
    graph: path.relative(root, result.out),
    review_focus: path.relative(root, result.markdown_out),
    telemetry: path.relative(root, result.telemetry_path),
  };
  const summary = projectCodeMapSummary(result.topology, artifacts, { maxHotspots: opts.maxHotspots, projectDir });
  attachCodeMapHistory(root, summary, opts.history || defaultHistoryPath(root, projectDir), { record: opts.recordHistory, limit: opts.historyLimit });
  const markdown = renderProjectCodeMap(summary);
  const out = opts.out || defaultOut(root, projectDir);
  writeFileSafe(out, markdown);
  return {
    out,
    summary,
    markdown,
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = showCodeMap(opts);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify({ out: result.out, ...result.summary }, null, 2)}\n`);
  } else {
    process.stdout.write(result.markdown);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.stack || err.message);
    process.exit(1);
  }
}

module.exports = {
  attachCodeMapHistory,
  changedSectionList,
  codeMapHistoryRecord,
  compactCodeMapHistory,
  compareCodeMapTrend,
  DEFAULT_HISTORY_LIMIT,
  defaultAcceptancePath,
  defaultHistoryPath,
  expiryTime,
  historyPathForTopologyOut,
  importGapScope,
  importGapSummary,
  importGapTriage,
  loadCodeMapAcceptances,
  livingProjectMapFromTrend,
  projectCodeMapSummary,
  readCodeMapHistory,
  renderProjectCodeMap,
  showCodeMap,
  topMarkdownSections,
  validLifecycleDate,
};
