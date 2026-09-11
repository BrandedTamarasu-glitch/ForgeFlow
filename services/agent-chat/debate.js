#!/usr/bin/env node
// debate.js — General-purpose debate orchestrator for agent-chat
//
// Usage:
//   node debate.js "<topic>"
//
// Flow:
//   1. Assigns a distinct position to each agent based on the topic
//   2. Round 1  — opening statements (with steelman acknowledgement)
//   3. Architect    — interim verdict based on round 1
//   4. Round 2  — rebuttals (agents engage each other first, then Architect)
//   5. Round 3  — one falsifiable claim per agent
//   6. Architect    — final verdict based on all evidence
//
// Requires: agent-chat server running on ws://127.0.0.1:4000

'use strict';

const { WebSocket }   = require('ws');
const { readToken } = require('./session-auth');
const { spawnSync }   = require('child_process');
const fs              = require('fs');
const os              = require('os');
const path            = require('path');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEBATE_CONFIG_PATH = path.join(os.tmpdir(), 'agent-chat-debate.json');
const WS_URL             = 'ws://127.0.0.1:4000';
const { formatAgentLabel } = require('../../scripts/forgeflow/agent-identity');
const JUDGE              = 'architect';
const CONNECT_TIMEOUT_MS = 10_000;

const AGENT_VOICES = {
  verifier: {
    role: 'independent verifier who checks claims against visible evidence',
    voice: 'Distinguish facts from assumptions. State what evidence would change the conclusion.',
  },
  product_lead: {
    role: 'product lead focused on user experience, historical impact, and broad appeal',
    voice: 'Explain who benefits or loses and why. Use concrete examples and preserve uncertainty about user needs.',
  },
  builder: {
    role: 'backend architect focused on technical depth, system design, and lasting code quality',
    voice: 'State the technical claim first. Explain how the system works and which assumptions support the claim.',
  },
  guardian: {
    role: 'security engineer focused on correctness, safe interfaces, and maintainable code',
    voice: 'Identify the risk, its cause, and its effect. Distinguish observed failures from possible ones.',
  },
  designer: {
    role: 'UX/UI designer focused on visual quality, accessibility, and useful design choices',
    voice: 'Describe what people see and do. Explain how each design choice affects usability and access.',
  },
  coordinator: {
    role: 'program manager focused on scope, quality, and reliable delivery',
    voice: 'Explain scope, dependencies, and delivery tradeoffs. State what remains unknown.',
  },
};

const JUDGE_ROLE = 'lead architect and final judge who weighs the arguments and identifies the best supported position';
const JUDGE_VOICE = 'Lead with the judgment, then explain the evidence. Name the role whose argument you assess. State uncertainty and gaps in the evidence.';
const WRITING_RULES = `Apply George Orwell's six writing rules:
1. Never use a metaphor, simile, or other figure of speech which you are used to seeing in print.
2. Never use a long word where a short one will do.
3. If it is possible to cut a word out, always cut it out.
4. Never use the passive where you can use the active.
5. Never use a foreign phrase, a scientific word, or a jargon word if you can think of an everyday English equivalent.
6. Break any of these rules sooner than say anything outright barbarous.

Lead with the point. Use plain, concise prose. Preserve facts, uncertainty, exact identifiers, evidence, required JSON, and verdict labels. Cut stock phrases and repeated summaries. These rules take precedence over style directions; do not cut words needed for accuracy or clarity.`;

// ---------------------------------------------------------------------------
// LLM via CLI — no shell involved (spawnSync + argument array)
// ---------------------------------------------------------------------------

function queryLLM(prompt) {
  const result = spawnSync('claude', ['-p', `${prompt}\n\n${WRITING_RULES}`, '--output-format', 'text'], {
    encoding: 'utf8',
    timeout:  60_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`claude exited ${result.status}: ${result.stderr}`);
  return result.stdout.trim();
}

// ---------------------------------------------------------------------------
// WebSocket helpers
// ---------------------------------------------------------------------------

function connectAgent(agentId, room) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL, { headers: { 'x-forgeflow-token': readToken() } });

    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`connectAgent timeout waiting for ack (agentId=${agentId})`));
    }, CONNECT_TIMEOUT_MS);

    ws.on('open', () => ws.send(agentId));

    ws.once('message', (raw) => {
      let data;
      try { data = JSON.parse(raw.toString()); } catch { /* ignore non-JSON */ }
      if (data?.type === 'ack') {
        clearTimeout(timer);
        ws.send(`/join ${room}`);
        setTimeout(() => resolve(ws), 50);
      }
    });

    ws.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

function post(ws, agentId, level, message) {
  return new Promise((resolve) => {
    ws.send(JSON.stringify({ agent: agentId, level, message, activityLabel: agentId === JUDGE ? 'Debate verdict' : 'Debate argument' }));
    setTimeout(resolve, 100);
  });
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function assignPositions(topic) {
  const agentList = Object.entries(AGENT_VOICES)
    .map(([id, { role }]) => `- ${id}: ${role}`)
    .join('\n');

  const prompt = `Assign debate positions for the topic: "${topic}"

Assign each agent a distinct, specific position they can defend with evidence. Avoid overlapping positions.

Agents:
${agentList}

Return ONLY valid JSON, no other text:
{
  "room": "<url-safe slug, max 30 chars, lowercase, hyphens only>",
  "topic": "${topic}",
  "assignments": {
    "verifier": "<specific position>",
    "product_lead":    "<specific position>",
    "builder":       "<specific position>",
    "guardian":    "<specific position>",
    "designer":   "<specific position>",
    "coordinator":  "<specific position>"
  }
}`;

  const raw = queryLLM(prompt);
  const stripped = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();

  let config;
  try {
    config = JSON.parse(stripped);
  } catch (err) {
    throw new Error(`assignPositions: failed to parse LLM response.\nRaw output:\n${raw}\nParse error: ${err.message}`);
  }
  return config;
}

function generateTurn(agentId, position, topic, transcript) {
  const { voice } = AGENT_VOICES[agentId];
  const isOpening = transcript.length === 0;

  const prompt = isOpening
    ? `You are ${formatAgentLabel(agentId)}. ${voice}

Debate topic: "${topic}"
Your position: "${position}"

Give your opening statement in 2–3 sentences. State your case, acknowledge the strongest counterargument, and explain why the evidence supports your position. State any limits that affect your conclusion.`
    : `You are ${formatAgentLabel(agentId)}. ${voice}

Debate topic: "${topic}"
Your position: "${position}"

Debate so far:
${transcript.map(m => `[${m.agent}]: ${m.message}`).join('\n\n')}

Rebuttal round. Name the strongest argument from another role and explain how it affects your position. Then address Architect's critique. Use 2–3 sentences and acknowledge evidence that weakens your case.`;

  return queryLLM(prompt);
}

function generateVerdict(topic, transcript, isFinal) {
  const history = transcript.map(m => `[${m.agent}]: ${m.message}`).join('\n\n');

  const prompt = isFinal
    ? `You are Architect — ${JUDGE_ROLE}. ${JUDGE_VOICE}

Debate topic: "${topic}"

Full transcript — opening statements, your interim verdict, rebuttals, and falsifiable claims:
${history}

Deliver your FINAL verdict in 150–200 words. Reconsider your interim judgment in light of the later evidence. Start with "VERDICT CHANGED:" (name the role and evidence that changed your judgment) or "VERDICT STANDS:" (explain why the later arguments did not change it). Name the best supported argument as the winner and state any uncertainty or evidence gaps that limit this judgment.`
    : `You are Architect — ${JUDGE_ROLE}. ${JUDGE_VOICE}

Debate topic: "${topic}"

Opening statements:
${history}

Give an interim verdict in 2–4 sentences. Name the current leader and explain why. Identify the weakest argument by role and explain what it lacks. State any uncertainty; this judgment is provisional.`;

  return queryLLM(prompt);
}

function generateFalsifiable(agentId, position, topic) {
  const { voice } = AGENT_VOICES[agentId];
  const prompt = `You are ${formatAgentLabel(agentId)}. ${voice}

Debate topic: "${topic}"
Your position: "${position}"

Final round. Give exactly one sentence — a falsifiable claim that, if proven wrong, would undermine your entire position. Make it concrete and specific. One sentence only. No preamble.`;
  return queryLLM(prompt);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const topic = process.argv[2];
  if (!topic) {
    console.error('Usage: node debate.js "<topic>"');
    process.exit(1);
  }

  // Step 0 — Clear server history so a browser refresh shows a clean room
  await new Promise((resolve, reject) => {
    const http = require('http');
    const req  = http.request({ host: '127.0.0.1', port: 4001, path: '/clear', method: 'POST', headers: { 'x-forgeflow-token': readToken() } }, res => {
      res.resume();
      if (res.statusCode === 204) resolve();
      else reject(new Error(`History clear failed (${res.statusCode})`));
    });
    req.on('error', reject);
    req.end();
  });
  console.log('Server history cleared.');

  // Step 1 — Assign positions
  console.log('Assigning positions...');
  const config = assignPositions(topic);
  fs.writeFileSync(DEBATE_CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });

  console.log(`\nRoom:  ${config.room}`);
  console.log('Positions:');
  for (const [agent, pos] of Object.entries(config.assignments)) {
    console.log(`  ${formatAgentLabel(agent).padEnd(14)} ${pos}`);
  }

  const agents = Object.keys(config.assignments);
  const transcript = [];

  // Step 2 — Connect all agents in parallel
  console.log('\nConnecting...');
  const connEntries = await Promise.all(
    [...agents, JUDGE].map(async (id) => {
      const ws = await connectAgent(id, config.room);
      process.stdout.write(`  ${formatAgentLabel(id)} connected\n`);
      return [id, ws];
    })
  );
  const conns = Object.fromEntries(connEntries);

  // Clear history from any previous debate, then announce
  conns[JUDGE].send('/clear');
  await new Promise(r => setTimeout(r, 100));

  console.log('\nDashboard: http://127.0.0.1:4001');

  // Announce
  await post(conns[JUDGE], JUDGE, 'phase',
    `Debate: "${topic}" — opening statements → interim verdict → rebuttals → falsifiable claims → final verdict. Judged on: clarity of position, strength of evidence, quality of rebuttals. Best argument wins. Begin.`);

  // Step 3 — Round 1: Opening statements
  console.log('\nRound 1 — Openings...');
  await post(conns[JUDGE], JUDGE, 'phase', '── Round 1: Opening Statements ──');

  for (const agentId of agents) {
    process.stdout.write(`  ${formatAgentLabel(agentId)}...`);
    const message = generateTurn(agentId, config.assignments[agentId], topic, []);
    await post(conns[agentId], agentId, 'phase', message);
    transcript.push({ agent: agentId, message });
    process.stdout.write(' done\n');
  }

  // Step 4 — Interim verdict
  console.log('\nArchitect — interim verdict...');
  await post(conns[JUDGE], JUDGE, 'phase', '── Architect: Interim Verdict ──');
  const interimVerdict = generateVerdict(topic, transcript, false);
  await post(conns[JUDGE], JUDGE, 'decision', interimVerdict);
  transcript.push({ agent: JUDGE, message: interimVerdict });

  // Step 5 — Round 2: Rebuttals
  console.log('\nRound 2 — Rebuttals...');
  await post(conns[JUDGE], JUDGE, 'phase', '── Round 2: Rebuttals ──');

  for (const agentId of agents) {
    process.stdout.write(`  ${formatAgentLabel(agentId)}...`);
    const message = generateTurn(agentId, config.assignments[agentId], topic, transcript);
    await post(conns[agentId], agentId, 'conversation', message);
    transcript.push({ agent: agentId, message });
    process.stdout.write(' done\n');
  }

  // Step 6 — Round 3: Falsifiable claims
  console.log('\nRound 3 — Falsifiable claims...');
  await post(conns[JUDGE], JUDGE, 'phase', '── Round 3: Falsifiable Claims ──');

  for (const agentId of agents) {
    process.stdout.write(`  ${formatAgentLabel(agentId)}...`);
    const message = generateFalsifiable(agentId, config.assignments[agentId], topic);
    await post(conns[agentId], agentId, 'conversation', message);
    transcript.push({ agent: agentId, message });
    process.stdout.write(' done\n');
  }

  // Step 7 — Final verdict
  console.log('\nArchitect — final verdict...');
  await post(conns[JUDGE], JUDGE, 'phase', '── Architect: Final Verdict ──');
  const finalVerdict = generateVerdict(topic, transcript, true);
  await post(conns[JUDGE], JUDGE, 'decision', finalVerdict);
  console.log('Final verdict delivered.');

  // Cleanup
  for (const ws of Object.values(conns)) ws.close();
  console.log(`\nDone. Config at ${DEBATE_CONFIG_PATH} — cleared on /agent-chat:off`);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
