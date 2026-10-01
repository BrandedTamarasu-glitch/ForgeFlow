---
name: forgeflow-review
description: Run the Forgeflow review workflow by spawning specialist reviewers, then synthesizing with Architect and final-checking with Product Lead.
---

<!-- forgeflow-capability-selection:start -->
## Automatic capability selection

Resolve `select-capabilities.js` from the checkout `scripts/forgeflow`, a host-supplied plugin root, or the installed ForgeFlow runtime for this host. Run `node <helper-dir>/select-capabilities.js --guide` and follow the shared selection procedure with phase **review** and the current objective, criteria and affected scope. Reuse the same result across alias handoffs and pass it through existing context construction; do not reset reassessment limits. Missing runtime support is an explicit limitation, not a reason to invent selection results. Preserve current workflow read-only and isolation boundaries. Planned capabilities are not executable and selection grants no new authority.
<!-- forgeflow-capability-selection:end -->

At workflow entry, run `node <helper-dir>/open-session-dashboard.js --root <project-root> --workflow forgeflow-review` when available. Resolve `<helper-dir>` from the checkout's `scripts/forgeflow` first, then `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. The helper starts or reuses agent-chat and reports known workflow phases on each entry; it uses `CODEX_THREAD_ID`, `CLAUDE_SESSION_ID`, or `FORGEFLOW_SESSION_ID` to open the local dashboard once per session. If the host supplies a session id separately, pass `--session <host-session-id>`; never invent a new id per invocation. Headless runs and `FORGEFLOW_DASHBOARD_AUTO_OPEN=off` skip the launch. A missing helper or unavailable browser must not block the workflow. Report actual phase transitions, significant progress, waiting, and the final result with `node <runtime-root>/services/agent-chat/client.js activity <state> "<short label>"` (`<runtime-root>` is the checkout or installed `forgeflow` directory). Use `complete` only when work and required checks have finished; report `failed` for failures, and never invent progress to keep Ember moving.


Use this skill when the user wants a multi-agent review of current changes, specific files, or a diff against a git ref.

Resolve helpers before running them: set `FORGEFLOW_HELPER_DIR` to `scripts/forgeflow` when that directory exists, otherwise to `${CODEX_HOME:-$HOME/.codex}/forgeflow/scripts/forgeflow`. A missing helper means the Codex runtime installation needs repair; it does not mean review is unsupported in Codex.

Before other work, run:

```bash
"$FORGEFLOW_HELPER_DIR/ensure-forgeflow-state.sh"
```

Workflow:
1. Determine review scope from the user request.
2. Explain the route before spawning agents. Prefer:

```bash
scripts/forgeflow/explain-review-route.js --json
```

   If a calibration summary exists, include it:

```bash
scripts/forgeflow/explain-review-route.js --json --calibration .forgeflow/Forgeflow/calibration-summary.json
```

3. For route skip, stop without dispatch/session/challenge. For every other packet-backed route, prepare `REVIEW_ASSIGNMENTS_INPUT` with concrete questions as specified below before construction. Set `PROJECT_ROOT="$PWD"` and `REVIEW_MODE` to the already resolved route mode (`thin`, `full` or `deep`); never classify a second narrower scope for compilation. Build a local context pack using the resolved helper directory. Capture the successful JSON result; a build failure stops packet-backed review, without falling back to mutable latest:

```bash
CONTEXT_BUILD_JSON=$(node "$FORGEFLOW_HELPER_DIR/build-context-pack.js" --root "$PROJECT_ROOT" --mode "$REVIEW_MODE" --review-assignments "$REVIEW_ASSIGNMENTS_INPUT" --json) || exit 1
CONTEXT_PACK_DIR=$(printf '%s' "$CONTEXT_BUILD_JSON" | node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{const r=JSON.parse(s);if(!r.run_dir || !r.evidence_ref?.manifest_sha256)process.exit(1);process.stdout.write(r.run_dir)})') || exit 1
CONTEXT_EVIDENCE_REF=$(mktemp "${TMPDIR:-/tmp}/forgeflow-review-ref.XXXXXX") || exit 1
printf '%s' "$CONTEXT_BUILD_JSON" | node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>process.stdout.write(JSON.stringify(JSON.parse(s).evidence_ref)))' > "$CONTEXT_EVIDENCE_REF" || exit 1
node "$FORGEFLOW_HELPER_DIR/review-evidence-cli.js" inspect --root "$PWD" --ref "$CONTEXT_EVIDENCE_REF" --require-current || exit 1
```

   Run from the project root. Pass `--files`, `--lines`, `--mode`, and `--calibration` when already resolved. Preserve the exact returned `run_dir` and reference, including expected manifest SHA-256 and source scope, across dispatch and synthesis. Use that run's `agent-packets/<agent>.md` and `synthesis-input.json`; never rediscover `context/latest`. Reinspect the same reference before synthesis. Missing, changed, incomplete, stale or unknown source proof stops current proof; explain the limitation and rebuild. Intact hashes do not prove claim truth.
4. Run budget checks against the selected run only:

```bash
node "$FORGEFLOW_HELPER_DIR/check-context-budget.js" --root "$PWD" --file "$CONTEXT_PACK_DIR/context-telemetry.json" --warn-only --json
REVIEW_ADVISORY_HISTORY="$PWD/.forgeflow/$(basename "$PWD")/review-advisory/context-advisor-history.jsonl"
node "$FORGEFLOW_HELPER_DIR/advise-context.js" --root "$PWD" --file "$CONTEXT_PACK_DIR/context-telemetry.json" --history "$REVIEW_ADVISORY_HISTORY" --record --json
```

   Surface warnings, trend deltas and trim recommendations. Keep history, lean advisory output, reviewer reports and later decisions outside the sealed run. Never write advisory files into it.
5. Read only the files needed for that scope. Prefer exact files or `git diff --name-only`; avoid re-reading files already covered by the context pack unless exact source lines are needed.
6. Spawn reviewer agents in parallel according to the route:
   - `builder_reviewer`
   - `guardian_reviewer`
   - `designer_reviewer`
   - `coordinator_reviewer`
7. Preserve the route's unchanged required roster: thin uses its required reviewers; full retains all four; deep also retains its required dedicated audit identity. Never drop mandatory accessibility or security coverage. Resolve bounded requests and resume the relevant reviewer. Retain actual responses through the session.
8. Prepare and retain the independent neutral challenge before peer exposure and before this existing claim-bearing verifier. Before Architect synthesis, send high-risk findings through `verifier`:
   - security
   - auth, session, permissions, tenant isolation
   - migration, schema, data loss
   - critical correctness
   - broad refactor regression
   - accessibility blocker
9. Run `synthesis` for the pinned session and preserve current retained references, required coverage and unresolved statuses. Wait for reviewer, challenge and verifier outputs, then spawn `architect_reviewer` with the collected findings, verifier decisions, routing note, and the file list.
10. Spawn `product_lead_reviewer` after Architect with:
   - Architect's verdict
   - reviewer outputs
   - verifier outputs
   - routing note
   - any available plan, research, or discussion notes from `.forgeflow/`
11. Return findings first. Summaries come after findings.

Rules:
- Keep review file-scoped. Do not broaden scope without evidence.
- Review agents should not edit files.
- Persona confidence is not evidence. High-risk claims need neutral verification before becoming blockers.
- Include a routing note in the final response: mode, agents included/skipped, verifier used/skipped, telemetry hints, and why.
- Product Lead may run targeted tests when that materially improves the review.
- If the user asks for a "review", default to this skill.

Suggested prompts:
- `$forgeflow-review review this branch against main`
- `$forgeflow-review review src/auth.ts and src/routes/session.ts`

## Retain consequential proof when used

Outside an enabled focused-question session only, for a consequential claim using retained evidence, use `review-evidence-cli.js retrieve --root <project-root> --ref "$CONTEXT_EVIDENCE_REF" --artifact <manifest-artifact-id>`; optional `--start-line`, `--end-line` and `--max-chars` return neighboring context with explicit omissions. Use `--raw-required` when complete proof is required; excerpts cannot silently satisfy it.

In legacy unenforced mode only, after saving actual reviewer/tool result and actual decision bytes outside the sealed run, opt in to `review-evidence-cli.js record --root <project-root> --ref "$CONTEXT_EVIDENCE_REF" --id <unique-consumption-id> --kind review --result <saved-actual-result-path> --decision <saved-actual-decision-path> --artifacts <consumed-artifact-ids>`. Use `--kind synthesis` for synthesis. Preserve the returned sidecar reference in the local report and task evidence when applicable. Do not invent native identities or infer a decision from successful inspection; recording failure remains visible. This proof retention does not impose an E3 mandatory claim ledger on every observation.

## Focused questions and bounded follow-up

For every non-skip packet-backed review, supply concrete questions before compilation with `--review-assignments "$REVIEW_ASSIGNMENTS_INPUT"`. The trusted local JSON input has `{schema_version:"1",assignments:[{assignment_id,reviewer,question,artifact_ids,expected_evidence}]}`. Use the unchanged canonical route roster, including required audit coverage, with exactly one falsifiable project question per required reviewer and nonempty expected-evidence descriptions. Authorized IDs name sealed source/diff/original-contract inputs, never peer reports, answer keys or advisory memory. Before construction use `source-<sha256(repository-relative normalized slash path)>` for source and `git-diff-full` for the diff; after seal inspect the actual `authorized_evidence_artifacts` inventory and confirm IDs/coverage. The returned `required_reviewers` and `review_assignments` must match the supplied contract. Questions focus attention while preserving independent discovery, security, accessibility and every ordinary domain duty. Do not invent generic role slogans or use question planning as another model wave. Missing helper, roster member or decisive evidence is a visible coverage gap; stop enforced dispatch and repair it. Skip has no dispatch, session or challenge. `--no-context-pack` is explicitly legacy unenforced behavior, unsupported for E3 immutable enforcement. A compiler call without assignments records `focused_questions: "not_enabled"` and cannot claim E3 enforcement.

After successful compilation and current E2 inspection, the orchestrator prepares `REVIEW_SESSION_INPUT` outside the seal: `{schema_version:"1",evidence_ref:<exact returned ref>,required_reviewers:<unchanged canonical roster>,assignments:<same concrete assignments>,limits:{}}`. Missing limits use hard ceilings; values may only lower them, including zero. Persist the returned session reference in a unique trusted local file outside the seal, keep it across chunks/restarts/alias handoffs, and never choose a latest session:

```bash
REVIEW_SESSION_JSON=$(node "$FORGEFLOW_HELPER_DIR/review-questions-cli.js" start --root "$PROJECT_ROOT" --input "$REVIEW_SESSION_INPUT" --json) || exit 1
REVIEW_SESSION_STATE_DIR="$PROJECT_ROOT/.forgeflow/$(basename "$PROJECT_ROOT")/review-session-inputs"
[ ! -L "$REVIEW_SESSION_STATE_DIR" ] || exit 1
mkdir -p -m 700 "$REVIEW_SESSION_STATE_DIR" || exit 1
REVIEW_SESSION_REF=$(mktemp "$REVIEW_SESSION_STATE_DIR/session-ref.XXXXXX") || exit 1
printf '%s' "$REVIEW_SESSION_JSON" | node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{const r=JSON.parse(s);if(!r.session_ref)process.exit(1);process.stdout.write(JSON.stringify(r.session_ref))})' > "$REVIEW_SESSION_REF" || exit 1
node "$FORGEFLOW_HELPER_DIR/review-questions-cli.js" inspect --root "$PROJECT_ROOT" --session "$REVIEW_SESSION_REF" --json || exit 1
```

In command hosts use `FORGEFLOW_HELPER_DIR="$HELPER_DIR"`; in skill hosts use the already resolved helper directory. Run from the project root. Input and session reference files are trusted orchestrator-owned files within the project's local `.forgeflow`, outside the seal; safe readers reject outside-root paths. Never let reviewer payloads select paths or overwrite references. The full review has at most **2 requests/reviewer, 4 requests/review, 64 KiB serialized response/request, 128 KiB/review and 2 independent challenges/review**, shared across all chunks, retries, denied attempts and resumed calls. Deep audit and mandatory accessibility coverage remain required; if the roster exceeds supported capacity, report unsupported coverage rather than dropping members. Freeze the union of required chunk reviewers before compilation, including any deep audit identity; never use the wave builder's thin override. Do not start a fresh session per chunk or silently refund/reset budgets. In incremental mode each changed source identity requires an explicitly new contract; never mix old judgments or reset a single review's allowance invisibly.

### Request and resume

Give each reviewer its concrete assignment and allowed artifact IDs. A reviewer needing decisive proof returns only `{schema_version:"1",request_id,assignment_id,reviewer,artifact_id,extent,why_decisive}`, where extent is `{mode:"full"}` or `{mode:"lines",start_line,end_line}`. No paths, refs, commands, tools, limits, counters or scope expansion. In enabled mode route all follow-up through the session, not direct mutable file reads or unaccounted E2 retrieval. The orchestrator saves the actual request as a trusted local input and resolves it:

```bash
node "$FORGEFLOW_HELPER_DIR/review-questions-cli.js" request --root "$PROJECT_ROOT" --session "$REVIEW_SESSION_REF" --input "$REVIEW_REQUEST_INPUT" --json
```

Resume only the relevant reviewer with the retained resolution and original assignment. Fulfilled delivery contains exact UTF-8 evidence or explicit line-context omissions; inspect status before using it. Denied, exhausted, unavailable, stale and interrupted requests leave decisive questions unresolved. Successful retrieval is execution state, not claim truth. Absent proof needs explicit new-run authorization and visibly reissued assignments; never automatic supplements or mixed evidence identities. Save complete actual resumed result and existing decision bytes outside the seal. The orchestrator records `{schema_version:"1",response_id,kind:"reviewer",subject_id:<assignment_id>,result_path,decision_path,artifact_ids}` with trusted project-relative result paths:

```bash
node "$FORGEFLOW_HELPER_DIR/review-questions-cli.js" response --root "$PROJECT_ROOT" --session "$REVIEW_SESSION_REF" --input "$REVIEW_RESPONSE_INPUT" --json || exit 1
```

Keep the existing public finding envelope, E1 claim sidecars and evaluator schemas. Retain complete actual responses, not a summary or inferred approval. Never turn request completion into a supported claim.

### Independent challenge before peer exposure

Before exposing any reviewer response to the challenger, and before existing claim-bearing high-risk verification, prepare a consequential neutral challenge from the original user contract and question. Input is exactly `{schema_version:"1",challenge_id,assignment_id,question,original_contract,artifact_ids,user_constraints}`; IDs must be a subset of authorized neutral inputs. Ask which alternatives fit the source and which distinguishing observation resolves them. Do not send the initial claim proposition/direction, peer identity, verdict, severity, repair, rationale, reviewer-derived facts, grader output or expected answer.

```bash
node "$FORGEFLOW_HELPER_DIR/review-questions-cli.js" challenge --root "$PROJECT_ROOT" --session "$REVIEW_SESSION_REF" --input "$REVIEW_CHALLENGE_INPUT" --json || exit 1
```

Inspect the exact prepared prompt/export inventory before dispatch. Use a fresh restricted case-only challenger with no full-history fork, sibling memory or peer reports. Record actual host/settings/isolation limits; prompt-only separation is labelled as such and is not OS isolation. Preparation consumes one of the two global challenge calls even if interrupted. Save complete actual challenge response and decision, then use the same `response` command with `kind:"challenge"` and `subject_id:<challenge_id>`. No universal extra reviewer wave. Challenge completion requires retained actual bytes; uncompleted reservations remain unresolved. Then retain the existing high-risk verifier gate with its claim-bearing inputs.

### Current synthesis and unresolved coverage

Before synthesis, prepare current proof from this same session:

```bash
node "$FORGEFLOW_HELPER_DIR/review-questions-cli.js" synthesis --root "$PROJECT_ROOT" --session "$REVIEW_SESSION_REF" --json || exit 1
```

Give synthesis and final acceptance the returned current retained references, unchanged roster coverage and unresolved statuses alongside original packets and ordinary reports. This command implements `prepareSynthesis`; it does not approve the review. Missing/exhausted evidence or missing required reviewer/challenge responses stay explicit unresolved questions, never supported findings or clean acceptance. Source/integrity failure stops current adjudication; historical intact bytes remain historical. Preserve normal full/deep/audit/accessibility duties, route skip behavior and final acceptance. Focused implementation tests support safety only; roadmap closure still requires observed real-PR behavior, independence and the frozen overhead gate.

## Change reflection

Give Architect and Product Lead the author's change reflection when available and the questions below. Independently assess each answer against the diff and validation evidence; do not rubber-stamp the author's claims. If answers are missing, provide a reviewer assessment and identify unknowns. Include the assessment after findings in the saved review report and final summary.

1. **Is this the simplest change that solves the problem?** Explain the chosen approach and any smaller alternative considered.
2. **Is the complexity proportional to this project's scale and risk?** Use known users, operations, and maintenance needs; state assumptions when unknown. A 100-user internal app is an example, not a default or a reason to drop required safeguards.
3. **One PR = one concern: did anything unrelated sneak in?** State the concern and connect the changed files to it. Flag unrelated work for a separate change.
4. **In your own words, why does this change work?** Explain how the changes produce the intended outcome. For process-only changes, explain the workflow effect.
5. **How did you verify it, and what did you see?** Give actual commands or manual steps, observed results, and untested limits. For documentation or process changes, describe the instruction or command checks performed and why application tests are inapplicable when that is the case.

6. **Does this resolve the issue long-term, or is it a band-aid?** Explain whether the underlying cause is addressed. A temporary workaround is viable, but the PR must explain its limitations and the long-term solution, link an associated GitHub issue, and state the agreed timeline. If the issue or timeline is missing, report the gap explicitly; never invent an issue link or commitment.
7. **Were bugs found outside this PR's scope?** Capture each discovered bug as a follow-up with evidence or reproduction steps, user impact, and an existing issue link or a local tracking entry awaiting filing. Keep unrelated fixes in separate work; do not discard bugs because they are out of scope.
8. **How does this change affect users, and is training needed?** Describe the affected users and workflow changes. Identify required documentation, onboarding, release notes, or training and their readiness, or explain why none is needed.
9. **Do user-facing errors explain what happened and what to do next?** Check changed failure paths for clear, accurate messages and actionable recovery steps without exposing sensitive details. Cite observed behavior and untested paths, or state why this is not applicable.

Reuse existing issues where possible. Create or update GitHub issues only within current remote-write authorization. Otherwise save an actionable issue draft in local implementation notes and surface the pending filing and timeline decisions in the handoff and PR assessment; a draft does not satisfy the associated GitHub issue requirement. Missing follow-up details remain visible without introducing an automatic approval pause.

Keep answers brief and specific to the current diff. AI collaboration alone is not verification evidence. Label agent-written answers as an agent assessment; never imply a human inspected, understood, or approved the change without their input. These prompts guide reflection and do not add hooks, hard gates, or mandatory confirmation pauses.

## Record explicit review outcomes

After Architect or Product Lead issues an actual final decision, save that decision and its supporting evidence in a project-local report, then record it once with the shared telemetry helper:

```bash
node <runtime-root>/hooks/forgeflow-telemetry.js record-verdict --cwd <project-root> --reviewer <architect-or-product_lead> --verdict "<exact-decision>" --evidence <saved-report-relative-path> --event-id <stable-outcome-id> --command /<workflow-name> --session <host-session-id>
```

Resolve `<runtime-root>` from the checkout first, then `${CODEX_HOME:-$HOME/.codex}/forgeflow`. Architect decisions are `APPROVE`, `CONDITIONAL APPROVE`, `REVISE`, or `BLOCK`; Product Lead decisions are `CONFIRM` or `CHALLENGE`. Record only an explicitly issued decision, never infer approval from passing tests, silence, or an implementation summary. If a final decision is absent, ask the reviewer to state it or leave the outcome unrecorded. Reuse the same event id on retries; use a distinct id for each reviewer and review round, such as `<host-session-id>.review-2.architect`. The helper rejects conflicting reuse and prevents duplicate counts. Session can be omitted when `CODEX_THREAD_ID` or `FORGEFLOW_SESSION_ID` is present. A recording failure must be reported without changing the review result or fabricating history.


## Task evidence continuity

Use the shared task workflow for a bounded change with an accepted objective or brief. Resolve `task.js` from the same runtime helper directory used above. Run `list --root <project-root>` and reuse only the task explicitly selected by the user or matching the current objective and scope. Do not attach an unrelated task based only on recency. If this is a new accepted change, create a task using its objective and behavioral acceptance criteria; the task workflow describes the JSON contract.

Keep the same task id across consult, implement, review and ship. Use `check` for actual validation commands and saved `evidence` for observed manual/reviewer results. Record a `checkpoint` at each completed phase and before interruption, including the actual host/session identity when available. A saved plan, successful build, or reviewer verdict alone must not mark every criterion verified. Waivers require explicit user intent and a reason.

Before reporting completion or preparing a shipping handoff, read `status --root <project-root> --task <id>`. Stale/missing/failed criteria and pending actions remain visible. Reconcile interrupted actions from actual evidence, then use `resume`; never silently replay unknown work. Legacy work without task records stays supported but has no source-bound task completion claim. All remote authorization rules above still apply.

## Writing for CLI output

Apply George Orwell's six rules to progress updates, agent reports, and final summaries:

1. Never use a metaphor, simile, or other figure of speech which you are used to seeing in print.
2. Never use a long word where a short one will do.
3. If it is possible to cut a word out, always cut it out.
4. Never use the passive where you can use the active.
5. Never use a foreign phrase, a scientific word, or a jargon word if you can think of an everyday English equivalent.
6. Break any of these rules sooner than say anything outright barbarous.

Lead with the result or next action and its effect on the user's task. Match their technical background and requested detail. Explain an unfamiliar term when needed; retain precise terms for specialist reports. Use a calm, conversational voice and natural contractions. These rules take precedence over persona style and sample prose.

Use connected, short paragraphs with natural sentence variation. Use lists for steps or comparisons and headings when they help navigation. Cut repeated openings, stock transitions, rhetorical questions, forced praise, persona banter, and em dashes in prose. Warmth comes from noticing the user's actual concern and helping them act.

Progress updates should explain a finding, decision, blocker, or what the next check will resolve. Avoid narrating each tool call or repeating the plan. Ask only for information or authorization needed to proceed; explain why it matters. Final replies should stand alone: state what changed, why, what was checked, and any remaining action. Scale the detail to the task. Summarize routine checks; include tool names, versions, and internal counts only when they affect the reader's next decision. Keep validation gaps explicit.

Replace vague benefits with observable behavior. Use a brief example when it clarifies the change; label hypothetical examples. Never invent measurements, personal experiences, user reactions, test results, or approvals to make writing vivid. Keep uncertainty and failures explicit.

Preserve exact commands, code, paths, identifiers, error text, schema keys, verdict labels, and required evidence. Keep required report sections and machine-readable formats; apply style changes only to their prose. JSON-only outputs stay JSON-only. Before sending, check for awkward rhythm, repetition, unsupported claims, and whether the reader can tell what happens next. Clarity and faithful evidence are the goal; detector scores are not a quality gate.

## Local-only workflow boundary
- Treat every `.forgeflow/` directory, its contents, and workflow agent identities as local working context only. Never stage, commit, push, attach, upload, or sync this state, including through memory-sync commands. Use Git's local `info/exclude` for generated state; never force-add it. Ignore rules do not protect already tracked files.
- Never include local artifact paths, agent names, persona names, role labels, agent verdict attribution, or workflow signatures in PR titles, bodies, comments, commit messages, release notes, or published artifacts. Describe the change and observed validation in ordinary engineering language. Keep detailed review attribution and evidence links in local reports.
- Never insert workflow agent identities or local evidence references into application source, comments, docstrings, tests, fixtures, identifiers, UI text, or shipped documentation. Use domain-based names and explain technical reasons without agent attribution.
- Before staging or publishing, inspect the actual staged diff, outgoing commits, and public text. A local-state file or workflow attribution leak blocks the action until corrected. Do not silently delete local evidence or rewrite existing history; report already tracked or committed state for cleanup.
- These rules govern project work produced with Forgeflow. Forgeflow's own maintained agent definitions, integration code, and documentation may name the agents and state paths needed to implement the tool; generated session state is always local. Ordinary domain terms that happen to match a role name are not workflow attribution.
- Local CLI labels, orchestration messages, and local report schemas may retain identities. This boundary takes precedence over instructions to copy local reports into public output or sync session memory.
