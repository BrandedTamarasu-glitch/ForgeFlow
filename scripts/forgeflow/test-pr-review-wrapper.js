#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeflow-wrapper-test-'));
const bin = path.join(root, 'bin');
fs.mkdirSync(bin);
const wrapper = path.resolve(__dirname, '..', 'forgeflow-pr-review.sh');
const verdict = {
  schema_version: '1', verdict: 'APPROVE', summary: 'Fixture approval', routing_mode: 'thin',
  metadata: { cost_estimate_usd: 0.01, duration_seconds: 1 }, files_reviewed: [],
  findings: { blockers: [], must_fix: [], recommended: [], nits: [], boyscout: [] },
  overturned_findings: [],
};
for (const [name, body] of Object.entries({
  claude: `const fs = require('fs');
    process.stdout.write(fs.readFileSync(process.env.FIXTURE_OUTPUT, 'utf8'));
    const auto = process.argv.some(arg => arg.startsWith('/review-auto'));
    process.exit(Number(auto ? process.env.FIXTURE_AUTO_EXIT : process.env.FIXTURE_EXIT));`,
  gh: `const fs = require('fs');
    const file = process.argv[process.argv.indexOf('--body-file') + 1];
    fs.writeFileSync(process.env.FIXTURE_COMMENT, fs.readFileSync(file));
    console.log('https://github.com/example/fixture/issues/1#issuecomment-1');`,
  git: `if (process.argv.includes('--name-only')) console.log('src/fixture.js');
    else if (process.argv.includes('--numstat')) console.log('1\\t0\\tsrc/fixture.js');`,
})) fs.writeFileSync(path.join(bin, name), `#!${process.execPath}\n${body}\n`, { mode: 0o755 });

function run(exit, output, options = {}) {
  const outputFile = path.join(root, 'output');
  const comment = path.join(root, 'comment');
  fs.writeFileSync(outputFile, output);
  fs.rmSync(comment, { force: true });
  const budget = path.join(root, 'budget.yml');
  fs.writeFileSync(budget, `mode: ${options.auto ? 'review-and-fix' : 'review-only'}\n`);
  const result = spawnSync('bash', [wrapper], {
    cwd: root, encoding: 'utf8', timeout: 10000,
    env: {
      ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`,
      GITHUB_PR_NUMBER: '1', GITHUB_REPOSITORY: 'example/fixture',
      ANTHROPIC_API_KEY: 'test-fixture', CLAUDE_CODE_OAUTH_TOKEN: '',
      FORGEFLOW_BUDGET_FILE: budget,
      GITHUB_ACTIONS: 'true', FORGEFLOW_ALLOW_AUTOFIX: options.allowed ? 'true' : 'false',
      FORGEFLOW_MODE_OVERRIDE: '', GITHUB_STEP_SUMMARY: path.join(root, 'summary'),
      FIXTURE_OUTPUT: outputFile, FIXTURE_EXIT: String(exit), FIXTURE_AUTO_EXIT: String(options.autoExit || 0), FIXTURE_COMMENT: comment,
    },
  });
  assert.ifError(result.error);
  return { status: result.status, comment: fs.existsSync(comment) ? fs.readFileSync(comment, 'utf8') : '' };
}

try {
  const valid = `<forgeflow-verdict-json>${JSON.stringify(verdict)}</forgeflow-verdict-json>`;
  const success = run(0, valid);
  assert.equal(success.status, 0);
  assert.match(success.comment, /Forgeflow — APPROVE/);
  const failed = run(1, valid);
  assert.equal(failed.status, 2);
  assert.match(failed.comment, /Wrapper failure/);
  assert.doesNotMatch(failed.comment, /Forgeflow — APPROVE/);
  assert.equal(run(0, 'truncated output').status, 2);
  assert.equal(run(0, valid, { auto: true }).status, 2, 'CI autofix needs separate authorization');
  const conditional = structuredClone(verdict);
  conditional.verdict = 'CONDITIONAL_APPROVE';
  conditional.findings.nits.push({ id: 'N1', title: 'Fixture nit', detail: 'Fixture only', class: 'docs' });
  const autoOutput = `<forgeflow-verdict-json>${JSON.stringify(conditional)}</forgeflow-verdict-json>`;
  assert.equal(run(0, autoOutput, { auto: true, allowed: true, autoExit: 1 }).status, 2, 'failed autofix cannot pass');
  console.log('PR review wrapper: ok');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
