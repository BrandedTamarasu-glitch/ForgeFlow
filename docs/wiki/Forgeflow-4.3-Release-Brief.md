# Forgeflow 4.3.0 Release Brief

Forgeflow 4.3.0 turns the last few weeks of learning, topology, smoke, and pilot work into a release that is much easier to install, verify, and trust on real projects.

The big shift: Forgeflow is no longer just a multi-agent review workflow. It now has a local feedback loop around the work itself. It can build project context, learn from completed work items, map code topology, refresh agent guidance, verify the install, run a smoke check, and package the evidence from a pilot.

## What Is New

### Codex Is A First-Class Path

Forgeflow now ships Codex agents and skills alongside the Claude Code commands:

- Codex template install writes agents, skills, and the Forgeflow command map into a Codex home.
- Codex users can run the same lifecycle through skills like `$consult`, `$implement`, `$forge-review`, and `$ship`.
- The clean-checkout release pass verified a disposable Codex install with 26 agents and 18 skills.

This matters because Forgeflow can now be evaluated in both Claude Code and Codex without maintaining two separate workflows.

### One-Command Local Smoke Check

New command:

```text
/forgeflow-smoke
```

Backed by:

```bash
scripts/forgeflow/smoke-check.js
```

The smoke check runs the core stabilization path in one pass:

- health
- project trends refresh
- Forgeflow report refresh
- code map
- docs link guard
- release metadata guard

It reports pass, warn, or fail with the exact command to inspect next. It also handles the common first-run case where health says latest insights are missing, then the same smoke run refreshes them successfully.

### Maintainer Pilot Script

New command:

```text
/forgeflow-pilot
```

Backed by:

```bash
scripts/forgeflow/render-pilot-script.js
```

This prints a bounded trial plan for a maintainer:

- install verification
- baseline smoke
- trends/report/code-map checks
- one real work item
- review
- final report
- pilot evidence capture
- support/adoption rollup
- public-safe result template

This gives someone like Zach a concrete path to evaluate Forgeflow without reading the whole wiki or inventing the trial shape live.

### Project Learning Loop

Forgeflow now carries useful project knowledge across work items:

- implementation notes capture decisions, spec gaps, tradeoffs, deviations, follow-ups, and validation notes
- project learnings roll up recurring pitfalls, stable decisions, risk areas, validation patterns, hot files, and recommended approaches
- latest insights are quality-gated before being injected into agent context
- agents use these insights as guidance, not proof, so current code and tests still decide the finding

The result is a workflow that gets more useful after several work items because it can surface project trends and repeated pitfalls back to the agents.

### Code Topology And Code Map

Forgeflow now builds a static JS/TS project map:

- fan-in and fan-out hotspots
- changed-file neighborhoods
- source symbol and Markdown section mapping
- changed-section hints
- Git provenance
- unresolved and dynamic import gaps
- compact context packets for reviewers

This is not a runtime call graph, and it does not pretend to be one. It is a prioritization tool: it tells reviewers and agents where to look first.

### Smarter Import-Gap Handling

The code map still shows every unresolved or skipped dynamic import, but Forgeflow now classifies gaps as:

- `production`
- `test-fixture`

Trends, reports, and smoke checks escalate production-scope gaps. Test/fixture-only gaps stay visible as informational context. That keeps smoke checks useful without hiding real data.

### Cleaner Release Confidence

Before tagging 4.3.0, the release path was verified from a clean checkout:

- disposable Claude install
- disposable Codex install
- installed helper health repair
- clean smoke check
- full local release-check suite
- plugin and marketplace version alignment
- hosted docs release-note link

The release is tagged and published as `v4.3.0`.

## Why This Is Better Than Review Squad Alone

Review Squad-style workflows are good at sending multiple reviewers at a diff. Forgeflow now does that plus the surrounding delivery system:

- plan, consult, implement, review, and ship paths
- specialist agents with explicit responsibilities
- evidence-only verification through Aegis
- local project memory and project learnings
- code topology and hotspot guidance
- latest-insights injection into agent packets
- install health and repair checks
- smoke checks before commit, push, or pilot
- pilot evidence and adoption rollups
- Codex and Claude Code support

The value is not just more agents. It is better routing, better context, better evidence, and a local loop that improves as the project evolves.

## Suggested Message To Zach

Forgeflow 4.3.0 is the first version I would call pilot-ready. The major addition is the local learning and verification loop around the agents.

It now supports Claude Code and Codex, has one-command smoke checks, generates a maintainer pilot script, maps JS/TS code topology, feeds quality-gated project insights into agents, and records pilot evidence without sharing raw local state.

The cool part is that Forgeflow can learn from the project as work items land. After a few cycles, it can surface recurring pitfalls, hot files, validation patterns, and recommended approaches, then pass that guidance back into future agent context. The agents still have to prove findings against current code, but they start with better project-specific instincts.

We also verified the release from a clean checkout with disposable Claude and Codex installs. So this is not just a feature dump. It has a repeatable install, smoke, pilot, and release path.

If you want to evaluate it, the path is simple: install 4.3.0, run `/forgeflow-smoke`, then run `/forgeflow-pilot` and use the generated script on one bounded real branch.
