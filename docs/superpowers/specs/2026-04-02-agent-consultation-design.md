# Agent-to-Agent Consultation Design

**Date:** 2026-04-02
**Status:** Approved

---

## Overview

Enable Forgeflow agents to pause mid-work, consult a peer agent for a multi-round discussion (up to 3 rounds), and resume with the outcome — without requiring the agent-chat server to be running.

The chat server remains an **optional transparency overlay**: if running, each consultation is broadcast to the dashboard. If not, the consultation proceeds silently via agent output signals and temp files.

---

## Consultation Signal Format

Any implement-phase agent may emit a `## CONSULTATION REQUEST` block at the **end** of its output to pause work and request a discussion:

```
## CONSULTATION REQUEST
- with: <agent-id>          # warden | fc | lumen | compass | atlas
- consultation-id: <uuid>   # unique ID, used for temp file names
- question: "<text>"        # specific question, max 500 chars
- context: |                # optional — relevant code/decisions, multi-line
    <text>
- work-state: paused
```

Rules:
- An agent emits this **instead of completing** — it signals a pause, not an aside. Work output up to the block stands.
- Maximum 1 consultation request per agent invocation.
- `with` must name a different agent (no self-consultation).
- `with` must be a valid consult-phase agent for the requesting agent (see Permitted Pairs).

---

## Pause File

Before exiting, the requesting agent writes `/tmp/consult-<uuid>-pause.md`:

```markdown
# Consultation Pause State
- agent: <agent-id>
- consultation-id: <uuid>
- paused-at: <ISO timestamp>
- working-on: <brief description of the task>
- files-touched: <list>
- decisions-made: <brief>
- question-raised: "<question>"
- next-step-on-resume: <what to do once the answer arrives>
```

---

## Arbiter's Consultation Loop

Arbiter-implement detects a `## CONSULTATION REQUEST` in a completed agent's output and drives the exchange:

### Step 1 — Parse
Extract `with`, `question`, `context`, `consultation-id`, and requesting agent from the signal block.

### Step 2 — Post to chat (if server running)
```bash
[ -f /tmp/agent-chat.pid ] && kill -0 "$(cat /tmp/agent-chat.pid)" 2>/dev/null && \
  csend arbiter phase "Consultation: <from> → <to> — <question, truncated to 80 chars>"
```

### Step 3 — Spawn target agent (consult phase)
Inject a consultation preamble at the start of the target agent's prompt:

```
## Consultation Request from <from-agent>
Question: <question>
Context: <context>

Respond directly and concretely. You may ask one clarifying follow-up if needed,
marked as ## FOLLOW-UP. Otherwise end your response with ## CONSULTATION REPLY
followed by your answer.
```

### Step 4 — Capture reply and iterate
- If reply contains `## FOLLOW-UP`: re-spawn the requesting agent with the follow-up injected, incrementing round count.
- If reply contains `## CONSULTATION REPLY`: proceed to Step 5.
- Hard cap: **3 rounds total**. If unresolved after round 3, go to Step 6 (blocked).

Post to chat after each round:
```bash
csend arbiter conversation "Round <n>/3: <target-agent> replied"
```

### Step 5 — Write outcome file
Arbiter writes `/tmp/consult-<uuid>-outcome.md`:

```markdown
# Consultation Outcome
- consultation-id: <uuid>
- from: <requesting-agent>
- to: <target-agent>
- rounds: <n>
- question: "<question>"
- answer: |
    <synthesised answer>
```

Post to chat:
```bash
csend arbiter decision "Consultation resolved in <n> rounds: <one-line summary>"
```

### Step 6 — Blocked (3-round cap hit)
Post to chat:
```bash
csend arbiter phase "Consultation unresolved after 3 rounds — flagged for human review"
```
Surface as a blocker in Arbiter's implementation oversight output. Do not re-spawn the requesting agent.

### Step 7 — Resume requesting agent
Re-spawn the requesting agent with:

```
You paused for a consultation. Read /tmp/consult-<uuid>-pause.md to restore
your work state, then read /tmp/consult-<uuid>-outcome.md for the answer.
Continue your work from where you left off. Do not re-raise the same consultation.
```

### Step 8 — Cleanup
After the requesting agent completes its resumed work and returns output to Arbiter, Arbiter deletes both temp files:
```bash
rm -f /tmp/consult-<uuid>-pause.md /tmp/consult-<uuid>-outcome.md
```
The requesting agent does not clean up its own temp files.

---

## Consultation Reply Format

Target agents (consult-phase) respond to consultation preambles with one of:

**Concrete answer:**
```
## CONSULTATION REPLY
<answer>
```

**One clarifying follow-up:**
```
## FOLLOW-UP
<one specific clarifying question>
```

No other formats are valid. Agents must not re-emit a `## CONSULTATION REQUEST` inside a consultation reply.

---

## Permitted Consultation Pairs

| Requesting agent | May consult |
|-----------------|-------------|
| smith-implement | warden-consult, lumen-consult |
| warden-implement | smith-consult, lumen-consult |
| lumen-implement | warden-consult, smith-consult |
| compass-implement | warden-consult, smith-consult |
| atlas-implement | smith-consult, warden-consult |

All five implement-phase agents may initiate consultations. Arbiter is never a consultation target — he runs the loop.

---

## Chat Visibility (Optional Overlay)

The agent-chat server is not required for consultation to function. It provides real-time dashboard visibility only.

Arbiter checks `[ -f /tmp/agent-chat.pid ] && kill -0 "$(cat /tmp/agent-chat.pid)" 2>/dev/null` before every `csend` call. If the server is not running, `csend` is skipped silently.

To watch consultations in real time: run `/agent-chat:on` before starting the implement phase.

---

## Files to Update

| File | Change |
|------|--------|
| `agents/arbiter-implement.md` | Add full consultation loop protocol (Steps 1–8) |
| `agents/smith-implement.md` | Add consultation signal instructions + pause file writing |
| `agents/warden-implement.md` | Add consultation signal instructions + pause file writing |
| `agents/lumen-implement.md` | Add consultation signal instructions + pause file writing |
| `agents/compass-implement.md` | Add consultation signal instructions + pause file writing |
| `agents/atlas-implement.md` | Add consultation signal instructions + pause file writing |
| `agents/smith-consult.md` | Add consultation reply instructions |
| `agents/warden-consult.md` | Add consultation reply instructions |
| `agents/lumen-consult.md` | Add consultation reply instructions |
| `agents/arbiter-consult.md` | No change — Arbiter does not receive consultations |
| `agents/compass-discuss.md` | Add consultation reply instructions (may be consulted) |
| `agents/atlas-consult.md` | Add consultation reply instructions (may be consulted) |

---

## Non-Goals

- Agents do not subscribe to or poll the chat server.
- The chat-bridge is not modified.
- Agents cannot consult Arbiter directly.
- Consultations do not chain (an agent resumed from a consultation cannot immediately raise another).
