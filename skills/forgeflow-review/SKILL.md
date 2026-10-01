---
name: forgeflow-review
description: Run Forgeflow review with evidence-first findings and validation follow-up.
---

# forgeflow-review

Use this skill when the host supports skill discovery but not Forgeflow slash-command browsing.

In Codex, execute this skill directly; do not invoke `/review`, which is a Codex built-in. In Claude Code, run `/review`. If slash commands are unavailable, follow the same objective manually and preserve current user instructions, local evidence, validation, security, accessibility, and repository boundaries.

Do not commit, push, install dependencies, edit host settings, call the network, or launch long-running services unless the user explicitly asks or the command workflow requires it.

## Immutable review evidence

Resolve helpers from the checkout scripts/forgeflow first, then the installed Forgeflow runtime for this host. In Codex, follow the maintained forgeflow-review skill when installed; otherwise use this same evidence sequence directly with native reviewer dispatch. Do not substitute a Codex built-in review.

Capture successful build-context-pack.js --root <project-root> --json output. Pin its exact returned run_dir and evidence_ref.manifest_sha256 through dispatch and synthesis. Save returned evidence_ref as a unique local JSON reference file outside the seal; use that file with review-evidence-cli.js inspect --root <project-root> --ref <pinned-reference> --require-current. Build or inspection failure stops packet-backed review; never fall back to context/latest. Read agent-packets and synthesis-input.json from that same run. Reinspect before synthesis. Hash integrity, source freshness and claim truth are separate.

Run check-context-budget.js --root <project-root> --file <run_dir>/context-telemetry.json --warn-only --json against selected telemetry. Keep lean advisory output, history, reviewer reports and decisions outside the sealed run. If using advise-context.js --record, supply --root <project-root> --file <run_dir>/context-telemetry.json and --history <project-local-path-outside-run>. Preserve native host authorization.

For consequential proof consumption, use review-evidence-cli.js retrieve --root <project-root> --ref <pinned-reference> --artifact <manifest-artifact-id>; use --raw-required when full proof is required. Save actual result and decision bytes outside the sealed run, then opt in to record --root <project-root> --ref <pinned-reference> --id <unique-id> --kind review --result <actual-result-path> --decision <actual-decision-path> --artifacts <consumed-artifact-ids>. Use kind synthesis for synthesis and retain the returned separate sidecar in the local report/task evidence. Native identities stay unknown when unobserved. Do not invent decisions or treat successful inspection as claim truth. This does not require an E3 claim ledger for every observation.

## Local-only workflow boundary

- Treat every `.forgeflow/` directory, its contents, and workflow agent identities as local working context only. Never stage, commit, push, attach, upload, or sync this state, including through memory-sync commands. Use Git's local `info/exclude` for generated state; never force-add it. Ignore rules do not protect already tracked files.
- Never include local artifact paths, agent names, persona names, role labels, agent verdict attribution, or workflow signatures in PR titles, bodies, comments, commit messages, release notes, or published artifacts. Describe the change and observed validation in ordinary engineering language. Keep detailed review attribution and evidence links in local reports.
- Never insert workflow agent identities or local evidence references into application source, comments, docstrings, tests, fixtures, identifiers, UI text, or shipped documentation. Use domain-based names and explain technical reasons without agent attribution.
- Before staging or publishing, inspect the actual staged diff, outgoing commits, and public text. A local-state file or workflow attribution leak blocks the action until corrected. Do not silently delete local evidence or rewrite existing history; report already tracked or committed state for cleanup.
- These rules govern project work produced with Forgeflow. Forgeflow's own maintained agent definitions, integration code, and documentation may name the agents and state paths needed to implement the tool; generated session state is always local. Ordinary domain terms that happen to match a role name are not workflow attribution.
- Local CLI labels, orchestration messages, and local report schemas may retain identities. This boundary takes precedence over instructions to copy local reports into public output or sync session memory.
