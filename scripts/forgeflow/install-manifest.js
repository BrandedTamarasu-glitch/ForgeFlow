#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const SCRIPT_EXTENSIONS = new Set(['.js', '.sh']);
const STATIC_FILES = new Set([
  'templates/ship-presentation.html',
  'templates/forgeflow-budget.json',
  'hooks/forgeflow-gate.js',
  'hooks/forgeflow-context-monitor.js',
  'hooks/copilot-hooks.json',
  'hooks/forgeflow-lean-activate.js',
  'hooks/forgeflow-statusline.js',
  'hooks/forgeflow-telemetry.js',
]);
const RUNTIME_HELPERS = [
  'scripts/forgeflow/advise-context.js',
  'scripts/forgeflow/advise-noisy-command.js',
  'scripts/forgeflow/agent-chat-off.sh',
  'scripts/forgeflow/agent-chat-on.sh',
  'scripts/forgeflow/apply-review-autofix-proposal.js',
  'scripts/forgeflow/build-failure-digest.js',
  'scripts/forgeflow/build-code-topology.js',
  'scripts/forgeflow/build-context-pack.js',
  'scripts/forgeflow/build-context-wave.js',
  'scripts/forgeflow/build-memory-context.js',
  'scripts/forgeflow/build-project-intelligence.js',
  'scripts/forgeflow/build-project-operating-model.js',
  'scripts/forgeflow/build-review-autofix-proposal.js',
  'scripts/forgeflow/build-scope-manifest.js',
  'scripts/forgeflow/capture-command-output.js',
  'scripts/forgeflow/check-agent-drift.js',
  'scripts/forgeflow/check-codex-agent-drift.js',
  'scripts/forgeflow/check-context-contract.js',
  'scripts/forgeflow/check-context-budget.js',
  'scripts/forgeflow/check-implementation-notes.js',
  'scripts/forgeflow/check-project-learnings.js',
  'scripts/forgeflow/check-profile-compliance.js',
  'scripts/forgeflow/check-review-evidence-schema.js',
  'scripts/forgeflow/check-user-profile.js',
  'scripts/forgeflow/classify-review-auto.js',
  'scripts/forgeflow/command-args.js',
  'scripts/forgeflow/command-interface-evidence.js',
  'scripts/forgeflow/command-interface-learning.js',
  'scripts/forgeflow/command-wrapper-contract.js',
  'scripts/forgeflow/compact-command-output.js',
  'scripts/forgeflow/correct-project-learning.js',
  'scripts/forgeflow/context-telemetry.js',
  'scripts/forgeflow/ensure-forgeflow-state.sh',
  'scripts/forgeflow/explain-review-route.js',
  'scripts/forgeflow/file-safety.js',
  'scripts/forgeflow/forgeflow-version.js',
  'scripts/forgeflow/generate-codex-agent-stubs.js',
  'scripts/forgeflow/failure-digest-triage.js',
  'scripts/forgeflow/guidance-contract.js',
  'scripts/forgeflow/health-check.js',
  'scripts/forgeflow/index-memory.js',
  'scripts/forgeflow/install-template.js',
  'scripts/forgeflow/install-manifest.js',
  'scripts/forgeflow/latest-insights-state.js',
  'scripts/forgeflow/memory-retrieval.js',
  'scripts/forgeflow/lean-config.js',
  'scripts/forgeflow/learning-signal-policy.js',
  'scripts/forgeflow/lean-markers.js',
  'scripts/forgeflow/lean-rule-builder.js',
  'scripts/forgeflow/next-action-contract.js',
  'scripts/forgeflow/output-contract.js',
  'scripts/forgeflow/privacy-boundary.js',
  'scripts/forgeflow/project-learning-conflicts.js',
  'scripts/forgeflow/record-agent-feedback.js',
  'scripts/forgeflow/record-command-interface-observation.js',
  'scripts/forgeflow/record-command-interface-learning-outcome.js',
  'scripts/forgeflow/record-first-run-result.js',
  'scripts/forgeflow/record-next-work-outcome.js',
  'scripts/forgeflow/record-pilot-evidence.js',
  'scripts/forgeflow/record-project-learning.js',
  'scripts/forgeflow/record-review-outcome.js',
  'scripts/forgeflow/record-implementation-notes.js',
  'scripts/forgeflow/record-user-profile.js',
  'scripts/forgeflow/render-adoption-pack.js',
  'scripts/forgeflow/render-architecture-docs.js',
  'scripts/forgeflow/render-command-wrapper-batch.js',
  'scripts/forgeflow/render-command-interface-learning-status.js',
  'scripts/forgeflow/render-command-capability-matrix.js',
  'scripts/forgeflow/render-command-index.js',
  'scripts/forgeflow/render-context-retention.js',
  'scripts/forgeflow/render-context-wave-plan.js',
  'scripts/forgeflow/render-dogfood-refresh-plan.js',
  'scripts/forgeflow/render-dogfood-report.js',
  'scripts/forgeflow/render-efficiency-gap-plan.js',
  'scripts/forgeflow/render-first-run-guide.js',
  'scripts/forgeflow/render-first-run-simulator.js',
  'scripts/forgeflow/render-first-useful-win.js',
  'scripts/forgeflow/render-first-task-adoption-loop.js',
  'scripts/forgeflow/render-first-task-report.js',
  'scripts/forgeflow/render-forgeflow-report.js',
  'scripts/forgeflow/render-forgeflow-skills.js',
  'scripts/forgeflow/render-guided-repair.js',
  'scripts/forgeflow/render-insight-injection.js',
  'scripts/forgeflow/render-invocation-hints.js',
  'scripts/forgeflow/render-learning-action-router.js',
  'scripts/forgeflow/render-learning-capture-nudge.js',
  'scripts/forgeflow/render-lean-adapter-drift.js',
  'scripts/forgeflow/render-lean-adapter-smoke.js',
  'scripts/forgeflow/render-lean-adapter-contract.js',
  'scripts/forgeflow/render-lean-audit.js',
  'scripts/forgeflow/render-lean-benchmark.js',
  'scripts/forgeflow/render-lean-benchmark-results.js',
  'scripts/forgeflow/render-lean-benchmark-runner.js',
  'scripts/forgeflow/render-lean-behavior-eval.js',
  'scripts/forgeflow/render-lean-correctness.js',
  'scripts/forgeflow/render-lean-debt.js',
  'scripts/forgeflow/render-lean-decision.js',
  'scripts/forgeflow/render-lean-demo-report.js',
  'scripts/forgeflow/render-lean-eval-pack.js',
  'scripts/forgeflow/render-lean-hook-contract.js',
  'scripts/forgeflow/render-lean-host-adapters.js',
  'scripts/forgeflow/render-lean-host-cli-probes.js',
  'scripts/forgeflow/render-lean-host-command-parity.js',
  'scripts/forgeflow/render-lean-host-packages.js',
  'scripts/forgeflow/render-lean-lab.js',
  'scripts/forgeflow/render-lean-mode.js',
  'scripts/forgeflow/render-lean-openclaw-skill.js',
  'scripts/forgeflow/render-lean-portability-pack.js',
  'scripts/forgeflow/render-lean-prime.js',
  'scripts/forgeflow/render-lean-report.js',
  'scripts/forgeflow/render-lean-review.js',
  'scripts/forgeflow/render-lean-robustness-eval.js',
  'scripts/forgeflow/render-lean-rule-canary.js',
  'scripts/forgeflow/render-lean-session.js',
  'scripts/forgeflow/render-lean-skills.js',
  'scripts/forgeflow/render-lean-status.js',
  'scripts/forgeflow/render-next-work-ranking.js',
  'scripts/forgeflow/render-ownership-map.js',
  'scripts/forgeflow/render-outcome-capture-plan.js',
  'scripts/forgeflow/render-pattern-review.js',
  'scripts/forgeflow/render-post-release-install-verify.js',
  'scripts/forgeflow/render-profile-bootstrap.js',
  'scripts/forgeflow/render-profile-review.js',
  'scripts/forgeflow/render-project-decision-brief.js',
  'scripts/forgeflow/render-research-divergence-eval-results.js',
  'scripts/forgeflow/render-research-divergence-eval.js',
  'scripts/forgeflow/render-research-divergence-advice.js',
  'scripts/forgeflow/render-research-divergence.js',
  'scripts/forgeflow/render-research-divergence-study-judge.js',
  'scripts/forgeflow/render-research-divergence-study.js',
  'scripts/forgeflow/render-review-wave-prep.js',
  'scripts/forgeflow/render-review-auto-evidence.js',
  'scripts/forgeflow/render-release-notes.js',
  'scripts/forgeflow/render-release-readiness.js',
  'scripts/forgeflow/render-release-follow-through.js',
  'scripts/forgeflow/render-release-consumption-rollup.js',
  'scripts/forgeflow/render-release-consumption-loop.js',
  'scripts/forgeflow/render-release-verify.js',
  'scripts/forgeflow/render-support-bundle.js',
  'scripts/forgeflow/render-stale-artifact-plan.js',
  'scripts/forgeflow/render-telemetry-quality.js',
  'scripts/forgeflow/render-update-verify.js',
  'scripts/forgeflow/render-validation-plan.js',
  'scripts/forgeflow/render-workflow-ending-capture.js',
  'scripts/forgeflow/render-workflow-readiness.js',
  'scripts/forgeflow/render-wrapper-drift-plan.js',
  'scripts/forgeflow/render-validation-failure-capture.js',
  'scripts/forgeflow/render-pilot-script.js',
  'scripts/forgeflow/render-ship-presentation.js',
  'scripts/forgeflow/render-evaluation-report.js',
  'scripts/forgeflow/rollup-agent-feedback.js',
  'scripts/forgeflow/rollup-first-run-results.js',
  'scripts/forgeflow/rollup-pattern-learnings.js',
  'scripts/forgeflow/rollup-pilot-evidence.js',
  'scripts/forgeflow/rollup-project-learnings.js',
  'scripts/forgeflow/run-lean-pi-smoke.js',
  'scripts/forgeflow/run-research-divergence-study-codex.js',
  'scripts/forgeflow/run-research-divergence-study.js',
  'scripts/forgeflow/run-review-autofix-sandbox.js',
  'scripts/forgeflow/runtime-drift-snapshot.js',
  'scripts/forgeflow/runtime-helper-contract.js',
  'scripts/forgeflow/runtime-inventory.js',
  'scripts/forgeflow/seed-budget-config.js',
  'scripts/forgeflow/show-code-map.js',
  'scripts/forgeflow/show-project-health-timeline.js',
  'scripts/forgeflow/show-learning-status.js',
  'scripts/forgeflow/show-project-learnings.js',
  'scripts/forgeflow/show-project-trends.js',
  'scripts/forgeflow/show-review-autofix-status.js',
  'scripts/forgeflow/show-user-profile.js',
  'scripts/forgeflow/smoke-check.js',
  'scripts/forgeflow/ship-ci-status.sh',
  'scripts/forgeflow/ship-open-pr.sh',
  'scripts/forgeflow/ship-prepare.sh',
  'scripts/forgeflow/summarize-calibration.js',
  'scripts/forgeflow/summarize-context-telemetry.js',
  'scripts/forgeflow/update-forgeflow.js',
  'scripts/forgeflow/user-profile.js',
];

const CLAUDE_SOURCE_DIRS = ['agents', 'commands', 'forgeflow-patterns', 'hooks', 'project-rules', 'scripts/forgeflow', 'templates'];
const CODEX_SOURCE_DIRS = ['.codex/agents', '.agents/skills', 'scripts/forgeflow', 'templates', 'forgeflow-patterns', 'services/agent-chat'];

function normalizeTarget(target = 'claude') {
  if (!['claude', 'codex'].includes(target)) throw new Error(`Unsupported runtime target: ${target}`);
  return target;
}

function walk(root, dir, files = []) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return files;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const relativePath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(root, relativePath, files);
    else if (entry.isFile()) files.push(relativePath.replace(/\\/g, '/'));
  }
  return files;
}

function codexSourceAllowed(source) {
  return /^\.codex\/agents\/[^/]+\.toml$/.test(source)
    || /^\.agents\/skills\/[^/]+\/.+/.test(source)
    || (/^(scripts\/forgeflow|templates|forgeflow-patterns|services\/agent-chat)\//.test(source)
      && !source.includes('/node_modules/')
      && !/^scripts\/forgeflow\/test-/.test(source));
}

function managedSources(root, target = 'claude') {
  const normalizedTarget = normalizeTarget(target);
  const dirs = normalizedTarget === 'codex' ? CODEX_SOURCE_DIRS : CLAUDE_SOURCE_DIRS;
  const files = dirs.flatMap((dir) => walk(root, dir));
  if (normalizedTarget === 'codex') {
    if (fs.existsSync(path.join(root, '.codex', 'agent-canonical-map.json'))) files.push('.codex/agent-canonical-map.json');
    return [...new Set(files.filter((source) => codexSourceAllowed(source) || source === '.codex/agent-canonical-map.json'))].sort();
  }
  return [...new Set(files.filter(isManagedSource))].sort();
}

function usage() {
  console.error('Usage: install-manifest.js [--source <path>] [--target claude|codex] [--dest <home>] [--json]');
}

function parseArgs(argv) {
  const opts = {
    source: '',
    home: '',
    target: 'claude',
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--source') {
      opts.source = argv[++i] || '';
    } else if (arg === '--target') {
      opts.target = argv[++i] || '';
    } else if (arg === '--dest') {
      opts.home = argv[++i] || '';
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

  opts.target = normalizeTarget(opts.target);

  return opts;
}

function normalize(file) {
  return String(file || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function hasUnsafePathSegment(file) {
  return normalize(file).split('/').some((segment) => !segment || segment === '..' || segment === '.');
}

function categoryFor(source) {
  const file = normalize(source);
  if (hasUnsafePathSegment(file)) return '';
  if (/^agents\/[^/]+\.md$/.test(file)) return 'agent';
  if (/^agents\/_shared\/[^/]+\.md$/.test(file)) return 'shared-agent';
  if (/^commands\/[^/]+(?:\/[^/]+)?\.md$/.test(file)) return 'command';
  if (/^skills\/[^/]+\/SKILL\.md$/.test(file)) return 'skill';
  if (/^project-rules\/[^/]+\.md$/.test(file)) return 'project-rule';
  if (/^forgeflow-patterns\/[^/]+\.md$/.test(file)) return 'pattern';
  if (STATIC_FILES.has(file)) return file.split('/')[0].slice(0, -1);
  if (/^scripts\/forgeflow\/(?!test-)[^/]+\.(?:js|sh)$/.test(file)) return 'runtime-script';
  if (RUNTIME_HELPERS.includes(file) && SCRIPT_EXTENSIONS.has(path.extname(file))) return 'runtime-script';
  return '';
}

function isManagedSource(source) {
  return categoryFor(source) !== '';
}

function shouldPreserveDestination(source) {
  const file = normalize(source);
  return /^agents\/custom-[^/]+\.md$/.test(file);
}

function destinationFor(source, home = '~/.claude') {
  const file = normalize(source);
  if (!isManagedSource(file)) return '';
  if (/^agents\/[^/]+\.md$/.test(file)) return path.posix.join(home, file);
  if (/^agents\/_shared\/[^/]+\.md$/.test(file)) return path.posix.join(home, file);
  if (/^commands\/[^/]+(?:\/[^/]+)?\.md$/.test(file)) return path.posix.join(home, file);
  if (/^skills\/[^/]+\/SKILL\.md$/.test(file)) return path.posix.join(home, file);
  if (/^project-rules\/[^/]+\.md$/.test(file)) return path.posix.join(home, file);
  if (/^forgeflow-patterns\/[^/]+\.md$/.test(file)) return path.posix.join(home, file);
  if (/^templates\/[^/]+$/.test(file)) return path.posix.join(home, file);
  if (/^hooks\/[^/]+$/.test(file)) return path.posix.join(home, file);
  if (/^scripts\/forgeflow\/[^/]+$/.test(file)) {
    return path.posix.join(home, 'forgeflow', file);
  }
  return '';
}

function codexDestinationFor(source, home = '~/.codex') {
  const file = normalize(source);
  if (/^\.codex\/agents\/[^/]+\.toml$/.test(file)) return path.join(home, 'agents', path.basename(file));
  if (/^\.agents\/skills\/[^/]+\/.+/.test(file)) return path.join(home, 'skills', file.replace(/^\.agents\/skills\//, ''));
  if (file === '.codex/agent-canonical-map.json') return path.join(home, 'forgeflow', 'agent-canonical-map.json');
  if (codexSourceAllowed(file)) return path.join(home, 'forgeflow', file);
  return '';
}

function destinationForTarget(source, home, target = 'claude') {
  return normalizeTarget(target) === 'codex'
    ? codexDestinationFor(source, home)
    : destinationFor(source, home);
}

function assertSafeDestination(destination, home) {
  const root = path.resolve(home);
  const target = path.resolve(destination);
  const relativePath = path.relative(root, target);
  if (relativePath === '' || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Destination escapes runtime home: ${destination}`);
  }
  let current = root;
  for (const segment of relativePath.split(path.sep)) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
      throw new Error(`Refusing symlinked runtime destination path: ${current}`);
    }
    current = path.join(current, segment);
  }
  if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
    throw new Error(`Refusing symlinked runtime destination path: ${current}`);
  }
}

function manifestEntry(source, home = '~/.claude', target = 'claude') {
  const file = normalize(source);
  const normalizedTarget = normalizeTarget(target);
  const category = normalizedTarget === 'codex'
    ? (codexSourceAllowed(file) || file === '.codex/agent-canonical-map.json' ? 'runtime-file' : '')
    : categoryFor(file);
  if (!category) return null;
  return {
    source: file,
    destination: destinationForTarget(file, home, normalizedTarget),
    category,
    preserve: normalizedTarget === 'claude' && shouldPreserveDestination(file),
    executable: normalizedTarget === 'claude'
      ? category === 'runtime-script'
      : file.endsWith('.sh'),
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.source) {
    usage();
    process.exit(2);
  }
  const home = opts.home || (opts.target === 'codex' ? '~/.codex' : '~/.claude');
  const entry = manifestEntry(opts.source, home, opts.target);
  if (!entry) {
    process.exit(1);
  }
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(entry, null, 2)}\n`);
  } else {
    console.log(entry.destination);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  RUNTIME_HELPERS,
  STATIC_FILES,
  assertSafeDestination,
  categoryFor,
  codexDestinationFor,
  codexSourceAllowed,
  destinationFor,
  destinationForTarget,
  hasUnsafePathSegment,
  isManagedSource,
  manifestEntry,
  managedSources,
  normalizeTarget,
  shouldPreserveDestination,
};
