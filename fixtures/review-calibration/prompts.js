// Reviewer input is built solely from the public case; no answer-key import.
const { cases } = require('./inputs.json');
function reviewInput(id) {
  const item = cases.find(entry => entry.id === id);
  if (!item) throw new Error('Unknown review case');
  return `Review this synthetic JavaScript function against its requirement. Each function call is synchronous except the explicit checkpoint; supplied model guarantees define the scope. Report distinct supported defects with mechanism, impact and severity; report uncertainty separately. Do not invent production requirements. Severity: high for shared-state correctness loss, medium for analytics miscounts, low for minor nonblocking issues, critical only for explicitly demonstrated catastrophic impact.\nRequirement: ${item.requirement}\nCode:\n${item.code}`;
}
module.exports = { reviewInput };
