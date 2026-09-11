#!/usr/bin/env node
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildStub, MISSING_SUMMARY_GUIDANCE, selectedMarkdown } = require('./generate-codex-agent-stubs');

const repoRoot = path.resolve(__dirname, '..', '..');
const map = JSON.parse(fs.readFileSync(path.join(repoRoot, 'fixtures/prompt-parity/source-map.json'), 'utf8'));
const agent = '.codex/agents/sample-reviewer.toml';
const markdown = fs.readFileSync(path.join(repoRoot, map.agents[agent].canonical), 'utf8');
const selected = selectedMarkdown(markdown, map.agents[agent].sections);
const stub = buildStub(agent, map.agents[agent]);
const fallbackStub = buildStub('.codex/agents/fallback-reviewer.toml', {
  canonical: map.agents[agent].canonical,
  sections: [],
});
const explicitStub = buildStub(agent, {
  ...map.agents[agent],
  model: 'account-supported-model',
  model_reasoning_effort: 'high',
});

const checks = [
  ['default inherits model', !/^model\s*=/m.test(stub)],
  ['default inherits reasoning', !/^model_reasoning_effort\s*=/m.test(stub)],
  ['explicit model retained', explicitStub.includes('model = "account-supported-model"')],
  ['explicit reasoning retained', explicitStub.includes('model_reasoning_effort = "high"')],
  ['role selected', selected.includes('<role>')],
  ['review section selected', selected.includes('## Mode: Review')],
  ['manual summary included', stub.includes('Review concrete correctness and accessibility evidence.')],
  ['canonical source excluded from runtime role', !stub.includes('canonical_source =')],
  ['canonical hash excluded from runtime role', !stub.includes('canonical_sha256 =')],
  ['instructions included', stub.includes('Canonical excerpts for manual review')],
  ['fallback embeds canonical behavior', fallbackStub.includes('## Mode: Review')],
  ['Codex runtime adapter included', fallbackStub.includes('Codex runtime adapter:')],
  ['fallback has no vague todo', !fallbackStub.includes('TODO: Add a manually curated Codex summary')],
];

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-agent-stub-'));
const script = path.join(__dirname, 'generate-codex-agent-stubs.js');
const usage = 'Usage: generate-codex-agent-stubs.js';

function run(args, cwd) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
  if (result.error) throw result.error;
  return result;
}

function fixture(label, fixtureMap = map, mapName = 'map.json') {
  const cwd = fs.mkdtempSync(path.join(tmpDir, `${label}-`));
  const mapPath = path.join(cwd, mapName);
  fs.writeFileSync(mapPath, `${JSON.stringify(fixtureMap, null, 2)}\n`);
  return { cwd, mapPath };
}

function snapshot(dir) {
  return fs.readdirSync(dir).sort().map((name) => {
    const file = path.join(dir, name);
    return [name, fs.statSync(file).isDirectory() ? snapshot(file) : fs.readFileSync(file).toString('hex')];
  });
}

function expectMissing(label, args, option, cwd) {
  const before = JSON.stringify(snapshot(cwd));
  const result = run(args, cwd);
  const valid = result.status === 2 && result.stdout === ''
    && result.stderr.split(/\r?\n/).includes(`Missing value for ${option}`)
    && result.stderr.includes(usage);
  const actual = { status: result.status, stdout: result.stdout, stderr: result.stderr };
  checks.push([`${label}: parser rejection${valid ? '' : ` (actual ${JSON.stringify(actual)})`}`, valid]);
  checks.push([`${label}: no new paths or changed bytes`, JSON.stringify(snapshot(cwd)) === before]);
}

try {
  const invalidValues = [
    ['omitted', []], ['empty', ['']],
    ...['--agent', '--map', '--out', '--stdout', '--all', '--help', '-h', '--unknown-option']
      .map((value) => [value, [value]]),
  ];
  for (const option of ['--agent', '--map', '--out']) {
    for (const [label, values] of invalidValues) {
      const { cwd, mapPath } = fixture('missing');
      fs.writeFileSync(path.join(cwd, '--stdout'), 'existing stdout-named output\n');
      fs.writeFileSync(path.join(cwd, 'output.toml'), 'existing output\n');
      expectMissing(`${option} ${label}`, ['--map', mapPath, '--agent', agent, option, ...values], option, cwd);
    }
  }

  // Reproduce both creation and overwrite risks with the reported argv order.
  for (const seeded of [false, true]) {
    const { cwd, mapPath } = fixture('reproduction');
    if (seeded) fs.writeFileSync(path.join(cwd, '--stdout'), 'preserve these bytes\n');
    expectMissing(`reproduction seeded=${seeded}`,
      ['--map', mapPath, '--agent', agent, '--out', '--stdout'], '--out', cwd);
  }

  for (const option of ['--agent', '--map', '--out']) {
    const { cwd, mapPath } = fixture('explicit-output');
    fs.writeFileSync(path.join(cwd, 'output.toml'), 'preserve explicit output\n');
    expectMissing(`explicit output before ${option}`,
      ['--map', mapPath, '--agent', agent, '--out', 'output.toml', option], option, cwd);

    const bulk = fixture('malformed-bulk', { version: 1, agents: {} });
    const bulkAgent = path.join(bulk.cwd, 'bulk.toml');
    fs.writeFileSync(bulkAgent, 'preserve bulk output\n');
    fs.writeFileSync(bulk.mapPath, JSON.stringify({ version: 1, agents: { [bulkAgent]: map.agents[agent] } }));
    expectMissing(`bulk before ${option}`, ['--map', bulk.mapPath, '--all', option], option, bulk.cwd);
  }

  for (const [label, extra, writesFile, prints] of [
    ['implicit stdout', [], false, true],
    ['explicit stdout', ['--stdout'], false, true],
    ['file', ['--out', 'output.toml'], true, false],
    ['file and stdout', ['--out', 'output.toml', '--stdout'], true, true],
  ]) {
    const { cwd, mapPath } = fixture('success');
    const result = run(['--map', mapPath, '--agent', agent, ...extra], cwd);
    checks.push([`${label}: status and stderr`, result.status === 0 && result.stderr === '']);
    checks.push([`${label}: exact stdout`, result.stdout === (prints ? stub : '')]);
    const outFile = path.join(cwd, 'output.toml');
    checks.push([`${label}: exact file`, writesFile
      ? fs.existsSync(outFile) && fs.readFileSync(outFile, 'utf8') === stub : !fs.existsSync(outFile)]);
  }

  // Exercise each value-taking option, including whitespace-only values.
  for (const option of ['--agent', '--map', '--out']) {
    for (const value of ['-filename', './--stdout', ' ']) {
      const testAgent = option === '--agent' ? value : agent;
      const testMap = { version: 1, agents: { [testAgent]: map.agents[agent] } };
      const { cwd, mapPath } = fixture('valid-boundary', testMap, option === '--map' ? value : 'map.json');
      const out = option === '--out' ? value : 'output.toml';
      const expected = buildStub(testAgent, testMap.agents[testAgent]);
      const mapBefore = fs.readFileSync(mapPath);
      const result = run(['--map', option === '--map' ? value : mapPath, '--agent', testAgent, '--out', out, '--stdout'], cwd);
      checks.push([`${option} ${JSON.stringify(value)}: valid exact output`, result.status === 0
        && result.stderr === '' && result.stdout === expected
        && fs.existsSync(path.join(cwd, out)) && fs.readFileSync(path.join(cwd, out), 'utf8') === expected]);
      checks.push([`${option} ${JSON.stringify(value)}: map unchanged`, fs.readFileSync(mapPath).equals(mapBefore)]);
    }
  }

  const bulk = fixture('valid-bulk', { version: 1, agents: {} });
  const bulkMap = { version: 1, agents: {
    [path.join(bulk.cwd, 'one.toml')]: { ...map.agents[agent] },
    [path.join(bulk.cwd, 'nested', 'two.toml')]: { ...map.agents[agent], sections: [] },
  } };
  fs.writeFileSync(bulk.mapPath, JSON.stringify(bulkMap));
  const expectedStubs = Object.entries(bulkMap.agents).map(([key, entry]) => [key, buildStub(key, entry)]);
  const result = run(['--map', bulk.mapPath, '--all'], bulk.cwd);
  checks.push(['bulk: status and streams', result.status === 0 && result.stdout === '' && result.stderr === '']);
  for (const [key, expected] of expectedStubs) {
    checks.push([`bulk: exact ${path.basename(key)}`, fs.existsSync(key) && fs.readFileSync(key, 'utf8') === expected]);
    bulkMap.agents[key].sha256 = crypto.createHash('sha256').update(markdown).digest('hex');
  }
  checks.push(['bulk: exact updated map', fs.readFileSync(bulk.mapPath, 'utf8') === `${JSON.stringify(bulkMap, null, 2)}\n`]);
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// Production debate roles must regenerate specialized instructions, not the
// ordinary review template, while retaining the shared writing rules.
const productionMap = JSON.parse(fs.readFileSync(path.join(repoRoot, '.codex/agent-canonical-map.json'), 'utf8'));
for (const [name, label, behavior] of [
  ['architect-debate-judge', 'Debate judging', 'For an interim verdict'],
  ['product-lead-debate-validator', 'Debate validation', 'finding-by-finding comparison'],
]) {
  const key = `.codex/agents/${name}.toml`;
  const generated = buildStub(key, productionMap.agents[key]);
  checks.push([`${name}: debate activity`, generated.includes(label)]);
  checks.push([`${name}: specialized behavior`, generated.includes(behavior)]);
  checks.push([`${name}: key isolation`, generated.includes('hidden answer key')]);
  checks.push([`${name}: writing rules`, generated.includes('Never use a long word where a short one will do.')]);
  checks.push([`${name}: excludes ordinary template`, !generated.includes('## Pre-Implementation Gate') && !generated.includes('## Mode: Review')]);
  checks.push([`${name}: committed generation matches`, generated === fs.readFileSync(path.join(repoRoot, key), 'utf8')]);
}

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length > 0) {
  console.error(`codex agent stub test failed (${failed.length}/${checks.length} checks):\n${failed.join('\n')}`);
  process.exit(1);
}

console.log('codex agent stub: ok');
