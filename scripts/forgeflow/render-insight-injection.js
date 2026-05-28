#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { safeReadTextFile } = require('./file-safety');

function usage() {
  console.error('Usage: render-insight-injection.js [--root <dir>] [--project-dir <dir>] [--json]');
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

function readJson(file, root) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(safeReadTextFile(file, root).content);
  } catch (_err) {
    return null;
  }
}

function artifactStatus(artifact) {
  if (!artifact) return 'missing';
  if (artifact.decision === 'included') return 'included';
  if (artifact.decision === 'metadata-only') return 'metadata-only';
  return artifact.decision || 'unknown';
}

const SIGNAL_SECTIONS = [
  { signal: 'latest-insights', heading: '## Latest Insights', artifact: 'latest-insights' },
  { signal: 'user-profile', heading: '## User Profile Guidance', artifact: 'user-profile' },
  { signal: 'latest-failure-digest', heading: '## Latest Failure Digest', artifact: 'latest-failure-digest' },
  { signal: 'project-code-map', heading: '## Project Code Map', artifact: 'project-code-map' },
  { signal: 'living-map-guidance', heading: '## Living Map Guidance', artifact: 'project-code-map' },
  { signal: 'code-topology', heading: '## Code Topology', artifact: 'code-topology' },
];

function agentSignalRole(contract, signal) {
  if (!contract) return 'unspecified';
  if ((contract.allowed_signals || []).includes(signal)) return 'allowed';
  if ((contract.advisory_signals || []).includes(signal)) return 'advisory';
  if ((contract.verify_before_use || []).includes(signal)) return 'verify-before-use';
  return 'available';
}

function readPacket(root, relPath) {
  if (!relPath) return '';
  const abs = path.isAbsolute(relPath) ? relPath : path.join(root, relPath);
  try {
    return safeReadTextFile(abs, root).content;
  } catch (_err) {
    return '';
  }
}

function buildAgentInjectionRows(root, synthesis, contracts, artifactByName) {
  const packets = (synthesis && synthesis.agent_packets) || {};
  return Object.entries(packets).map(([agent, packetPath]) => {
    const packet = readPacket(root, packetPath);
    const contract = contracts[agent] || {};
    return {
      agent,
      packet: packetPath,
      signals: SIGNAL_SECTIONS.map((section) => {
        const artifact = artifactByName.get(section.artifact);
        return {
          signal: section.signal,
          section_present: packet.includes(section.heading),
          artifact_decision: artifact ? artifactStatus(artifact) : 'missing',
          artifact_reason: artifact ? artifact.reason || '' : '',
          role: agentSignalRole(contract, section.signal),
        };
      }),
    };
  });
}

function buildInsightInjection(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const projectDir = path.resolve(opts.projectDir || defaultProjectDir(root));
  const contextDir = path.join(projectDir, 'context', 'latest');
  const artifactsPath = path.join(contextDir, 'packet-artifacts.json');
  const contractPath = path.join(contextDir, 'agent-context-contract.json');
  const synthesisPath = path.join(contextDir, 'synthesis-input.json');
  const latestReportPath = path.join(contextDir, 'latest-insights-report.json');
  const artifacts = readJson(artifactsPath, projectDir);
  const contract = readJson(contractPath, projectDir);
  const synthesis = readJson(synthesisPath, projectDir);
  const latestReport = readJson(latestReportPath, projectDir);
  const artifactByName = new Map(((artifacts && artifacts.artifacts) || []).map((artifact) => [artifact.name, artifact]));
  const artifactRows = ((artifacts && artifacts.artifacts) || []).map((artifact) => ({
    name: artifact.name || '',
    decision: artifactStatus(artifact),
    reason: artifact.reason || '',
    status: artifact.status || '',
    issue_count: Number(artifact.issue_count || 0),
    next_action: artifact.next_action || '',
  }));
  const contractRows = Object.entries((contract && contract.agents) || {}).map(([agent, value]) => ({
    agent,
    allowed_signals: value.allowed_signals || [],
    advisory_signals: value.advisory_signals || [],
    verify_before_use: value.verify_before_use || [],
    prohibited_uses: value.prohibited_uses || [],
    primary_use: value.primary_use || '',
  }));
  const agentInjections = buildAgentInjectionRows(root, synthesis, (contract && contract.agents) || {}, artifactByName);
  const blockedArtifacts = artifactRows.filter((item) => item.decision !== 'included' && item.next_action);
  const missingCore = ['latest-insights', 'user-profile', 'project-code-map']
    .filter((name) => !artifactRows.some((item) => item.name === name));
  const status = !artifacts || !contract
    ? 'missing'
    : blockedArtifacts.length > 0 || missingCore.length > 0
      ? 'attention'
      : 'pass';
  const controls = [
    {
      signal: 'latest-insights',
      control: 'Quality gate',
      action: 'forgeflow-learnings --project --check',
      boundary: 'Injected only when project learnings pass their checker; otherwise packets carry a gate note.',
    },
    {
      signal: 'user-profile',
      control: 'Profile gate',
      action: 'forgeflow-profile-review',
      boundary: 'Injected only when profile status passes; suggestions require explicit user confirmation.',
    },
    {
      signal: 'code-topology',
      control: 'Scope gate',
      action: 'build-context-pack.js --files <path> or --mode <thin|full|deep>',
      boundary: 'Topology is static import and section guidance only, not runtime proof.',
    },
    {
      signal: 'latest-failure-digest',
      control: 'Freshness gate',
      action: 'forgeflow-failure-digest after a real failed command',
      boundary: 'Stale or missing digests are context hints, not proof of current failure.',
    },
  ];
  const nextCommand = status === 'missing'
    ? 'build-context-pack.js --json'
    : blockedArtifacts[0] && blockedArtifacts[0].next_action
      ? blockedArtifacts[0].next_action
      : 'forgeflow-context-contract';
  const next_reason = status === 'missing'
    ? 'Generate context packets before inspecting injection decisions.'
    : blockedArtifacts[0] && blockedArtifacts[0].next_action
      ? `Clear ${blockedArtifacts[0].name} before relying on injected guidance.`
      : 'Audit packet contracts before agent-heavy work.';
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    project_dir: projectDir,
    context_dir: contextDir,
    status,
    packet_count: synthesis && synthesis.agent_packets ? Object.keys(synthesis.agent_packets).length : 0,
    artifacts: artifactRows,
    agents: contractRows,
    agent_injections: agentInjections,
    controls,
    latest_insights: latestReport ? {
      status: latestReport.status || '',
      check_status: latestReport.check_status || '',
      reason: latestReport.reason || '',
      issue_count: Number(latestReport.issue_count || 0),
    } : null,
    next: nextCommand,
    next_reason,
    boundary: 'Insight injection is local and advisory. It explains packet context decisions but does not approve findings, mutate preferences, or override current instructions.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Insight Injection',
    '',
    `Status: ${result.status}`,
    `Packets: ${result.packet_count}`,
    `Context: ${result.context_dir}`,
    '',
    result.boundary,
    '',
    '## Artifact Decisions',
    '',
  ];
  if (!result.artifacts.length) lines.push('- No packet artifact manifest found.');
  else for (const artifact of result.artifacts) {
    lines.push(`- ${artifact.name}: ${artifact.decision} - ${artifact.reason || '(no reason)'}`);
    if (artifact.status) lines.push(`  - Status: ${artifact.status}`);
    if (artifact.issue_count) lines.push(`  - Issues: ${artifact.issue_count}`);
    if (artifact.next_action) lines.push(`  - Next: ${artifact.next_action}`);
  }
  lines.push('', '## Agent Signal Use', '');
  if (!result.agents.length) lines.push('- No agent context contract found.');
  else for (const agent of result.agents) {
    lines.push(`- ${agent.agent}: ${agent.primary_use || '(no primary use recorded)'}`);
    lines.push(`  - Allowed: ${agent.allowed_signals.join(', ') || '(none)'}`);
    lines.push(`  - Advisory: ${agent.advisory_signals.join(', ') || '(none)'}`);
    lines.push(`  - Verify before use: ${agent.verify_before_use.join(', ') || '(none)'}`);
  }
  lines.push('', '## Per-Agent Injection', '');
  if (!result.agent_injections.length) lines.push('- No agent packets found.');
  else for (const agent of result.agent_injections) {
    lines.push(`- ${agent.agent}: ${agent.packet}`);
    for (const signal of agent.signals) {
      lines.push(`  - ${signal.signal}: ${signal.section_present ? 'section-present' : 'section-missing'}, ${signal.artifact_decision}, ${signal.role}`);
      if (signal.artifact_reason) lines.push(`    - Reason: ${signal.artifact_reason}`);
    }
  }
  lines.push('', '## Controls', '');
  for (const control of result.controls) {
    lines.push(`- ${control.signal}: ${control.control}`);
    lines.push(`  - Action: ${control.action}`);
    lines.push(`  - Boundary: ${control.boundary}`);
  }
  if (result.latest_insights) {
    lines.push('', '## Latest Insights Gate', '');
    lines.push(`- Status: ${result.latest_insights.status}`);
    lines.push(`- Check: ${result.latest_insights.check_status || '(unknown)'}`);
    lines.push(`- Reason: ${result.latest_insights.reason || '(none)'}`);
    lines.push(`- Issues: ${result.latest_insights.issue_count}`);
  }
  lines.push('', `Next: ${result.next}`);
  lines.push(`Why: ${result.next_reason}`, '');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildInsightInjection(opts);
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

module.exports = { buildInsightInjection, parseArgs, renderMarkdown };
