# Tooling Patterns — Tier B

Patterns specific to Forgeflow infrastructure work (agent prompts, command templates, hooks, orchestration). Different audience than `recurring-blockers.md` — this file applies when the subject under review IS the Forgeflow team itself or similar agent-orchestration tooling.

Seeded from `SubAgents` project data (`/home/user/example-project/.forgeflow/SubAgents/`) and Forgeflow repo meta-work on 2026-04-17.

---

## 1. Agent Mode-Specificity

**Pattern:** Agent files that are shared across multiple modes (consult, implement, review, audit) accumulate instructions that apply to only ONE mode. Downstream mode reads the irrelevant instructions and either misfires or ignores them — either way, the prompt is wasteful.

**Seen in:**
- `SubAgents` — Atlas memory carve-out fixed in consult and implement modes (V3.7 changelog) because `atlas-early.md` covered discuss/research/plan but mode-specific reads drifted
- `Forgeflow` meta-work — V4.1.1 applied 8 precision fixes where Arbiter consult prompts mistakenly referenced review-mode concepts (e.g., `file:line` grounding) that don't apply to plan-phase context

**Rule of thumb:**
When splitting an agent across modes, every instruction must declare which mode(s) it applies to. Instructions that apply to all modes live in the canonical reference (e.g., `warden-security-intelligence.md`, `smith-craft.md`); mode-specific instructions live in the mode file with an `<!-- adapted from ... -->` comment linking to the canonical source.

**Review-time check:**
Flag any agent instruction that uses mode-specific terminology (e.g., "commit atomically" in a review-mode agent, "verdict" in a plan-mode agent) as mode leakage. Recommend moving to a different mode file or adding a mode-gate.

---

## 2. Cold-Start Edge Cases in Forgeflow Commands

**Pattern:** Commands assume prior Forgeflow state exists (`.forgeflow/<project>/` with files, `review-history.md` populated, agent-notes present). First-run in a fresh project hits absent-file errors or empty-state misbehavior.

**Seen in:**
- `SubAgents` — Atlas receipts rule only fires when `learnings.jsonl` has content; needs first-review fallback
- `Forgeflow` meta-work — V4.0 Smith Craft Intelligence enhancement flagged "Canonical paste-sync pattern has no auto-sync mechanism" — a first-install cold-start concern

**Rule of thumb:**
Every command that reads from `.forgeflow/<project>/` must gracefully handle:
- File doesn't exist → skip the section, do not error
- File exists but empty → same as above
- Directory doesn't exist → create it (for writes) or skip (for reads)

Never use `fs.readFileSync` without a try/catch or existence check in a Forgeflow command.

**Review-time check:**
When reviewing a new Forgeflow command, grep for `readFileSync`, `readFile`, or `cat` of any `.forgeflow/` path — flag if not wrapped in existence checking.

---

## 3. Output Routing Gaps

**Pattern:** Agent writes to an expected location, downstream consumer reads from a different location. Neither agent knows. No error — just no signal passed.

**Seen in:**
- `SubAgents` — "Warden wrong-channel gap from 2026-03-25 debate was not addressed in `warden-review.md` — no output routing rule added." Warden's output was expected by Atlas at one path but Warden wrote to another.
- `Forgeflow` meta-work — Various `--sourced from--` comments in canonical references drift when preamble is edited without updating mode files

**Rule of thumb:**
Every agent output path and every consumer read path must be declared in the agent's frontmatter or a comment block. When either changes, the pair must update atomically — never one-sided.

**Review-time check:**
When an agent file's output location or a consumer's input location changes in the diff, require both sides updated in the same commit.

---

## 4. Prompt Scaffolding Enforcement (from /debate calibration)

**Pattern:** Descriptive voice profiles ("Compass uses short sentences") produce average-short output but no hard floor. Model ignores the guideline unless it's a must-appear-once-per-turn RULE.

**Seen in:**
- `Forgeflow` V4.1.4 changelog — three classes of debate transcript fixes. Voice rules converted from descriptive to prescriptive with per-turn enforcement. Verbal tics that were listed as "occasional" never appeared until mandated.
- `SubAgents` — similar pattern in agent output quality — rules expressed as "should" tend to be ignored; rules expressed as "must appear at least once" reliably appear.

**Rule of thumb:**
For agent output discipline, express constraints as:
- "Must <verb> at least once per turn"
- "No <X> exceeds <N> <units>"
- "Must never <Y>"

Not as:
- "Tends to <verb>"
- "Often uses <pattern>"
- "Avoids <Y>"

Prescriptive > descriptive for output constraints.

**Implement-time check:**
When writing an agent prompt, every voice or style rule must be testable — if you can't write a regex to detect compliance, the rule is too soft.

---

## 5. Safe Command Output Reduction

**Pattern:** Development commands often emit far more output than agents need. Passing tests, progress bars, repeated log lines, unbounded directory listings, and giant JSON dumps can dominate context without adding decision value.

**Risk:** Output reduction is safe only for human-narrative output. It is unsafe for machine-exact output where byte-level completeness is load-bearing.

**Safe classes:**
- Test runners: keep failures, assertions, stack frames, and failure file paths.
- Build/typecheck: keep errors and warnings grouped by file when possible.
- Lint: keep violations, rules, and file/line references.
- Logs: keep warnings/errors/fatal lines and dedupe repeats.
- Grep/search: group by file and truncate long lines.
- Directory listings: bound depth and exclude generated directories.
- JSON: compact formatting only when parsing succeeds.

**Unsafe classes that must remain raw:**
- Diffs, patches, and anything intended for `git apply` or `patch`
- SHAs, hashes, exact file lists, and name-only/status output consumed by tools
- Exit-code-bearing output when the full transcript is needed to diagnose the command

**Rule of thumb:**
Use narrow invocations first. Prefer `git diff --stat`, `git log --oneline -20`, bounded `find`, test failure tails, no-color typecheck output, and focused grep. If a compactor cannot parse safely, it must return raw output with an explicit reason. Silent empty output is always a correctness bug.

**Review-time check:**
Flag any helper or command that compacts `git diff`, patches, exact file lists, SHAs, or tool-fed output. Require tests proving unsafe output passes through raw and malformed input fails loud.

---

## Promotion criteria

A pattern qualifies for this file when it meets all of:
1. Flagged in a tooling/infra project's review or debate calibration
2. Applies generally to agent-orchestration work (not domain-specific)
3. Has a concrete rule of thumb and a review-time check

These patterns apply when reviewing the Forgeflow itself, or other Claude Code agent systems. They do NOT apply to normal application code review — use `recurring-blockers.md` for that.
