const fs = require('fs');
const path = require('path');

function estimateTokens(chars) {
  const count = Number.isFinite(chars) ? Math.max(0, chars) : 0;
  return Math.ceil(count / 4);
}

function fileChars(file) {
  try {
    return fs.statSync(file).size;
  } catch (_err) {
    return 0;
  }
}

function textChars(value) {
  return String(value || '').length;
}

function sum(values) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

function percentSaved(baselineChars, compactChars) {
  if (!baselineChars || baselineChars <= 0) return 0;
  const saved = Math.max(0, baselineChars - compactChars);
  return Number(((saved / baselineChars) * 100).toFixed(2));
}

function contextTelemetry(kind, values) {
  const baselineChars = Math.max(0, values.baseline_chars || 0);
  const compactChars = Math.max(0, values.compact_chars || 0);
  return {
    schema_version: '1',
    kind,
    generated_at: new Date().toISOString(),
    baseline_chars: baselineChars,
    compact_chars: compactChars,
    saved_chars: Math.max(0, baselineChars - compactChars),
    estimated_baseline_tokens: estimateTokens(baselineChars),
    estimated_compact_tokens: estimateTokens(compactChars),
    estimated_saved_tokens: Math.max(0, estimateTokens(baselineChars) - estimateTokens(compactChars)),
    percent_saved: percentSaved(baselineChars, compactChars),
    detail: values.detail || {},
  };
}

function writeTelemetry(file, telemetry) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(telemetry, null, 2)}\n`);
}

module.exports = {
  contextTelemetry,
  estimateTokens,
  fileChars,
  sum,
  textChars,
  writeTelemetry,
};
