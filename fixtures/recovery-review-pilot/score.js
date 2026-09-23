const { isDeepStrictEqual } = require('node:util');
const { scoreReview } = require('../../scripts/forgeflow/score-review-calibration');
const key = require('./answer-key.json');
// Adjudications must be made after checking each claim against the code/key.
function scoreResponse(caseId, text, adjudications, observation = 'actual') {
  const answer = key.cases[caseId];
  if (!answer) throw new Error('Unknown pilot case');
  const base = { expected: answer.expected.map(({ id, severity }) => ({ id, severity })), observation };
  let response;
  try { response = JSON.parse(text); } catch { response = null; }
  const nonempty = value => typeof value === 'string' && value.trim().length > 0;
  const valid = response && Array.isArray(response.findings) && Array.isArray(response.limitations) && response.limitations.every(nonempty)
    && Object.hasOwn(response, 'reload') && response.findings.every(item => item && nonempty(item.target) && nonempty(item.reason) && ['low', 'medium', 'high', 'critical'].includes(item.severity));
  if (!valid) return { ...scoreReview({ ...base, run_status: 'failed', findings: [] }), valid: false, reload_correct: null };
  if (!Array.isArray(adjudications) || adjudications.length !== response.findings.length) throw new Error('Every finding needs an evidence adjudication');
  const findings = response.findings.map((finding, index) => ({ ...adjudications[index], id: `finding-${index}`, severity: finding.severity }));
  const scored = scoreReview({ ...base, run_status: 'completed', findings });
  const reloadCorrect = isDeepStrictEqual(response.reload, answer.reload);
  return { ...scored, valid: true, reload_correct: reloadCorrect, verified_completion: scored.verified_completion === null ? null : scored.verified_completion && reloadCorrect };
}
module.exports = { scoreResponse };
