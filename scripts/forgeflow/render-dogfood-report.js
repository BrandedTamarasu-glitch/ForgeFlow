#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { isPathInside, safeReadTextFile, writeFileSafe, writeJsonSafe } = require('./file-safety');

const BOUNDARIES = [
  'no LLM-generated patching',
  'no PR comment bots',
  'no CI auto-push',
  'no multi-fix batches',
  'no GitHub calls',
  'no automatic promotion',
];

function usage() {
  console.error('Usage: render-dogfood-report.js [--root <dir>] [--project-dir <dir>] [--write] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), projectDir: '', write: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--project-dir') {
      opts.projectDir = path.resolve(requireValue(argv, arg, i));
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

function outputPath(projectDir, basename) {
  const file = path.join(projectDir, 'context', basename);
  const resolved = path.resolve(file);
  if (!isPathInside(path.resolve(projectDir), resolved)) throw new Error('Dogfood report output must stay inside --project-dir');
  return resolved;
}

function readJsonArtifact(file, projectDir, label, invalid) {
  if (!fs.existsSync(file)) return { label, status: 'missing', path: file, value: null };
  try {
    const parsed = JSON.parse(safeReadTextFile(file, projectDir).content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('expected JSON object');
    return { label, status: 'present', path: file, value: parsed };
  } catch (err) {
    invalid.push({ label, path: file, reason: err.message });
    return { label, status: 'invalid', path: file, value: null };
  }
}

function readTextArtifact(file, projectDir, label, invalid) {
  if (!fs.existsSync(file)) return { label, status: 'missing', path: file, value: '' };
  try {
    const content = safeReadTextFile(file, projectDir).content;
    return { label, status: content.trim() ? 'present' : 'empty', path: file, value: content };
  } catch (err) {
    invalid.push({ label, path: file, reason: err.message });
    return { label, status: 'invalid', path: file, value: '' };
  }
}

function artifactPaths(projectDir) {
  const context = path.join(projectDir, 'context');
  const latest = path.join(context, 'latest');
  return {
    architecture: path.join(context, 'architecture.json'),
    ownership: path.join(context, 'ownership-map.json'),
    invocation: path.join(context, 'invocation-hints.json'),
    contextTelemetry: path.join(latest, 'context-telemetry.json'),
    synthesisInput: path.join(latest, 'synthesis-input.json'),
    packetArtifacts: path.join(latest, 'packet-artifacts.json'),
    latestInsights: path.join(latest, 'latest-insights-report.json'),
    failureDigest: path.join(latest, 'failure-digest.md'),
    codeTopology: path.join(latest, 'code-topology.json'),
    projectModel: path.join(context, 'project-operating-model.json'),
  };
}

function phaseStatus(source, presentReason, missingAction) {
  if (source.status === 'present') return { status: 'present', reason: presentReason, action: '' };
  if (source.status === 'invalid') return { status: 'invalid', reason: `${source.label} could not be read safely`, action: missingAction };
  return { status: 'missing', reason: `${source.label} has not been written yet`, action: missingAction };
}

function contextPackSignals(contextTelemetry, synthesisInput, packetArtifacts, latestInsights) {
  const telemetry = contextTelemetry.value || {};
  const synthesis = synthesisInput.value || {};
  const artifacts = packetArtifacts.value || {};
  const insights = latestInsights.value || {};
  const blocks = Array.isArray(synthesis.context_blocks)
    ? synthesis.context_blocks.map((item) => item.name || item.kind || item.title).filter(Boolean)
    : [];
  const architectureInjected = blocks.some((item) => /architecture|ownership|invocation/i.test(item))
    || Boolean(synthesis.architecture_intelligence || synthesis.ownership_map || synthesis.invocation_hints);
  const compactTokens = Number(telemetry.compact_tokens || telemetry.total_compact_tokens || telemetry.summary?.compact_tokens || 0);
  const estimatedSavings = Number(telemetry.estimated_saved_tokens || telemetry.saved_tokens || telemetry.summary?.estimated_saved_tokens || 0);
  const packetCount = Number(artifacts.packet_count || artifacts.agent_packet_count || (Array.isArray(artifacts.agent_packets) ? artifacts.agent_packets.length : 0));
  return {
    architecture_injected: architectureInjected,
    latest_insights_status: insights.status || insights.latest_insights_readiness?.status || latestInsights.status,
    compact_tokens: compactTokens,
    estimated_saved_tokens: estimatedSavings,
    packet_count: packetCount,
  };
}

function evidenceSummary(sources) {
  return Object.entries(sources).map(([key, source]) => ({
    key,
    label: source.label,
    status: source.status,
    path: source.path,
  }));
}

function decidePromotion(phases, signals, invalidArtifacts) {
  const phaseValues = Object.values(phases);
  const presentCount = phaseValues.filter((item) => item.status === 'present').length;
  if (invalidArtifacts.length > 0) {
    return {
      decision: 'refine',
      reason: 'One or more local evidence artifacts are invalid or unsafe to read.',
      next: '/forgeflow-dogfood-report',
    };
  }
  if (presentCount < phaseValues.length) {
    return {
      decision: 'keep-read-only',
      reason: 'The dogfood trail is incomplete, so higher automation should stay deferred.',
      next: '/forgeflow-architecture --write',
    };
  }
  if (!signals.architecture_injected && signals.packet_count === 0) {
    return {
      decision: 'refine',
      reason: 'Phase evidence exists, but context-pack injection evidence is still missing.',
      next: '/forgeflow-review',
    };
  }
  return {
    decision: 'consider-promote',
    reason: 'Phase 8-11 evidence is present and context-pack evidence exists; only narrow opt-in automation should be considered next.',
    next: '/forgeflow-dogfood-report --write',
  };
}

function statusFromDecision(decision) {
  if (decision === 'consider-promote') return 'ready';
  if (decision === 'refine') return 'attention';
  return 'watch';
}

function buildNextActions(phases, promotion) {
  const actions = [];
  for (const item of Object.values(phases)) {
    if (item.status !== 'present' && item.action) actions.push(item.action);
  }
  if (promotion.next) actions.push(promotion.next);
  return [...new Set(actions)].slice(0, 8);
}

function renderDogfoodReport(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const projectDir = safeProjectDir(options.projectDir || defaultProjectDir(root));
  const paths = artifactPaths(projectDir);
  const invalid = [];
  const sources = {
    architecture: readJsonArtifact(paths.architecture, projectDir, 'architecture', invalid),
    ownership: readJsonArtifact(paths.ownership, projectDir, 'ownership map', invalid),
    invocation: readJsonArtifact(paths.invocation, projectDir, 'invocation hints', invalid),
    contextTelemetry: readJsonArtifact(paths.contextTelemetry, projectDir, 'context telemetry', invalid),
    synthesisInput: readJsonArtifact(paths.synthesisInput, projectDir, 'synthesis input', invalid),
    packetArtifacts: readJsonArtifact(paths.packetArtifacts, projectDir, 'packet artifacts', invalid),
    latestInsights: readJsonArtifact(paths.latestInsights, projectDir, 'latest insights report', invalid),
    codeTopology: readJsonArtifact(paths.codeTopology, projectDir, 'code topology', invalid),
    projectModel: readJsonArtifact(paths.projectModel, projectDir, 'project operating model', invalid),
    failureDigest: readTextArtifact(paths.failureDigest, projectDir, 'failure digest', invalid),
  };
  const phases = {
    phase_8_architecture: phaseStatus(sources.architecture, 'Architecture docs evidence is present.', '/forgeflow-architecture --write'),
    phase_9_ownership: phaseStatus(sources.ownership, 'Ownership routing evidence is present.', '/forgeflow-ownership --write'),
    phase_10_invocation: phaseStatus(sources.invocation, 'Invocation hint evidence is present.', '/forgeflow-invocation-hints --write'),
    phase_11_context_injection: phaseStatus(sources.synthesisInput, 'Latest synthesis input exists for context-pack injection review.', '/forgeflow-review'),
  };
  const signals = contextPackSignals(sources.contextTelemetry, sources.synthesisInput, sources.packetArtifacts, sources.latestInsights);
  const promotion = decidePromotion(phases, signals, invalid);
  const result = {
    schema_version: '1',
    generated_at: isoNow(),
    root,
    project_dir: projectDir,
    status: statusFromDecision(promotion.decision),
    promotion_decision: promotion.decision,
    promotion_reason: promotion.reason,
    boundary: `Read-only dogfood report; ${BOUNDARIES.join(', ')}.`,
    phase_readiness: phases,
    context_pack_signals: signals,
    evidence: evidenceSummary(sources),
    invalid_artifacts: invalid,
    automation_boundaries: BOUNDARIES,
    next_actions: buildNextActions(phases, promotion),
    next: promotion.next,
    next_reason: promotion.reason,
    artifacts: {},
  };
  if (options.write) {
    const markdownPath = outputPath(projectDir, 'dogfood-report.md');
    const jsonPath = outputPath(projectDir, 'dogfood-report.json');
    writeFileSafe(markdownPath, renderMarkdown(result));
    writeJsonSafe(jsonPath, result);
    result.artifacts = { markdown: markdownPath, json: jsonPath };
  }
  return result;
}

function list(items, render) {
  if (!items || items.length === 0) return ['- None.'];
  return items.map(render);
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Dogfood Report',
    '',
    `Generated at: ${result.generated_at}`,
    `Status: ${result.status}`,
    `Promotion decision: ${result.promotion_decision}`,
    '',
    result.boundary,
    '',
    '## Phase Readiness',
    '',
  ];
  lines.push(...Object.entries(result.phase_readiness).map(([key, item]) => `- ${key}: ${item.status} - ${item.reason}`));
  lines.push('', '## Context Pack Signals', '');
  lines.push(`- Architecture intelligence injected: ${result.context_pack_signals.architecture_injected ? 'yes' : 'no'}`);
  lines.push(`- Packet count: ${result.context_pack_signals.packet_count}`);
  lines.push(`- Compact tokens: ${result.context_pack_signals.compact_tokens}`);
  lines.push(`- Estimated saved tokens: ${result.context_pack_signals.estimated_saved_tokens}`);
  lines.push(`- Latest insights status: ${result.context_pack_signals.latest_insights_status || 'unknown'}`);
  lines.push('', '## Evidence', '');
  lines.push(...list(result.evidence, (item) => `- ${item.key}: ${item.status} (${item.path})`));
  if (result.invalid_artifacts.length > 0) {
    lines.push('', '## Invalid Artifacts', '');
    lines.push(...result.invalid_artifacts.map((item) => `- ${item.label}: ${item.reason} (${item.path})`));
  }
  lines.push('', '## Boundaries', '');
  lines.push(...result.automation_boundaries.map((item) => `- ${item}`));
  lines.push('', '## Next Actions', '');
  lines.push(...list(result.next_actions, (item) => `- ${item}`));
  lines.push('', result.next_reason, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = renderDogfoodReport(opts);
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

module.exports = {
  parseArgs,
  renderDogfoodReport,
  renderMarkdown,
};
