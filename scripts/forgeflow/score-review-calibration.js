// Post-review counting of evidence-backed adjudications, not an automatic judge.
const SEVERITIES = ['low', 'medium', 'high', 'critical'];
function scoreReview(input) {
  if (!input || !['fixture', 'actual', 'unobserved'].includes(input.observation) || !['completed', 'failed', 'unobserved'].includes(input.run_status)) throw new Error('Invalid observation or run status');
  if ((input.observation === 'unobserved') !== (input.run_status === 'unobserved')) throw new Error('Observation and run status disagree');
  if (!Array.isArray(input.expected) || !Array.isArray(input.findings)) throw new Error('Expected arrays');
  const expected = new Map();
  const text = value => typeof value === 'string' && value.trim().length > 0;
  for (const defect of input.expected) {
    if (!defect || !text(defect.id) || !SEVERITIES.includes(defect.severity) || expected.has(defect.id)) throw new Error('Invalid or duplicate expected defect');
    expected.set(defect.id, defect.severity);
  }
  const result = { observation: input.observation, run_status: input.run_status, expected_defects: expected.size,
    matched_defects: null, missed_defects: null, false_findings: null, severity_over: null, severity_under: null, unresolved: null, verified_completion: null };
  if (input.run_status !== 'completed') {
    if (input.findings.length) throw new Error('Non-completed runs cannot contain scored findings');
    return result;
  }
  const seen = new Set(), matched = new Set();
  let falseFindings = 0, over = 0, under = 0, unresolved = 0;
  for (const finding of input.findings) {
    if (!finding || !text(finding.id) || seen.has(finding.id) || !text(finding.evidence) || !SEVERITIES.includes(finding.severity) || !['matched', 'false', 'unresolved'].includes(finding.disposition)) throw new Error('Invalid or duplicate adjudicated finding');
    seen.add(finding.id);
    if (finding.disposition === 'matched') {
      if (!expected.has(finding.defect_id) || matched.has(finding.defect_id)) throw new Error('Unknown or duplicate defect match; deduplicate claims before scoring');
      matched.add(finding.defect_id);
      const difference = SEVERITIES.indexOf(finding.severity) - SEVERITIES.indexOf(expected.get(finding.defect_id));
      if (difference > 0) over++;
      if (difference < 0) under++;
    } else {
      if (finding.defect_id !== undefined) throw new Error('Only matched findings may identify a defect');
      if (finding.disposition === 'false') falseFindings++;
      else unresolved++;
    }
  }
  return { ...result, matched_defects: matched.size, missed_defects: unresolved ? null : expected.size - matched.size,
    false_findings: falseFindings, severity_over: over, severity_under: under, unresolved,
    verified_completion: unresolved ? null : matched.size === expected.size && !falseFindings && !over && !under };
}
module.exports = { scoreReview };
