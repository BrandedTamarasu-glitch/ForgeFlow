# Forgeflow for Codex

This repository now includes a Codex-native first pass of the Forgeflow team.

## What Was Added

- Project-scoped custom agents in `.codex/agents/`
- Project-scoped agent settings in `.codex/config.toml`
- Helper scripts in `scripts/forgeflow/`
- Repo skills in `.agents/skills/` for the main workflows:
  - `forgeflow-review`
  - `forgeflow-consult`
  - `forgeflow-implement`
  - `discuss`
  - `research`
  - `plan`
  - `audit`
  - `debate`
  - `quick`
  - `ship`
  - `aegis-verify`
  - `create-agent`
  - `update-forgeflow`
  - `agent-chat-on`
  - `agent-chat-off`

## Mapping

Claude-style Forgeflow pieces map to Codex like this:

- `agents/*.md` -> custom subagents in `.codex/agents/*.toml`
- `commands/*.md` -> repo skills in `.agents/skills/*/SKILL.md`
- persistent memory -> `.forgeflow/<project-name>/`
- operational helpers -> `scripts/forgeflow/*`
- durable Claude project rules -> `AGENTS.md`

## Codex Agent Model Policy

Reviewed on 2026-05-15 against current OpenAI model guidance.

| Role class | Agents | Model | Reasoning | Sandbox | Rationale |
|------------|--------|-------|-----------|---------|-----------|
| Leaf backend/craft consultants and reviewers | `smith_consultant`, `smith_reviewer` | `gpt-5.4-mini` | `medium` | `read-only` | High-volume subagent work where latency/cost matters and final synthesis still catches priority calls. |
| Leaf security and accessibility consultants/reviewers | `warden_consultant`, `warden_reviewer`, `lumen_consultant`, `lumen_reviewer` | `gpt-5.4-mini` | `high` | `read-only` | Mini-class subagent model, but high reasoning retained for security, UX, and accessibility risk. |
| Code-writing implementers | `smith_implementer`, `warden_implementer`, `lumen_implementer`, `arbiter_implementer` | `gpt-5.3-codex` | `medium` or `high` | `workspace-write` | Codex model is optimized for agentic coding and patch application. Arbiter stays high for integration judgment. |
| Synthesis and final gates | `arbiter_consultant`, `arbiter_reviewer`, `compass_reviewer`, `compass_validator` | `gpt-5.4` | `high` | read-only or validation write access | Final verdict quality matters more than leaf-agent latency. Pilot `gpt-5.5` here first if testing frontier upgrades. |
| Neutral verification | `aegis` | `gpt-5.4` | `high` | `read-only` | Evidence-only pass for high-risk findings. No persona lens, no unrelated fixes, no scope expansion. |
| Research, planning, audit, debate | Compass lead roles, auditors, debate judge/validator | `gpt-5.4` | `high` | mostly `read-only` | These roles need deeper judgment and are not spawned as frequently as leaf specialists. |
| PM and memory roles | `atlas_*` | `gpt-5.4-mini` | `medium` | `workspace-write` where memory writes are expected | Coordination and memory work should be fast and inexpensive unless quality misses become measurable. |

`max_threads = 6` and `max_depth = 1` in `.codex/config.toml` are intentional. Six threads cover the largest normal Forgeflow fan-out, while depth one prevents recursive delegation and keeps orchestration in the parent Codex session.

Do not blanket-upgrade all agents to the newest frontier model. The Forgeflow workflows fan out, so model cost and latency multiply quickly. Test frontier upgrades first on final decision roles such as `arbiter_reviewer` and `compass_reviewer`.

## Codex Agent Drift Check

Codex agents are intentionally smaller than the canonical Claude markdown prompts, but they should not silently drift. The source map in `.codex/agent-canonical-map.json` records the canonical `agents/*.md` file and SHA-256 hash for each `.codex/agents/*.toml` file.

Run this after changing any canonical agent prompt:

```bash
scripts/forgeflow/check-codex-agent-drift.js
```

If it fails, update the matching Codex TOML prompt and refresh the affected hash in `.codex/agent-canonical-map.json`.

## PRISM-Inspired Routing Direction

The PRISM comparison in `docs/prism-routing-notes.md` gives the next design direction for Forgeflow in Codex:

- Persona agents should be used for attention and coverage, not treated as intrinsically more accurate.
- High-risk findings should pass through neutral verification before becoming blockers.
- Routing should become telemetry-informed over time, using overturned findings and auto-fix outcomes.
- Review output should explain why a mode and agent roster were selected.
- Long-term agent flow should split candidate generation from verdict validation.

This supports the current model policy: cheaper mini-class models for leaf specialists, stronger models for Arbiter/Compass synthesis, and Codex coding models for implementers.

Sprint 1 added a Aegis path:

- `.codex/agents/aegis.toml`
- `.agents/skills/aegis-verify/SKILL.md`
- `forgeflow-review` guidance for verifying high-risk findings before Arbiter synthesis

Verifier results are advisory input to Arbiter. Arbiter still owns final synthesis and verdict integrity.

Sprint 2 adds explainable routing:

- `scripts/forgeflow/explain-review-route.js`
- route fixtures under `fixtures/review-route/`
- `forgeflow-review` guidance to include routing notes in prompts and final output

The route output is deterministic JSON with selected mode, trigger files, included/skipped agents, verifier requirement, and cost/coverage tradeoff.

Sprint 3 adds calibration summaries:

- `scripts/forgeflow/summarize-calibration.js`
- `scripts/forgeflow/test-summarize-calibration.js`
- fixture telemetry under `fixtures/calibration/`
- additive telemetry event `finding-verified`

Calibration summarizes overturned findings, Aegis decisions, and auto-fix outcomes by agent and finding class.

Sprint 4 adds telemetry-informed routing:

- `explain-review-route.js --calibration <summary.json>`
- route fixture coverage for noisy classes, high-value service-boundary classes, and insufficient history
- `telemetry_hints` in route output

Calibration can now require neutral verification for historically noisy finding classes and keep Lumen in thin-mode service-boundary diffs when UX/connectivity history shows value. Low-volume history is reported as a hint but does not alter the route.

Sprint 5 starts review outcome evaluation:

- `docs/forgeflow-evaluation-protocol.md`
- `scripts/forgeflow/record-review-outcome.js`
- fixture outcome records under `fixtures/evaluation/`

Outcome records are local JSONL entries that capture review mode, agents used, verifier decisions, accepted/rejected findings, review time, auto-fix success, and post-merge regression signal.

Sprint 6 starts prompt parity generation:

- `scripts/forgeflow/generate-codex-agent-stubs.js`
- fixture source map coverage under `fixtures/prompt-parity/`
- optional `sections` and `manual_summary` map fields for controlled canonical excerpts

The generator emits reviewable Codex TOML stubs from canonical markdown prompts. It preserves existing model/sandbox fields when a target agent already exists and writes only to an explicit output path.

## Codex Project Rules

Reusable Claude project rules are captured in `AGENTS.md` for Codex. The Codex version keeps the durable rules and omits Claude-specific commands:

- local-only git safety until the user asks for commits, pushes, PRs, or GitHub writes
- stage by explicit file path, never `git add .` or `git add -A`
- worktree, port, environment, and service-readiness checks before dev-server work
- right-sized implementation, no speculative infrastructure, and pattern symmetry in touched files
- substantiated PR/writeup claims only
- local session artifacts stay ignored

## What Works Now

You can invoke the Forgeflow team in Codex with either explicit skill usage or plain-language prompts that reference the skill names.

Examples:

```text
$forgeflow-consult design the approach for adding OAuth login
```

```text
$forgeflow-implement execute the current brief
```

```text
$forgeflow-review review this branch against main
```

Short aliases are also available:

```text
$consult design the approach for adding OAuth login
$implement execute the current brief
$forge-review review this branch against main
```

Additional lifecycle and utility skills:

```text
$discuss frame the requirements for adding OAuth login
$research compare auth implementation options for this stack
$plan build the implementation plan for the current research
$audit src/auth
$aegis-verify verify this security finding against the cited files
$debate
$quick investigate this bug with the minimum useful Forgeflow
$ship prepare this branch for merge
$create-agent
$update-forgeflow
$agent-chat-on
$agent-chat-off
```

Operational helper scripts are now available too:

```text
scripts/forgeflow/ensure-forgeflow-state.sh
scripts/forgeflow/agent-chat-on.sh
scripts/forgeflow/agent-chat-off.sh
scripts/forgeflow/ship-prepare.sh "Optional PR title"
scripts/forgeflow/ship-open-pr.sh "<title>" "<body-file>" "<base-branch>"
scripts/forgeflow/ship-ci-status.sh
scripts/forgeflow/record-review-outcome.js --input outcome.json
scripts/forgeflow/generate-codex-agent-stubs.js --agent .codex/agents/smith-reviewer.toml --out /tmp/smith-reviewer.toml
```

## About Slash Commands

Codex does not currently expose arbitrary user-authored slash commands in the same way Claude command files do.

What you can do instead:

- Use explicit skill invocation with `$consult`, `$implement`, and `$forge-review`
- In the Codex app, enabled skills also appear in the slash picker, so these can show up as `/consult`, `/implement`, and `/forge-review`

One important exception:

- `/review` is already a built-in Codex command, so do not try to reuse that exact name for the Forgeflow workflow

You can also ask Codex directly to spawn the custom agents by name:

```text
Spawn smith_reviewer, warden_reviewer, lumen_reviewer, and atlas_reviewer on this diff. Then have arbiter_reviewer synthesize the result and compass_reviewer do the final check.
```

## Notes

- This is a Codex-native first pass, not a byte-for-byte port of Claude slash-command behavior.
- The agent personalities and responsibilities were preserved, but the execution model is adapted to Codex subagents and skills.
- The old markdown prompts remain useful source material if you want a deeper or more literal conversion later.
