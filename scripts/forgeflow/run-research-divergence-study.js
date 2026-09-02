#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { buildStudy } = require('./render-research-divergence-study');

const RUN_GATE = 'FORGEFLOW_RESEARCH_DIVERGENCE_STUDY_RUN';

function parseArgs(argv) {
  const options = { run: false, pilot: false, json: false, seed: 'forgeflow-study-v1' };
  const valued = new Set(['--runner', '--study-dir', '--iterations', '--max-runs', '--seed', '--repo']);
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--run' || arg === '--pilot' || arg === '--json') {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      if (seen.has(arg)) throw new Error(`Duplicate argument: ${arg}`);
      seen.add(arg);
      options[key] = true;
    } else if (valued.has(arg)) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      if (seen.has(arg)) throw new Error(`Duplicate argument: ${arg}`);
      seen.add(arg);
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      options[key] = value;
    } else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function integer(value, name) {
  if (!/^\d+$/.test(String(value)) || Number(value) < 1) throw new Error(`${name} must be a positive integer`);
  return Number(value);
}

function hashSeed(text) {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicShuffle(items, seed) {
  const output = items.slice();
  let state = hashSeed(seed) || 1;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [output[index], output[swap]] = [output[swap], output[index]];
  }
  return output;
}

function buildRuns(study, iterations, seed) {
  const runs = [];
  for (const experiment of study.experiments) {
    for (const task of experiment.tasks) {
      for (let iteration = 1; iteration <= iterations; iteration += 1) {
        const arms = deterministicShuffle(experiment.arms, `${seed}:${experiment.id}:${task.id}:${iteration}`);
        for (const arm of arms) {
          runs.push({
            run_id: `${experiment.id}__${task.id}__${String(iteration).padStart(2, '0')}__${arm.id}`,
            experiment_id: experiment.id,
            task,
            arm,
            iteration,
          });
        }
      }
    }
  }
  return runs;
}

function validateLiveOptions(options, env) {
  if (env[RUN_GATE] !== '1') throw new Error(`--run requires ${RUN_GATE}=1`);
  if (!options.runner || !path.isAbsolute(options.runner)) throw new Error('--run requires an absolute --runner path');
  if (!fs.statSync(options.runner, { throwIfNoEntry: false })?.isFile()) throw new Error('--runner must name an existing file');
  if (!options.studyDir || !path.isAbsolute(options.studyDir)) throw new Error('--run requires an absolute --study-dir');
  if (!options.repo || !path.isAbsolute(options.repo)) throw new Error('--run requires an absolute --repo');
  const repo = fs.realpathSync(options.repo);
  const parent = fs.realpathSync(path.dirname(options.studyDir));
  const studyDir = path.resolve(parent, path.basename(options.studyDir));
  if (studyDir === repo || studyDir.startsWith(`${repo}${path.sep}`)) throw new Error('--study-dir must be outside the repository');
  return { repo, studyDir, iterations: integer(options.iterations, '--iterations'), maxRuns: integer(options.maxRuns, '--max-runs') };
}

function copyCheckout(repo, destination, studyDir) {
  fs.cpSync(repo, destination, {
    recursive: true,
    filter(source) {
      const relative = path.relative(repo, source);
      if (!relative) return true;
      const first = relative.split(path.sep)[0];
      if (first === '.git') return false;
      if (['plan.md', 'progress.md', 'handoff.md'].includes(relative) || relative === path.join('.claude', 'handoff.md')) return false;
      if (/(^|[/\\])(\.env|[^/\\]*(password|secret|token)[^/\\]*)$/i.test(relative) || /\.(pem|key|p12|cert)$/i.test(relative)) return false;
      if (source === studyDir || source.startsWith(`${studyDir}${path.sep}`)) return false;
      if (relative === path.join('.forgeflow', 'memory') || relative.startsWith(`${path.join('.forgeflow', 'memory')}${path.sep}`)) return false;
      return true;
    },
  });
}

function hashTree(root) {
  const hash = crypto.createHash('sha256');
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, entry.name);
      const relative = path.relative(root, file);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) {
        hash.update(relative);
        hash.update(fs.readFileSync(file));
      }
    }
  };
  visit(root);
  return hash.digest('hex');
}

function executeStudy(options, env = process.env, spawn = spawnSync) {
  const live = validateLiveOptions(options, env);
  const study = buildStudy({ pilot: options.pilot });
  const runs = buildRuns(study, live.iterations, options.seed);
  if (runs.length > live.maxRuns) throw new Error(`planned run count ${runs.length} exceeds --max-runs ${live.maxRuns}`);
  if (fs.existsSync(live.studyDir)) throw new Error('--study-dir already exists; supply a fresh directory');

  const outputRoot = path.join(live.studyDir, 'outputs');
  const checkoutRoot = path.join(live.studyDir, 'checkouts');
  fs.mkdirSync(outputRoot, { recursive: true, mode: 0o700 });
  fs.mkdirSync(checkoutRoot, { recursive: true, mode: 0o700 });
  fs.chmodSync(live.studyDir, 0o700);
  const gitResult = spawnSync('git', ['-C', live.repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  const sourceSha = gitResult.status === 0 ? gitResult.stdout.trim() : null;
  const records = [];

  for (const run of runs) {
    const checkout = path.join(checkoutRoot, run.run_id);
    const outputDir = path.join(outputRoot, run.run_id);
    fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });
    copyCheckout(live.repo, checkout, live.studyDir);
    const checkoutSha256 = hashTree(checkout);
    const request = {
      schema_version: '1',
      ...run,
      output_dir: outputDir,
      checkout,
      raw_output_boundary: 'Never copy raw output into .forgeflow/memory.',
    };
    const requestPath = path.join(outputDir, 'request.json');
    fs.writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`);
    const startedAt = new Date().toISOString();
    const started = process.hrtime.bigint();
    const result = spawn(options.runner, [requestPath], { cwd: checkout, encoding: 'utf8', env: { ...env, FORGEFLOW_STUDY_OUTPUT_DIR: outputDir } });
    const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;
    fs.writeFileSync(path.join(outputDir, 'stdout.txt'), result.stdout || '');
    fs.writeFileSync(path.join(outputDir, 'stderr.txt'), result.stderr || '');
    const usageMatch = String(result.stderr || '').match(/^study_usage=(\{.*\})$/m);
    let usage = null;
    if (usageMatch) {
      try { usage = JSON.parse(usageMatch[1]); } catch { usage = null; }
    }
    const stdoutSha256 = crypto.createHash('sha256').update(result.stdout || '').digest('hex');
    const stderrSha256 = crypto.createHash('sha256').update(result.stderr || '').digest('hex');
    const record = {
      run_id: run.run_id,
      experiment_id: run.experiment_id,
      task_id: run.task.id,
      arm_id: run.arm.id,
      iteration: run.iteration,
      started_at: startedAt,
      runner: fs.realpathSync(options.runner),
      runner_sha256: crypto.createHash('sha256').update(fs.readFileSync(options.runner)).digest('hex'),
      source_repo: live.repo,
      source_sha: sourceSha,
      checkout_sha256: checkoutSha256,
      checkout,
      request: requestPath,
      exit_code: result.status ?? null,
      signal: result.signal ?? null,
      spawn_error: result.error?.message || null,
      latency_ms: Math.round(latencyMs * 1000) / 1000,
      stdout: path.join(outputDir, 'stdout.txt'),
      stderr: path.join(outputDir, 'stderr.txt'),
      stdout_sha256: stdoutSha256,
      stderr_sha256: stderrSha256,
      usage,
      seed: options.seed,
    };
    fs.writeFileSync(path.join(outputDir, 'provenance.json'), `${JSON.stringify(record, null, 2)}\n`);
    records.push(record);
  }
  const summary = { schema_version: '1', study_id: study.study_id, pilot: study.pilot, seed: options.seed, source_sha: sourceSha, run_count: records.length, records };
  fs.writeFileSync(path.join(live.studyDir, 'study-results.json'), `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

function preview(options) {
  const iterations = options.iterations ? integer(options.iterations, '--iterations') : 1;
  const study = buildStudy({ pilot: options.pilot });
  const runs = buildRuns(study, iterations, options.seed);
  return { mode: 'preview', executes_models: false, writes_files: false, seed: options.seed, planned_runs: runs.length, runs };
}

function usage() {
  console.error('Usage: run-research-divergence-study.js [--pilot] [--seed <seed>] [--iterations <n>] [--json]');
  console.error(`Live: ${RUN_GATE}=1 run-research-divergence-study.js --run --runner <absolute-path> --repo <absolute-path> --study-dir <fresh-absolute-path> --iterations <n> --max-runs <n>`);
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) return usage();
    const result = options.run ? executeStudy(options) : preview(options);
    process.stdout.write(options.json || options.run ? `${JSON.stringify(result, null, 2)}\n` : `Preview only: ${result.planned_runs} runs; no models or files used.\n`);
  } catch (error) {
    console.error(`research divergence study failed: ${error.message}`);
    usage();
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { RUN_GATE, buildRuns, deterministicShuffle, executeStudy, hashTree, parseArgs, preview, validateLiveOptions };
