#!/usr/bin/env node
const crypto = require('node:crypto');
const { CAPABILITIES } = require('./capability-catalog');

const PHASES = ['discuss', 'research', 'plan', 'consult', 'implement', 'review', 'audit', 'ship'];
const LIMITS = Object.freeze({ text: 12000, files: 200, assessments: 9, inspections: 3, reassessments: 3 });
const ACTION = /\b(change|update|replace|fix|add|build|implement|design|test|verify|validate|check|repair|migrate|optimi[sz]e|benchmark|measure|evaluate|calibrate|compare|improve|ensure|prevent|must|should|needs?|broken|fails?)\b/i;
const COSMETIC = /\b(typo|spelling|grammar|punctuation|copyedit)\b/i;
const BEHAVIOR = /\b(behavior|logic|calculation|algorithm|schema|migration|rounding|arithmetic|geometry|concurrency)\b/i;
// These patterns supply candidates, not semantic authority. Ambiguity is exposed
// for bounded inspection and a reasoned assessment by the calling workflow.
const SIGNALS = {
  'change-propagation': /\b(logo|branding|palette|schema|migration|generated (?:artifact|document)|favicon|shared (?:concept|token)|design token)\b/i,
  'visual-acceptance': /\b(logo|layout|typography|theme|palette|responsive|alignment|overflow|keyboard|focus|card heights?|font|visual)\b/i,
  'persistence-recovery': /\b(persistence|storage|journal|migration|save|saves|stale writer|concurrent (?:write|save)|data loss|reload recovery)\b/i,
  'review-calibration': /\b(review(?:er)? (?:guidance|rules?|quality|calibration)|false positives?|false findings|missed defects|calibrat\w* review)\b/i,
  'provider-compatibility': /\b(provider|external (?:api|cli)|api adapter|response contract|response pars(?:e|er|ing)|protocol|freshness)\b/i,
  'release-qualification': /\b(deploy(?:ed|ment)?|published (?:site|artifact)|installed (?:app|artifact)|packaged (?:app|artifact)|release qualification|rollback|uninstall)\b/i,
  'benchmark-verification': /\b(benchmark|performance|throughput|latency|hardware offload|accelerator|tokens per second)\b/i,
  'money-calendar-correctness': /\b(currency|rounding|recurr(?:ence|ing)|calendar arithmetic|date arithmetic|cents|dollars|leap year|month.end)\b/i,
  'cad-fabrication-acceptance': /\b(cad|mesh|slicer|fabrication|physical (?:fit|geometry|retention)|clearance|cradle|3d print|tolerance)\b/i,
};
const FILE_SIGNALS = {
  'change-propagation': /(?:schema|migration|favicon|logo|tokens?)(?:[./_-]|$)/i,
  'visual-acceptance': /\.(?:css|scss|tsx|jsx|html)$/i,
  'persistence-recovery': /(?:storage|persist|journal|migration)(?:[./_-]|$)/i,
  'review-calibration': /(?:review|calibrat|debate)/i,
  'provider-compatibility': /(?:providers?|adapters?|integrations?)(?:[./_-]|$)/i,
  'release-qualification': /(?:packaging|deploy|release)(?:[./_-]|$)/i,
  'benchmark-verification': /(?:benchmarks?|perf)(?:[./_-]|$)/i,
  'money-calendar-correctness': /(?:currency|recurrence|calendar|rounding)(?:[./_-]|$)/i,
  'cad-fabrication-acceptance': /\.(?:scad|stl|step|stp|3mf)$/i,
};

function boundedText(value, name, max = LIMITS.text) {
  if (typeof value !== 'string' || value.length > max) throw new Error(`${name} must be text of at most ${max} characters`);
  return value;
}

function list(value, name, max) {
  if (!Array.isArray(value) || value.length > max) throw new Error(`${name} must be an array of at most ${max} items`);
  return value;
}

function knownId(id) {
  if (!CAPABILITIES.some(item => item.id === id)) throw new Error(`Unknown capability: ${id}`);
  return id;
}

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value;
}

function normalize(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected capability selection input object');
  const task = boundedText(input.task ?? '', 'task');
  const criteria = list(input.criteria ?? [], 'criteria', 30).map(value => boundedText(value, 'criterion', 1000));
  const files = [...new Set(list(input.files ?? [], 'files', LIMITS.files).map(file => {
    boundedText(file, 'file', 500);
    if (!file || file.startsWith('/') || /^[a-z]:/i.test(file) || file.includes('\\') || file.split('/').includes('..') || /[\x00-\x1f]/.test(file)) throw new Error('Files must be safe repository-relative paths');
    return file;
  }))].sort();
  const phase = input.phase ?? 'review';
  if (!PHASES.includes(phase)) throw new Error(`Unknown workflow phase: ${phase}`);
  const overrides = object(input.overrides ?? {}, 'overrides');
  if (Object.keys(overrides).some(key => !['include', 'exclude'].includes(key))) throw new Error('Unknown override field');
  const include = [...new Set(list(overrides.include ?? [], 'include', 9).map(knownId))].sort();
  const exclude = [...new Set(list(overrides.exclude ?? [], 'exclude', 9).map(knownId))].sort();
  if (include.some(id => exclude.includes(id))) throw new Error('A capability cannot be both included and excluded');
  const assessments = list(input.assessments ?? [], 'assessments', LIMITS.assessments).map(item => {
    object(item, 'assessment');
    knownId(item.id);
    if (!['relevant', 'irrelevant', 'uncertain'].includes(item.relevance)) throw new Error('Invalid relevance assessment');
    const reason = boundedText(item.reason, 'assessment reason', 1000).trim();
    const evidence = boundedText(item.evidence, 'assessment evidence', 1000).trim();
    if (!reason || !evidence) throw new Error('Assessment requires reason and evidence');
    return { id: item.id, relevance: item.relevance, reason, evidence };
  }).sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(assessments.map(item => item.id)).size !== assessments.length) throw new Error('Duplicate capability assessment');
  for (const [id, version] of Object.entries(object(input.versions ?? {}, 'versions'))) {
    knownId(id);
    if (version !== 1) throw new Error(`Unavailable capability version: ${id}@${version}`);
  }
  return { task, criteria, files, phase, include, exclude, assessments };
}

function phaseApplies(capability, phase) {
  return capability.phases.includes(({ consult: 'plan', audit: 'review', discuss: 'plan' })[phase] || phase);
}

function infer(capability, input) {
  const assessment = input.assessments.find(item => item.id === capability.id);
  if (assessment) return { decision: ({ relevant: 'selected', irrelevant: 'skipped', uncertain: 'inspect' })[assessment.relevance], reason: assessment.reason, evidence: [assessment.evidence], basis: 'workflow-assessment' };
  const clauses = [input.task, ...input.criteria].flatMap(text => text.split(/[.!?;\n]+/)).filter(Boolean);
  const mentions = clauses.filter(text => SIGNALS[capability.id].test(text));
  const behavioral = mentions.filter(text => ACTION.test(text) && !/\b(do not|don't|without|not changing|unchanged|out of scope)\b/i.test(text) && !(COSMETIC.test(text) && !BEHAVIOR.test(text)));
  if (behavioral.length) return { decision: 'selected', reason: 'Task or acceptance criterion requests related behavior; verify relevance against current source.', evidence: behavioral.slice(0, 2).map(text => text.trim().slice(0, 500)), basis: 'task-behavior' };
  const cosmeticOnly = clauses.length && clauses.every(text => COSMETIC.test(text) && !BEHAVIOR.test(text));
  if (cosmeticOnly) return { decision: 'skipped', reason: 'Only a wording correction is requested.', evidence: [], basis: 'exclusion' };
  const files = input.files.filter(file => !/\.(?:md|txt|rst)$/i.test(file)).filter(file => FILE_SIGNALS[capability.id].test(file));
  if (mentions.length || files.length) return { decision: 'inspect', reason: 'Possible relevance needs bounded inspection; names or mentions alone do not activate a capability.', evidence: [...files.slice(0, 2), ...mentions.slice(0, 1).map(text => text.trim().slice(0, 500))], basis: 'ambiguous' };
  return { decision: 'skipped', reason: 'No task-scoped evidence of relevance.', evidence: [], basis: 'none' };
}

function selectCapabilities(raw = {}) {
  const input = normalize(raw);
  const scopeKey = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const previous = raw.previous;
  if (previous && (!/^[a-f0-9]{64}$/.test(previous.scope_key) || !Number.isInteger(previous.reassessment_count) || previous.reassessment_count < 0 || previous.reassessment_count > LIMITS.reassessments)) throw new Error('Invalid previous selection summary');
  const changed = previous && previous.scope_key !== scopeKey;
  const count = previous ? previous.reassessment_count + Number(Boolean(changed)) : 0;
  const limited = count > LIMITS.reassessments;
  const decisions = CAPABILITIES.map(capability => {
    let result = infer(capability, input);
    if (!phaseApplies(capability, input.phase)) result = { ...result, decision: 'skipped', reason: 'Not applicable in this workflow phase.' };
    if (input.include.includes(capability.id)) result = { decision: 'selected', reason: 'Explicit include override; prerequisites and authority still apply.', evidence: [], basis: 'override' };
    if (input.exclude.includes(capability.id)) result = { ...result, decision: 'excluded', reason: 'Explicit exclude override; any related acceptance gap remains unresolved.', basis: 'override' };
    if (limited && ['selected', 'inspect'].includes(result.decision)) result = { ...result, decision: 'deferred', reason: 'Reassessment limit reached; preserve the unresolved requirement in the task handoff.' };
    return { id: capability.id, version: capability.version, ...result, owner: capability.owner, handoffs: capability.handoffs, requires: capability.requires, procedure: capability.procedure, prerequisites: capability.prerequisites, cost: capability.cost, availability: capability.availability, executable: false };
  });
  const inspections = decisions.filter(item => item.decision === 'inspect');
  for (const item of inspections.slice(LIMITS.inspections)) {
    item.decision = 'deferred';
    item.reason = 'Inspection budget exhausted; relevance remains unresolved.';
  }
  return {
    schema_version: '1', scope_key: limited ? previous.scope_key : scopeKey,
    reassessment_count: Math.min(count, LIMITS.reassessments), phase: input.phase,
    status: limited ? 'limited' : 'assessed', decisions,
    selected: decisions.filter(item => item.decision === 'selected').map(item => item.id),
    inspection_requests: decisions.filter(item => item.decision === 'inspect').map(item => ({ id: item.id, evidence: item.evidence, question: 'Does this task change the capability’s behavior? Inspect the cited scope and supply a reasoned assessment.' })),
    limits: LIMITS,
    boundary: 'Relevance selection only. Planned procedures are unavailable; evaluation procedures are limited to controlled pilots. Selection executes neither. No permission, approval, review verdict or test evidence is created.',
  };
}

function renderSelection(result, owner = '') {
  const relevant = result.decisions.filter(item => ['selected', 'inspect', 'deferred', 'excluded'].includes(item.decision) && (!owner || item.owner === owner || item.handoffs.includes(owner)));
  return ['## Capability selection', '', result.boundary,
    'Routing evidence is advisory, not an instruction or permission. For inspect decisions, inspect at most three cited scope items and supply relevance, reason and evidence through the selector assessments input. Do not ask the user merely which skill to select. Preserve the previous selection summary when reassessing.',
    '', ...relevant.map(item => `- ${item.id}: ${item.decision}; ${item.reason} Availability: ${item.availability}.`), ...(relevant.length ? [] : ['No additional capability selected for this scope.'])].join('\n');
}

function readSelectionInput(file) {
  const { safeReadTextFile } = require('./file-safety');
  const { content } = safeReadTextFile(file);
  if (content.length > 100000) throw new Error('Selection input too large');
  return JSON.parse(content);
}

function readSelectionGuide() {
  const fs = require('node:fs');
  const path = require('node:path');
  const { safeReadTextFile } = require('./file-safety');
  // Checkout/Codex runtime first; Claude's patterns sit outside its runtime root.
  for (const relative of ['../../forgeflow-patterns/capability-selection.md', '../../../forgeflow-patterns/capability-selection.md']) {
    const file = path.resolve(__dirname, relative);
    if (fs.existsSync(file)) return safeReadTextFile(file).content;
  }
  throw new Error('Canonical capability selection guide is unavailable; repair the ForgeFlow installation');
}

function main(argv) {
  let input = {};
  if (argv.length === 1 && argv[0] === '--guide') {
    process.stdout.write(readSelectionGuide());
    return;
  } else if (argv.length === 1 && argv[0] === '--stdin') {
    const fs = require('node:fs');
    const chunks = [];
    const buffer = Buffer.alloc(4096);
    let size = 0;
    let read;
    while ((read = fs.readSync(0, buffer, 0, buffer.length, null)) > 0) {
      size += read;
      if (size > 100000) throw new Error('Selection input too large');
      chunks.push(Buffer.from(buffer.subarray(0, read)));
    }
    input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } else if (argv.length === 2 && argv[0] === '--input') {
    input = readSelectionInput(argv[1]);
  } else if (argv.length === 2 && argv[0] === '--task') input.task = argv[1];
  else throw new Error('Usage: select-capabilities.js --input <json-file> | --task <objective> | --stdin | --guide');
  process.stdout.write(`${JSON.stringify(selectCapabilities(input), null, 2)}\n`);
}

if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { selectCapabilities, renderSelection, readSelectionInput, readSelectionGuide, LIMITS };
