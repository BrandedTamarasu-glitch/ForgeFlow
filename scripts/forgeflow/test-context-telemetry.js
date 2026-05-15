#!/usr/bin/env node
const { contextTelemetry, estimateTokens } = require('./context-telemetry');

const telemetry = contextTelemetry('test', {
  baseline_chars: 400,
  compact_chars: 100,
  detail: { packets: 2 },
});

const checks = [
  ['token estimate rounds up', estimateTokens(5) === 2],
  ['baseline tokens', telemetry.estimated_baseline_tokens === 100],
  ['compact tokens', telemetry.estimated_compact_tokens === 25],
  ['saved tokens', telemetry.estimated_saved_tokens === 75],
  ['percent saved', telemetry.percent_saved === 75],
  ['detail preserved', telemetry.detail.packets === 2],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

if (failed > 0) {
  process.exit(1);
}

console.log('context telemetry: ok');
