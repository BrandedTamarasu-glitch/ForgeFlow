// Compact metadata only. Procedure bodies are deliberately not imported here.
const DEFINITIONS = [
  ['change-propagation', 'Trace changed concepts through consumers and generated artifacts.', 'coordinator', ['builder', 'designer'], ['plan', 'implement', 'review', 'ship'], 'Shared concepts, schemas, branding or derivatives change.', 'Isolated edits without affected consumers.', 'Source concept and affected consumers', 'Repository search; optional generators', 'low'],
  ['visual-acceptance', 'Check intended layout relationships and accessible interaction.', 'designer', ['product-lead'], ['implement', 'review', 'ship'], 'Layout, typography, themes or interaction change.', 'Nonvisual edits or intentional asymmetry.', 'Affected UI and intended relationships', 'Browser for runtime observations', 'medium'],
  ['persistence-recovery', 'Verify authoritative data survives faults and concurrency.', 'builder', ['guardian', 'verifier'], ['plan', 'implement', 'review'], 'Save, journal, migration or concurrent storage behavior changes.', 'Read-only presentation without persistence effects.', 'State invariants and synthetic data', 'Deterministic storage harness', 'high'],
  ['review-calibration', 'Measure false findings and missed defects against known cases.', 'architect', ['verifier', 'product-lead'], ['research', 'implement', 'review'], 'Review guidance changes or reviewer quality is evaluated.', 'Ordinary application review without calibration scope.', 'Frozen cases and separate answer keys', 'Evaluation harness; model execution for benefit claims', 'high'],
  ['provider-compatibility', 'Verify external contracts, freshness and failure isolation.', 'builder', ['guardian', 'designer'], ['implement', 'review', 'ship'], 'External API/CLI adapters or response contracts change.', 'Internal logic without provider effects.', 'Supported versions and sanitized responses', 'Fixture harness; authorized live access only if required', 'medium'],
  ['release-qualification', 'Verify actual installed or served artifacts and lifecycle behavior.', 'product-lead', ['designer', 'guardian'], ['plan', 'review', 'ship'], 'Installed, packaged or public behavior needs qualification.', 'Source-only work without release verification scope.', 'Artifact identity and target environment', 'Available native or web target', 'high'],
  ['benchmark-verification', 'Verify performance attribution, controls and correctness.', 'builder', ['verifier', 'product-lead'], ['research', 'implement', 'review'], 'Performance or hardware offload claims need evidence.', 'Unrelated edits without a performance objective.', 'Hypothesis, baseline and correctness oracle', 'Benchmark harness and claimed hardware', 'high'],
  ['money-calendar-correctness', 'Check units, conservation, rounding and recurrence policies.', 'builder', ['product-lead', 'guardian'], ['plan', 'implement', 'review'], 'Currency representation, recurrence or calendar arithmetic changes.', 'Spelling or unrelated edits inside a financial project.', 'Units, rounding/date policies and supported ranges', 'Synthetic deterministic test harness', 'medium'],
  ['cad-fabrication-acceptance', 'Separate geometry and slicing checks from physical acceptance.', 'designer', ['builder', 'product-lead'], ['plan', 'implement', 'review'], 'Physical geometry, fit, clearance or retention changes.', 'Logo illustration without physical geometry.', 'Dimensions, assumptions, tolerances and geometry', 'Mesh/slicer tools; physical object for fit claims', 'high'],
];

const CAPABILITIES = Object.freeze(DEFINITIONS.map(([id, summary, owner, handoffs, phases, trigger, exclusion, inputs, prerequisites, cost]) => Object.freeze({
  id, version: 1, summary, owner, handoffs: Object.freeze(handoffs), phases: Object.freeze(phases),
  triggers: Object.freeze([trigger]), exclusions: Object.freeze([exclusion]),
  inputs: Object.freeze(['Objective, acceptance criteria and current source identity', inputs]),
  requires: Object.freeze([]), procedure: `forgeflow-patterns/capability-${id}.md`,
  prerequisites, cost, availability: ['change-propagation', 'visual-acceptance', 'persistence-recovery'].includes(id) ? 'evaluation' : 'planned',
})));

module.exports = { CAPABILITIES };
