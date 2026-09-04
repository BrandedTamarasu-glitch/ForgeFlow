#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { readObservations, buildCommandInterfaceEvidence } = require('./command-interface-evidence');
const { projectLearningId, recordProjectLearning } = require('./record-project-learning');
const { resolvedCandidates } = require('./project-learning-conflicts');
const { assertSafeDirectory, isPathInside, safeReadTextFile, writeFileSafe } = require('./file-safety');

const SOURCE = 'Forgeflow command interface evidence';
const POLICY_FILE = 'command-interface-learning-policy.json';
const ID_RE = /^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*$/;
const PROJECT_DIR_RE = /^[A-Za-z][A-Za-z0-9]*(?:[-_][A-Za-z0-9]+)*$/;

function usage() { console.error('Usage: command-interface-learning.js --input <sanitized.json> [--root <repo>] [--project-dir <dir>] [--candidate-id <id> --write] [--set-suggestions on|off --write-policy] [--json]'); }
function value(argv, name, index) { const next = argv[index + 1] || ''; if (!next || next.startsWith('--')) throw new Error(`Missing value for ${name}`); return next; }
function parseArgs(argv) {
  const opts = { root: process.cwd(), input: '', projectDir: '', candidateId: '', write: false, setSuggestions: '', writePolicy: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') { opts.root = path.resolve(value(argv, arg, i)); i += 1; }
    else if (arg === '--input') { opts.input = path.resolve(value(argv, arg, i)); i += 1; }
    else if (arg === '--project-dir') { opts.projectDir = path.resolve(value(argv, arg, i)); i += 1; }
    else if (arg === '--candidate-id') { opts.candidateId = value(argv, arg, i); i += 1; }
    else if (arg === '--write') opts.write = true;
    else if (arg === '--set-suggestions') { opts.setSuggestions = value(argv, arg, i); i += 1; }
    else if (arg === '--write-policy') opts.writePolicy = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--help' || arg === '-h') { usage(); process.exit(0); }
    else throw new Error(`Unknown argument: ${arg}`);
  }
  opts.projectDir = opts.projectDir || path.join(opts.root, '.forgeflow', path.basename(opts.root));
  if (opts.write && !opts.candidateId) throw new Error('--write requires --candidate-id');
  if (opts.candidateId && !opts.write) throw new Error('--candidate-id requires --write');
  if (opts.setSuggestions && !['on', 'off'].includes(opts.setSuggestions)) throw new Error('--set-suggestions must be on or off');
  if (Boolean(opts.setSuggestions) !== opts.writePolicy) throw new Error('--set-suggestions and --write-policy must be used together');
  if (!opts.setSuggestions && !opts.input) throw new Error('Missing required --input');
  return opts;
}
function safeProjectDir(root, projectDir) {
  const parent = path.join(path.resolve(root), '.forgeflow');
  const resolved = path.resolve(projectDir);
  if (path.dirname(resolved) !== parent || !PROJECT_DIR_RE.test(path.basename(resolved))) throw new Error('Project directory must be a direct .forgeflow project directory inside --root');
  return resolved;
}
function policyPath(projectDir) { return path.join(projectDir, 'context', POLICY_FILE); }
function loadPolicy(projectDir) {
  const file = policyPath(projectDir);
  if (!fs.existsSync(file)) return { suggestions_enabled: true };
  try { const parsed = JSON.parse(safeReadTextFile(file, projectDir).content); return parsed && parsed.schema_version === '1' && typeof parsed.suggestions_enabled === 'boolean' ? parsed : { suggestions_enabled: true }; } catch (_err) { return { suggestions_enabled: true }; }
}
function writePolicy(projectDir, enabled) { const file = policyPath(projectDir); assertSafeDirectory(projectDir); writeFileSafe(file, `${JSON.stringify({ schema_version: '1', suggestions_enabled: enabled }, null, 2)}\n`); return file; }
function hashChain(chain) { return crypto.createHash('sha256').update(chain.join('\n')).digest('hex').slice(0, 16); }
function candidateForFinding(finding) {
  if (finding.status !== 'candidate-for-human-review' || !finding.comparison_required) return null;
  const chain = finding.chain;
  const count = finding.observation_count;
  const workItems = finding.distinct_work_item_count;
  const learning = `A repeated advisory validation pattern uses ${chain.join(' then ')} across ${count} successful observations and ${workItems} work items.`;
  const entry = {
    category: 'validation-pattern', learning, source: SOURCE,
    evidence: `${count} successful aggregate observations across ${workItems} work items.`,
    confidence: 'low', evidence_count: count,
    application_guidance: 'Advisory only: verify the current task and required validation. This does not approve a wrapper or replace validation.',
    status: 'active', conflict_key: `command_chain_${hashChain(chain)}`, conflict_value: 'advisory-preflight-pattern',
  };
  return { id: projectLearningId(entry), entry, chain, observation_count: count, distinct_work_item_count: workItems };
}
function existingById(projectDir) {
  const file = path.join(projectDir, 'project-learning-candidates.jsonl');
  if (!fs.existsSync(file)) return new Map();
  const lines = safeReadTextFile(file, projectDir).content.split(/\r?\n/).filter(Boolean);
  const parsed = lines.flatMap((line) => { try { return [JSON.parse(line)]; } catch (_err) { return []; } });
  return new Map(resolvedCandidates(parsed).map((entry) => [projectLearningId(entry), entry]));
}
function buildLearning(opts) {
  const projectDir = safeProjectDir(opts.root, opts.projectDir);
  if (opts.setSuggestions) return { schema_version: '1', status: 'policy-updated', suggestions_enabled: opts.setSuggestions === 'on', policy_path: writePolicy(projectDir, opts.setSuggestions === 'on'), next: 'run-command-interface-learning-preview', next_reason: 'The local suggestion-display preference was updated.', boundary: 'This changes only suggestion display. It never writes durable project memory.' };
  const policy = loadPolicy(projectDir);
  if (!policy.suggestions_enabled) return { schema_version: '1', status: 'suppressed', suggestion_status: 'suppressed', candidates: [], next: 'enable-command-interface-learning-suggestions', next_reason: 'Project policy suppresses promotion suggestions.', boundary: 'Suppression does not change audit results or write durable memory.' };
  const audit = buildCommandInterfaceEvidence(readObservations(opts.input, opts.root));
  const findings = [...audit.findings, ...(audit.subchain_findings || [])];
  const existing = existingById(projectDir);
  const candidates = findings.map(candidateForFinding).filter(Boolean).map((candidate) => {
    const prior = existing.get(candidate.id);
    return { ...candidate, status: prior ? (prior.status === 'active' ? 'already-recorded' : 'existing-lifecycle') : 'ready-to-write' };
  });
  if (opts.write) {
    const candidate = candidates.find((item) => item.id === opts.candidateId && item.status === 'ready-to-write');
    if (!candidate) throw new Error('Candidate is not eligible for write');
    recordProjectLearning({ projectDir, inputEntries: [candidate.entry] });
    candidate.status = 'written';
  }
  const ready = candidates.filter((item) => item.status === 'ready-to-write').length;
  return { schema_version: '1', status: ready ? 'preview' : 'not-eligible', suggestion_status: ready ? 'preview' : 'not-eligible', candidates, next: ready ? 'review-command-interface-learning-preview' : 'collect-more-sanitized-observations', next_reason: ready ? 'Review the exact candidate ID, then use --candidate-id <id> --write to record durable advisory memory.' : 'No qualifying all-success repeat pattern is ready for durable memory.', boundary: 'Suggestions use aggregate sanitized evidence only. They never read raw output, create wrappers, claim savings, or write durable memory without an exact candidate ID and --write.' };
}
function render(result) { return ['# Forgeflow Command Interface Learning', '', `Status: ${result.status}`, `Suggestion status: ${result.suggestion_status || ''}`, '', '## Candidates', '', ...(result.candidates || []).map((item) => `- ${item.id}: ${item.status}`), '', `Next: ${result.next}`, `Why: ${result.next_reason}`, '', result.boundary, ''].join('\n'); }
function main() { const opts = parseArgs(process.argv.slice(2)); const result = buildLearning(opts); process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : render(result)); }
if (require.main === module) { try { main(); } catch (err) { console.error(err.message); usage(); process.exit(1); } }
module.exports = { buildLearning, candidateForFinding, loadPolicy, parseArgs, render };
