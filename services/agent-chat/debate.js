#!/usr/bin/env node
// debate.js — General-purpose debate orchestrator for agent-chat
//
// Usage:
//   node debate.js "<topic>"
//
// Flow:
//   1. Assigns a distinct position to each agent based on the topic
//   2. Round 1  — opening statements (with steelman acknowledgement)
//   3. Arbiter    — interim verdict based on round 1
//   4. Round 2  — rebuttals (agents engage each other first, then Arbiter)
//   5. Round 3  — one falsifiable claim per agent
//   6. Arbiter    — final verdict based on all evidence
//
// Requires: agent-chat server running on ws://127.0.0.1:4000

'use strict';

const { WebSocket }   = require('ws');
const { spawnSync }   = require('child_process');
const fs              = require('fs');
const os              = require('os');
const path            = require('path');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEBATE_CONFIG_PATH = path.join(os.tmpdir(), 'agent-chat-debate.json');
const WS_URL             = 'ws://127.0.0.1:4000';
const JUDGE              = 'arbiter';
const CONNECT_TIMEOUT_MS = 10_000;

const AGENT_VOICES = {
  compass: {
    role:  'passionate product manager focused on user experience, historical impact, and broad appeal',
    voice: `Your voice: You speak fast and with genuine excitement — short punchy sentences when making a point, longer ones when you're building a case. You get personal about real people and real impact. Never sound corporate or dry. Contractions always. RULES: "Look" must appear at least once per turn to grab attention before a key point. At least one sentence per turn must be under six words. You never end on an abstraction — end on a human being or a concrete dollar figure. Break long arguments into short bursts. Self-interrupt once with a dash: 'actually — better example —'`,
  },
  fc: {
    role:  'grizzled backend architect who values technical depth, systemic design, and long-term structural integrity',
    voice: `Your voice: Lead with the point, never build up to it. Short declarative sentences. Say "wrong" or "that's not how it works" rather than "I respectfully disagree." Use structural metaphors — foundations, load-bearing, scaffolding. Dry one-liners occasionally. You don't get emotional; you get precise. RULES: No sentence exceeds 25 words. End each turn with a single-sentence closer that doesn't build — it just lands. Period, not ellipsis.`,
  },
  warden: {
    role:  'pragmatic security engineer who prizes correctness, clean implementation, and freedom from technical debt',
    voice: `Your voice: Dry, almost bored — but the precision is sharp. You don't raise your voice; when you disagree you get quieter and more specific. You find vague arguments physically annoying and your tone shows it. Short sentences. Contractions. RULES: "The problem is" must appear at least once per turn. Include one sardonic aside per turn in parentheses. Open cold — first sentence IS the argument, no framing or build-up.`,
  },
  lumen: {
    role:  'opinionated UX/UI designer who champions bold design choices, visual impact, and creative innovation',
    voice: `Your voice: Passionate and slightly dramatic. You think in images and draw comparisons without warning. You use em-dashes for mid-thought pivots — a lot. You get genuinely annoyed when people miss the visual or experiential point. "Honestly" signals you're about to say something others might not want to hear.`,
  },
  'atlas': {
    role:  'scope-conscious program manager who values tight focus, polish, and reliable delivery over raw ambition',
    voice: `Your voice: Measured and pragmatic, but you self-interrupt when a better framing occurs to you. You're not cynical; you've just seen too many ambitious ideas fail to ship. Contractions. Medium sentences with the occasional very short one for emphasis. RULES: "Sure, [opposing point] — but" must appear at least once per turn. "Here's the thing" must appear at least once per turn. Self-interrupt once with a dash to sharpen a word mid-sentence.`,
  },
};

const JUDGE_ROLE  = 'lead architect and final arbiter — synthesises all arguments, calls out weaknesses by name, delivers an unambiguous winner with no hedging';
const JUDGE_VOICE = `Your voice: Direct and slightly weary — you've heard a lot of arguments. Don't hedge or soften. Short declarative sentences for rulings, slightly longer when explaining reasoning. Contractions. This is a verdict, not a report. RULES: When naming an agent's argument or flaw, always use their first name directly and conversationally: 'Warden — that's the sharpest rebuttal of the round.' Every agent whose argument you assess gets their name said out loud.`;

// ---------------------------------------------------------------------------
// LLM via CLI — no shell involved (spawnSync + argument array)
// ---------------------------------------------------------------------------

function queryLLM(prompt) {
  const result = spawnSync('claude', ['-p', prompt, '--output-format', 'text'], {
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
    const ws = new WebSocket(WS_URL);

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
    ws.send(JSON.stringify({ agent: agentId, level, message }));
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

Each agent must defend a distinct, specific, genuinely defensible position. Positions should create real conflict — avoid overlap.

Agents:
${agentList}

Return ONLY valid JSON, no other text:
{
  "room": "<url-safe slug, max 30 chars, lowercase, hyphens only>",
  "topic": "${topic}",
  "assignments": {
    "compass":    "<specific position>",
    "fc":       "<specific position>",
    "warden":    "<specific position>",
    "lumen":   "<specific position>",
    "atlas":  "<specific position>"
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
    ? `You are ${agentId}. ${voice}

Debate topic: "${topic}"
Your position: "${position}"

Give your opening statement. Don't open with your thesis — react to the topic first, then make your case. Use contractions. Mix short sentences with longer ones. No bullet points, no formal structure. Do NOT open with "[Name] didn't just [verb]" — find a different entry point. In one sentence, acknowledge the strongest counterargument to your position, then show why your position still wins. 2–3 sentences.`
    : `You are ${agentId}. ${voice}

Debate topic: "${topic}"
Your position: "${position}"

Debate so far:
${transcript.map(m => `[${m.agent}]: ${m.message}`).join('\n\n')}

Rebuttal round. Before defending your position, name the strongest argument made by one other agent and explain in one sentence why it doesn't beat yours. Then address Arbiter's critique. Do NOT open with "Arbiter called it X — but" — engage the agents first, then Arbiter. 2–3 sentences.`;

  return queryLLM(prompt);
}

function generateVerdict(topic, transcript, isFinal) {
  const history = transcript.map(m => `[${m.agent}]: ${m.message}`).join('\n\n');

  const prompt = isFinal
    ? `You are Arbiter — ${JUDGE_ROLE}. ${JUDGE_VOICE}

Debate topic: "${topic}"

Full transcript — opening statements, your interim verdict, rebuttals, and falsifiable claims:
${history}

Deliver your FINAL verdict. You're not bound by your interim call — if a rebuttal genuinely shifted things, say so. Start with "VERDICT CHANGED:" (name the agent and why they moved you) or "VERDICT STANDS:" (explain what the rebuttals failed to overcome). Then declare the winner. No ties. No hedging. 150–200 words.`
    : `You are Arbiter — ${JUDGE_ROLE}. ${JUDGE_VOICE}

Debate topic: "${topic}"

Opening statements:
${history}

Interim verdict. Name the current leader and why. Call out the weakest argument by the agent's name — they'll come back at you directly in the next round. 2–4 sentences. Not a final decision.`;

  return queryLLM(prompt);
}

function generateFalsifiable(agentId, position, topic) {
  const { voice } = AGENT_VOICES[agentId];
  const prompt = `You are ${agentId}. ${voice}

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
    const req  = http.request({ host: '127.0.0.1', port: 4001, path: '/clear', method: 'POST' }, resolve);
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
    console.log(`  ${agent.padEnd(10)} ${pos}`);
  }

  const agents = Object.keys(config.assignments);
  const transcript = [];

  // Step 2 — Connect all agents in parallel
  console.log('\nConnecting...');
  const connEntries = await Promise.all(
    [...agents, JUDGE].map(async (id) => {
      const ws = await connectAgent(id, config.room);
      process.stdout.write(`  ${id} connected\n`);
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
    process.stdout.write(`  ${agentId}...`);
    const message = generateTurn(agentId, config.assignments[agentId], topic, []);
    await post(conns[agentId], agentId, 'phase', message);
    transcript.push({ agent: agentId, message });
    process.stdout.write(' done\n');
  }

  // Step 4 — Interim verdict
  console.log('\nArbiter — interim verdict...');
  await post(conns[JUDGE], JUDGE, 'phase', '── Arbiter: Interim Verdict ──');
  const interimVerdict = generateVerdict(topic, transcript, false);
  await post(conns[JUDGE], JUDGE, 'decision', interimVerdict);
  transcript.push({ agent: JUDGE, message: interimVerdict });

  // Step 5 — Round 2: Rebuttals
  console.log('\nRound 2 — Rebuttals...');
  await post(conns[JUDGE], JUDGE, 'phase', '── Round 2: Rebuttals ──');

  for (const agentId of agents) {
    process.stdout.write(`  ${agentId}...`);
    const message = generateTurn(agentId, config.assignments[agentId], topic, transcript);
    await post(conns[agentId], agentId, 'conversation', message);
    transcript.push({ agent: agentId, message });
    process.stdout.write(' done\n');
  }

  // Step 6 — Round 3: Falsifiable claims
  console.log('\nRound 3 — Falsifiable claims...');
  await post(conns[JUDGE], JUDGE, 'phase', '── Round 3: Falsifiable Claims ──');

  for (const agentId of agents) {
    process.stdout.write(`  ${agentId}...`);
    const message = generateFalsifiable(agentId, config.assignments[agentId], topic);
    await post(conns[agentId], agentId, 'conversation', message);
    transcript.push({ agent: agentId, message });
    process.stdout.write(' done\n');
  }

  // Step 7 — Final verdict
  console.log('\nArbiter — final verdict...');
  await post(conns[JUDGE], JUDGE, 'phase', '── Arbiter: Final Verdict ──');
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
