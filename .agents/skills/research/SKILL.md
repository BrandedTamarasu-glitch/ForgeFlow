---
name: research
description: Run the Forgeflow research workflow to evaluate options, prior art, codebase patterns, and risks.
---

Use this skill when the user wants research after discussion and before planning. Route focused tasks automatically with `render-research-divergence-advice.js`; divergence is the default policy outcome only when the helper recommends it.

Resolve helpers before running them: use `scripts/forgeflow` from the current checkout when present; otherwise use `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. If neither exists, report a missing Codex runtime installation.

Parse `--diverge` and `--no-diverge` first. Reject both together. `--diverge` forces divergence; `--no-diverge` forces normal research. With neither flag and a focused task, run:

```bash
node scripts/forgeflow/render-research-divergence-advice.js --task "<focused task>" --json
```

Use its recommendation and disclose the reason plus the exploratory latency/token tradeoff. With no focused task, use normal research and disclose that automatic routing needs a focused task. The user may override every automatic result.

For the normal workflow only, before other work run:

```bash
scripts/forgeflow/ensure-forgeflow-state.sh
```

Route selection must happen before this command. Divergent research is read-only: do not initialize state, build memory context, emit telemetry, or write any project file. Existing context may be read only for the independent Atlas evidence lane and later Compass critic.

Default workflow:
1. Load `.forgeflow/<project-name>/current-discussion.md` if present, plus any focused user questions.
2. Build compact local memory context with `scripts/forgeflow/build-memory-context.js` when available, then gather `CONTEXT.md` files and other narrowly relevant local context.
3. Spawn `compass_researcher` and `atlas_early` in parallel.
4. Synthesize Compass's recommendations with Atlas's codebase and memory findings.
5. Save the result to `.forgeflow/<project-name>/current-research.md` when appropriate.

`--diverge` workflow:
1. Run a preflight. Divergence is intended for open-ended, consequential choices with multiple plausible approaches. If automatic routing selected it for a lookup, a known-root-cause bug, a canonical-answer question, or a low-stakes choice, use the normal workflow and explain why. An explicit `--diverge` override still proceeds.
2. Do not inject project memory, discussion artifacts, existing recommendations, codebase evidence, or peer output into divergent branches. Extract only the task and immutable constraints. When available, use `scripts/forgeflow/render-research-divergence.js` (or the installed-runtime equivalent described above) to render the three deterministic branch packets, then launch the fixed frames in parallel:
   - `inversion`: assume the obvious approach fails; identify the opposite design and the conditions that make it work.
   - `remove-assumption`: remove one load-bearing assumption and derive a viable approach from the resulting constraint set.
   - `3am-on-call`: optimize for diagnosis, containment, and safe recovery by a tired on-call engineer.
3. Give each branch exactly the task, immutable constraints, its single frame, and the required candidate format. Keep lanes isolated. Treat frames as temporary reasoning instructions, not permanent agent roles.
4. Make missing or failed lanes visible. Retry each failed lane once; if it still fails, continue with the remaining lanes and label the result degraded. Never invent branch output.
5. Independently gather normal codebase and memory evidence with `atlas_early`; never expose it to the branches. After all lanes settle, give their outputs to a separate `compass_researcher` critic together with the normal discussion, compact memory, Atlas evidence, and accessibility context. The critic must return:
   - clusters by underlying approach and duplicated/shared assumptions
   - a shortlist of two to four candidates
   - for every shortlisted candidate: strength, attraction, hidden trap with its concrete mechanism, disconfirming test, salvage condition, and first implementation step
   - one non-obvious viable candidate
   - a load-bearing risk, first falsification experiment, and final recommendation
6. Raw lane prompts and outputs are ephemeral. Do not write them to `current-research.md`, project memory, memory-context inputs, `CONTEXT.md`, or any indexed artifact. Present the critic's converged decision content to the user without saving it; the entire divergent route is no-write.

On Claude, use the corresponding `compass-research`/`atlas-early` agents; on Codex, use `compass_researcher`/`atlas_early`. Preserve the isolation and critic boundaries on both hosts.

Output should include:
- options considered
- codebase patterns
- risks and tradeoffs
- accessibility implications
- clear recommendation

For `--diverge`, also include route rationale, lane status, clusters, the structured trap ledger, the non-obvious viable candidate, and the falsification experiment. Mark degraded results prominently.
