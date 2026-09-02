#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const MODEL = process.env.FORGEFLOW_STUDY_MODEL || 'gpt-5.6-sol';
const TIMEOUT_MS = Number(process.env.FORGEFLOW_STUDY_CALL_TIMEOUT_MS || 120000);

function childEnvironment(codexHome) {
  const allowed = ['PATH', 'HOME', 'CODEX_HOME', 'XDG_RUNTIME_DIR', 'DBUS_SESSION_BUS_ADDRESS', 'SSL_CERT_FILE', 'NODE_EXTRA_CA_CERTS', 'HTTPS_PROXY', 'HTTP_PROXY', 'ALL_PROXY', 'NO_PROXY'];
  const environment = Object.fromEntries(allowed.filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]]));
  environment.CODEX_HOME = codexHome;
  environment.HOME = codexHome;
  return environment;
}

function codex(prompt, cwd, sandbox = 'read-only') {
  return new Promise((resolve, reject) => {
    const sourceHome = process.env.CODEX_HOME || path.join(process.env.HOME || '', '.codex');
    const sourceAuth = path.join(sourceHome, 'auth.json');
    if (!fs.statSync(sourceAuth, { throwIfNoEntry: false })?.isFile()) {
      reject(new Error(`Codex auth file not found at ${sourceAuth}`));
      return;
    }
    const codexHome = fs.mkdtempSync(path.join(require('os').tmpdir(), 'forgeflow-study-codex-home-'));
    fs.chmodSync(codexHome, 0o700);
    fs.copyFileSync(sourceAuth, path.join(codexHome, 'auth.json'));
    fs.chmodSync(path.join(codexHome, 'auth.json'), 0o600);
    const args = ['exec', '--ephemeral', '--sandbox', sandbox, '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check', '--color', 'never', '-m', MODEL, '-C', cwd, prompt];
    const child = spawn('codex', args, { cwd, env: childEnvironment(codexHome) });
    child.stdin.end();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, TIMEOUT_MS);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      fs.rmSync(codexHome, { recursive: true, force: true });
      reject(error);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      fs.rmSync(codexHome, { recursive: true, force: true });
      if (timedOut) return reject(new Error(`codex timed out after ${TIMEOUT_MS}ms`));
      if (code !== 0) return reject(new Error(`codex failed (${code ?? signal}): ${stderr.slice(-2000)}`));
      const tokenMatch = stderr.match(/tokens used\s*\n\s*([0-9,]+)/i);
      resolve({ text: stdout.trim(), stderr, code, signal, tokens: tokenMatch ? Number(tokenMatch[1].replace(/,/g, '')) : null });
    });
  });
}

function common(task) {
  return `TASK:\n${task.prompt}\n\nIMMUTABLE CONSTRAINTS:\n${task.immutable_constraints.map((item) => `- ${item}`).join('\n')}`;
}

async function research(request, divergent) {
  const invocation = divergent ? '$research --diverge' : '$research';
  const prompt = `Read and follow .agents/skills/research/SKILL.md exactly. Execute the Forgeflow ${invocation} workflow for the task below. This checkout is disposable. Do not commit, push, or access the network. Return the final research findings in a neutral structure; do not mention this benchmark.\n\n${common(request.task)}`;
  return codex(prompt, request.checkout, divergent ? 'read-only' : 'workspace-write');
}

async function classify(request) {
  const prompt = `Classify whether this task warrants expensive divergent research. Choose "diverge" only when it is open-ended, consequential, and has multiple plausible approaches. Choose "default" for canonical answers, verified root causes, mechanical migrations, or low-stakes reversible choices. Do not solve the task and do not mention this benchmark. Return only JSON: {"route":"default|diverge","rationale":"one sentence"}.\n\n${common(request.task)}`;
  return codex(prompt, request.checkout);
}

async function main() {
  const requestPath = process.argv[2];
  if (!requestPath) throw new Error('Usage: run-research-divergence-study-codex.js <request.json>');
  const request = JSON.parse(fs.readFileSync(path.resolve(requestPath), 'utf8'));
  let result;
  if (request.experiment_id === 'A-explicit-arm-comparison' && request.arm.id === 'baseline') result = await research(request, false);
  else if (request.experiment_id === 'A-explicit-arm-comparison' && request.arm.id === 'diverge') result = await research(request, true);
  else if (request.experiment_id === 'B-route-classification-controls' && request.arm.id === 'classify') result = await classify(request);
  else throw new Error(`Unsupported experiment/arm: ${request.experiment_id}/${request.arm?.id}`);
  process.stdout.write(`${result.text}\n`);
  const declaredWorkflowAgents = request.experiment_id === 'A-explicit-arm-comparison'
    ? (request.arm.id === 'diverge' ? ['three divergent branches', 'Atlas evidence lane', 'Compass critic'] : ['Compass researcher', 'Atlas evidence lane'])
    : [];
  process.stderr.write(`study_usage=${JSON.stringify({ model: MODEL, outer_codex_exec_count: 1, nested_model_call_count: null, nested_model_call_count_method: 'Codex CLI does not expose a reliable aggregate for nested agent turns', declared_workflow_agents: declaredWorkflowAgents, total_tokens: result.tokens, cost_usd: null, cost_method: 'Codex subscription runner does not expose per-call USD cost' })}\n${result.stderr}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
