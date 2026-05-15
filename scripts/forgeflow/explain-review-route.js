#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function usage() {
  console.error('Usage: explain-review-route.js [--json] [--files <path>] [--lines <n>] [--mode skip|thin|full|deep] [--calibration <path>] [--ci]');
}

function parseArgs(argv) {
  const opts = {
    json: false,
    filesPath: '',
    linesChanged: null,
    modeOverride: '',
    calibrationPath: '',
    ci: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--ci') {
      opts.ci = true;
    } else if (arg === '--files') {
      opts.filesPath = argv[++i] || '';
    } else if (arg === '--lines') {
      opts.linesChanged = Number.parseInt(argv[++i] || '0', 10);
    } else if (arg === '--mode') {
      opts.modeOverride = argv[++i] || '';
    } else if (arg === '--calibration') {
      opts.calibrationPath = argv[++i] || '';
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      usage();
      process.exit(2);
    }
  }

  if (opts.modeOverride && !['skip', 'thin', 'full', 'deep'].includes(opts.modeOverride)) {
    console.error(`Invalid --mode: ${opts.modeOverride}`);
    process.exit(2);
  }

  return opts;
}

function readFiles(opts) {
  if (opts.filesPath) {
    return fs.readFileSync(opts.filesPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  const output = runGit(['diff', '--name-only', 'HEAD'])
    .concat(runGit(['diff', '--name-only', '--cached']))
    .concat(runGit(['ls-files', '--others', '--exclude-standard']));

  return [...new Set(output)].sort();
}

function runGit(args) {
  const { spawnSync } = require('child_process');
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    return [];
  }
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function countChangedLines(filesPath) {
  if (filesPath) {
    return null;
  }

  const { spawnSync } = require('child_process');
  const result = spawnSync('git', ['diff', '--numstat', 'HEAD'], { encoding: 'utf8' });
  if (result.status !== 0) {
    return null;
  }

  return result.stdout.split(/\r?\n/).reduce((sum, line) => {
    const [added, deleted] = line.split(/\s+/);
    const add = Number.parseInt(added, 10);
    const del = Number.parseInt(deleted, 10);
    return sum + (Number.isFinite(add) ? add : 0) + (Number.isFinite(del) ? del : 0);
  }, 0);
}

function readCalibration(opts) {
  if (opts.calibration) {
    return opts.calibration;
  }
  if (!opts.calibrationPath) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(opts.calibrationPath, 'utf8'));
  } catch (err) {
    console.error(`Unable to read calibration summary: ${err.message}`);
    process.exit(2);
  }
}

function isDoc(file) {
  const lower = file.toLowerCase();
  return lower.startsWith('docs/')
    || lower.startsWith('.forgeflow/')
    || lower === 'readme.md'
    || /^readme(\.|$)/i.test(path.basename(file))
    || /\.(md|mdx|txt|rst)$/.test(lower);
}

function isSourcePath(file) {
  return /(^|\/)(src|lib|apps|packages\/[^/]+\/src)\//.test(file);
}

function isTest(file) {
  return /(^|\/)(__tests__|tests|e2e)\//.test(file)
    || /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(file);
}

function isFrontend(file) {
  return /\.(tsx|jsx|vue|svelte|css|scss)$/.test(file)
    || /(^|\/)(components|pages|app|frontend|ui)\//.test(file);
}

function isHighRisk(file) {
  const lower = file.toLowerCase();
  return /(^|\/)(migrations?|schema)\//.test(lower)
    || lower.endsWith('.sql')
    || /(^|\/)(auth|passport|session|oauth|login|token|crypto|jwt|password|permission|rbac)[^/]*\.(ts|tsx|js|jsx|sql|md)$/.test(lower)
    || /(csp|cors|cookie).*\.(ts|tsx|js|jsx|json|md)$/.test(lower);
}

function normalize(value) {
  return String(value || 'unknown').trim().toLowerCase().replace(/\s+/g, '-');
}

function findingClassesForFile(file) {
  const lower = file.toLowerCase();
  const classes = new Set();
  if (/auth|passport|session|oauth|login|token|crypto|jwt|password|permission|rbac/.test(lower)) {
    classes.add('auth/session/permissions');
  }
  if (/(^|\/)(migrations?|schema)\//.test(lower) || lower.endsWith('.sql')) {
    classes.add('migration/schema/data-loss');
  }
  if (isFrontend(file)) {
    classes.add('accessibility');
  }
  if (/\/(api|routes|controllers|services?|clients?|integrations?)\//.test(lower)
    || /(api|client|service|integration)\.(ts|tsx|js|jsx)$/.test(lower)) {
    classes.add('ux/connectivity');
  }
  return [...classes].sort();
}

function bucketTotal(bucket) {
  return (bucket.verified || 0)
    + (bucket.overturned || 0)
    + (bucket.auto_fix_applied || 0)
    + (bucket.auto_fix_failed || 0);
}

function buildTelemetryHints(files, calibration) {
  if (!calibration || !calibration.classes) {
    return [];
  }

  const seenClasses = [...new Set(files.flatMap(findingClassesForFile))].sort();
  const hints = [];
  for (const findingClass of seenClasses) {
    const bucket = calibration.classes[normalize(findingClass)];
    if (!bucket) continue;
    const total = bucketTotal(bucket);
    if (total < 3) {
      hints.push({
        type: 'insufficient-history',
        class: findingClass,
        evidence: `only ${total} calibration events`,
        action: 'do-not-change-route',
      });
      continue;
    }

    const noisy = (bucket.rejected || 0) + (bucket.overturned || 0);
    const confirmed = (bucket.confirmed || 0) + (bucket.auto_fix_applied || 0);
    if (noisy >= 2) {
      hints.push({
        type: 'noisy-class',
        class: findingClass,
        evidence: `${noisy} rejected-or-overturned findings across ${total} events`,
        action: 'require-aegis',
      });
    } else if (confirmed >= 2) {
      hints.push({
        type: 'high-value-class',
        class: findingClass,
        evidence: `${confirmed} confirmed-or-fixed findings across ${total} events`,
        action: 'keep-or-expand-specialist-coverage',
      });
    }
  }
  return hints;
}

function classify(files, opts) {
  const linesChanged = opts.linesChanged ?? countChangedLines(opts.filesPath) ?? 0;
  const uniqueFiles = [...new Set(files)].sort();
  const calibration = readCalibration(opts);
  const reasons = [];
  const includedAgents = [];
  const skippedAgents = [];
  let mode = 'full-mode';
  let routingOverride = null;
  let verifier = 'not-required';

  if (opts.modeOverride) {
    mode = `${opts.modeOverride}-mode`;
    routingOverride = 'user-mode';
    reasons.push(`user override selected ${mode}`);
  } else if (uniqueFiles.length === 0) {
    mode = 'skip-mode';
    reasons.push('no changed files found');
  } else if (uniqueFiles.some((file) => isHighRisk(file) && !isTest(file))) {
    mode = 'deep-mode';
    verifier = 'required';
    reasons.push('high-risk path matched auth/session/permissions/crypto/migration/schema rules');
  } else if (uniqueFiles.every((file) => isDoc(file) && !isSourcePath(file)) && linesChanged <= 200) {
    mode = 'skip-mode';
    reasons.push('docs-only change under 200 changed lines');
  } else if (uniqueFiles.every(isTest)) {
    mode = 'thin-mode';
    reasons.push('test-only change');
  } else if (uniqueFiles.length <= 2 && linesChanged <= 50 && !uniqueFiles.some(isFrontend)) {
    mode = 'thin-mode';
    reasons.push('small low-risk non-frontend change');
  } else {
    mode = 'full-mode';
    reasons.push('default full review');
  }

  if (opts.ci && !routingOverride && mode === 'full-mode') {
    mode = 'thin-mode';
    routingOverride = 'ci-cap';
    reasons.push('CI cap downgraded full-mode to thin-mode');
  }

  const telemetryHints = buildTelemetryHints(uniqueFiles, calibration);
  const noisyClasses = telemetryHints.filter((hint) => hint.type === 'noisy-class');
  if (noisyClasses.length > 0 && mode !== 'skip-mode' && verifier !== 'required') {
    verifier = 'required';
    reasons.push(`calibration requires Aegis for noisy class: ${noisyClasses.map((hint) => hint.class).join(', ')}`);
  }

  if (mode === 'skip-mode') {
    skippedAgents.push('smith_reviewer', 'warden_reviewer', 'lumen_reviewer', 'atlas_reviewer', 'aegis');
  } else if (mode === 'thin-mode') {
    includedAgents.push('smith_reviewer', 'warden_reviewer');
    skippedAgents.push('lumen_reviewer', 'atlas_reviewer');
  } else {
    includedAgents.push('smith_reviewer', 'warden_reviewer', 'lumen_reviewer', 'atlas_reviewer');
  }

  const serviceBoundaryHint = telemetryHints.find((hint) => hint.type === 'high-value-class' && hint.class === 'ux/connectivity');
  if (serviceBoundaryHint && mode === 'thin-mode' && !includedAgents.includes('lumen_reviewer')) {
    includedAgents.push('lumen_reviewer');
    const skippedIndex = skippedAgents.indexOf('lumen_reviewer');
    if (skippedIndex !== -1) skippedAgents.splice(skippedIndex, 1);
    reasons.push('calibration keeps Lumen on service-boundary diffs with UX/connectivity history');
  }

  if (verifier === 'required' && mode !== 'skip-mode') {
    includedAgents.push('aegis');
  } else if (!skippedAgents.includes('aegis')) {
    skippedAgents.push('aegis');
  }

  const highRiskFiles = uniqueFiles.filter((file) => isHighRisk(file) && !isTest(file));
  const frontendFiles = uniqueFiles.filter(isFrontend);

  return {
    schema_version: '1',
    mode,
    routing_override: routingOverride,
    file_count: uniqueFiles.length,
    lines_changed: linesChanged,
    files: uniqueFiles,
    triggers: {
      high_risk_files: highRiskFiles,
      frontend_files: frontendFiles,
    },
    telemetry_hints: telemetryHints,
    agents: {
      included: [...new Set(includedAgents)],
      skipped: [...new Set(skippedAgents)],
    },
    verifier,
    reasons,
    cost_coverage_tradeoff: describeTradeoff(mode, verifier),
  };
}

function describeTradeoff(mode, verifier) {
  if (mode === 'skip-mode') {
    return 'No Forgeflow cost; only appropriate when no code review surface is present.';
  }
  if (mode === 'thin-mode') {
    return 'Lower cost and faster feedback; limited UX/product coverage.';
  }
  if (mode === 'deep-mode') {
    return 'Highest coverage for high-risk surfaces; slower and more expensive.';
  }
  if (verifier === 'required') {
    return 'Standard Forgeflow plus neutral verification for high-risk claims.';
  }
  return 'Standard multi-agent coverage with balanced cost.';
}

function printHuman(route) {
  console.log(`Route: ${route.mode}`);
  console.log(`Files: ${route.file_count}; changed lines: ${route.lines_changed}`);
  console.log(`Agents included: ${route.agents.included.join(', ') || 'none'}`);
  console.log(`Agents skipped: ${route.agents.skipped.join(', ') || 'none'}`);
  console.log(`Verifier: ${route.verifier}`);
  if (route.telemetry_hints.length > 0) {
    console.log(`Telemetry: ${route.telemetry_hints.map((hint) => `${hint.type}:${hint.class}`).join(', ')}`);
  }
  console.log(`Why: ${route.reasons.join('; ')}`);
  console.log(`Tradeoff: ${route.cost_coverage_tradeoff}`);
}

if (require.main === module) {
  const opts = parseArgs(process.argv.slice(2));
  const route = classify(readFiles(opts), opts);
  if (opts.json) {
    console.log(JSON.stringify(route, null, 2));
  } else {
    printHuman(route);
  }
}

module.exports = {
  classify,
  parseArgs,
  readCalibration,
  readFiles,
};
