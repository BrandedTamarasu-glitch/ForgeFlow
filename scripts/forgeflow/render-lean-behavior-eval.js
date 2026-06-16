#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { safeReadTextFile } = require('./file-safety');

const PROBES = [
  'calibration-boundary',
  'requested-explanation',
  'one-runnable-check',
  'no-new-dependency',
  'stdlib-native-first',
  'explicit-requirement-preserved',
];

function usage() {
  console.error('Usage: render-lean-behavior-eval.js [--root <repo>] [--file <path> | --text <text>] [--requested-explanation] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), file: '', text: '', requestedExplanation: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--file') {
      opts.file = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--text') {
      opts.text = requireValue(argv, arg, i);
      i += 1;
    } else if (arg === '--requested-explanation') {
      opts.requestedExplanation = true;
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

function readInput(opts) {
  if (opts.text) return opts.text;
  if (opts.file) return safeReadTextFile(opts.file, opts.root).content;
  return '';
}

function words(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean);
}

function hasHardwareSignal(text) {
  return /\b(sensor|clock|timer|servo|pwm|adc|thermistor|temperature|hardware|robot|motor|drift|calibration|tolerance|offset)\b/i.test(text);
}

function hasCalibrationSignal(text) {
  return /\b(calibrat(?:e|ion)|drift|tolerance|offset|trim|tuning|knob|reference\s+(?:value|sensor|thermometer|clock)|measure your own|per[- ](?:unit|part|device)|reads off)\b/i.test(text);
}

function hasRunnableCheck(text) {
  return /\b(assert|console\.assert|def\s+test_|it\(|describe\(|expect\(|pytest|unittest|if\s+__name__\s*==|node\s+--test|npm\s+test)\b/i.test(text);
}

function hasNonTrivialLogic(text) {
  return /\b(if|else|for|while|switch|case|try|catch|function|=>|def\s+|class\s+|parse|validate|rate limit|money|auth|permission)\b/i.test(text);
}

function newDependencySignal(text) {
  return /\b(npm\s+install|yarn\s+add|pnpm\s+add|pip\s+install|cargo\s+add|go\s+get)\b|^\+\s*"[^"]+"\s*:\s*"[^"]+"/mi.test(text);
}

function stdlibNativeSignal(text) {
  return /\b(stdlib|standard library|native|platform feature|built[- ]in|already-installed|existing dependency|project pattern|reuse)\b/i.test(text);
}

function explicitRequirementRisk(text) {
  return /\b(skip(?:ped)?|omit(?:ted)?|removed?|defer(?:red)?)\b.{0,60}\b(explicit|required|requirement|asked|requested|acceptance)\b/i.test(text)
    || /\b(explicit|required|requirement|asked|requested|acceptance)\b.{0,60}\b(skip(?:ped)?|omit(?:ted)?|removed?|defer(?:red)?)\b/i.test(text);
}

function probeCalibration(text) {
  if (!hasHardwareSignal(text)) return { status: 'skip', reason: 'No hardware, sensor, clock, or calibration signal found.' };
  if (hasCalibrationSignal(text)) return { status: 'pass', reason: 'Hardware or physical-world signal keeps calibration, drift, tolerance, or tuning evidence.' };
  return { status: 'fail', reason: 'Hardware or physical-world signal appears without a calibration/drift/tolerance boundary.' };
}

function probeRequestedExplanation(text, requested) {
  if (!requested) return { status: 'skip', reason: 'No requested-explanation probe flag supplied.' };
  const count = words(text).length;
  const structured = /(^|\n)\s*(?:[-*]|\d+\.)\s+/.test(text) || /\b(because|why|so that|tradeoff|replaced|removed|inlined|renamed)\b/i.test(text);
  if (count >= 45 && structured) return { status: 'pass', reason: `Requested explanation is substantive (${count} words).` };
  return { status: 'fail', reason: `Requested explanation appears over-trimmed (${count} words).` };
}

function probeOneCheck(text) {
  if (!hasNonTrivialLogic(text)) return { status: 'skip', reason: 'No non-trivial logic signal found.' };
  if (hasRunnableCheck(text)) return { status: 'pass', reason: 'Non-trivial logic includes one runnable check signal.' };
  return { status: 'fail', reason: 'Non-trivial logic lacks a runnable check signal.' };
}

function probeNoNewDependency(text) {
  if (!newDependencySignal(text)) return { status: 'pass', reason: 'No new dependency installation or manifest addition signal found.' };
  if (stdlibNativeSignal(text)) return { status: 'warn', reason: 'New dependency signal found; output also mentions reuse/native/stdlib justification.' };
  return { status: 'fail', reason: 'New dependency signal found without stdlib/native/existing-dependency justification.' };
}

function probeStdlibNative(text) {
  if (stdlibNativeSignal(text)) return { status: 'pass', reason: 'Output mentions stdlib, native, installed dependency, or project-pattern reuse.' };
  return { status: 'warn', reason: 'No stdlib/native/reuse check is visible in the output.' };
}

function probeExplicitRequirement(text) {
  if (explicitRequirementRisk(text)) return { status: 'fail', reason: 'Output appears to skip, remove, or defer an explicit requirement.' };
  return { status: 'pass', reason: 'No skipped explicit requirement signal found.' };
}

function evaluateLeanBehavior(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const text = opts.text ?? readInput({ ...opts, root });
  const probes = {
    'calibration-boundary': probeCalibration(text),
    'requested-explanation': probeRequestedExplanation(text, Boolean(opts.requestedExplanation)),
    'one-runnable-check': probeOneCheck(text),
    'no-new-dependency': probeNoNewDependency(text),
    'stdlib-native-first': probeStdlibNative(text),
    'explicit-requirement-preserved': probeExplicitRequirement(text),
  };
  const failures = Object.values(probes).filter((item) => item.status === 'fail').length;
  const warnings = Object.values(probes).filter((item) => item.status === 'warn').length;
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    status: failures ? 'fail' : (warnings ? 'warn' : 'pass'),
    root,
    source: opts.file ? path.resolve(opts.file) : (opts.text ? 'inline-text' : 'empty'),
    probes,
    summary: { probes: PROBES.length, failures, warnings },
    next: failures ? 'Fix failed lean behavior probes before relying on this output.' : 'Lean behavior probes are advisory; verify current code and focused validation.',
    boundary: 'Lean behavior evaluation is read-only. It does not run generated code, call models, edit files, mutate context, or prove functional correctness.',
  };
}

function renderMarkdown(result) {
  const lines = [
    '# Forgeflow Lean Behavior Eval',
    '',
    `Status: ${result.status}`,
    `Source: ${result.source}`,
    '',
    result.boundary,
    '',
    '## Probes',
    '',
  ];
  for (const name of PROBES) {
    const probe = result.probes[name];
    lines.push(`- ${probe.status}: ${name} - ${probe.reason}`);
  }
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = evaluateLeanBehavior(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
    if (result.status === 'fail') process.exit(1);
  } catch (err) {
    console.error(`lean behavior eval failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  PROBES,
  evaluateLeanBehavior,
  parseArgs,
  renderMarkdown,
};
