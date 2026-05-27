# User Profile Guidance

Forgeflow user profiles are local advisory preferences about how the user wants Forgeflow to operate and how a specific project should look, feel, and speak.

They are separate from project learnings:

- User operating profile: cross-project preferences for communication, autonomy, validation, release behavior, docs, risk handling, and handoffs.
- Project experience profile: project-local preferences for UI, product copy, accessibility, visual density, and project workflow.

## Artifacts

```text
~/.claude/forgeflow/user-operating-profile.jsonl
.forgeflow/<project-name>/project-experience-profile.jsonl
```

The global file stays under the local Claude home. It is not project state and should not be committed or synced. The project file stays under `.forgeflow/<project-name>/` and should remain local unless the project explicitly chooses to share a sanitized version.

## Command

Show the current compact profile:

```text
/forgeflow-profile
```

Run the quality gate:

```text
/forgeflow-profile --check
```

Record an explicit operating preference:

```text
/forgeflow-profile --record --scope global --category autonomy --preference "User prefers autonomous safe-slice execution." --evidence "Explicit user instruction." --confidence high --applies-to plan,implement,review,next-step
```

Record a project look/feel preference:

```text
/forgeflow-profile --record --scope project --category ui --preference "Project screens should feel quiet, dense, and operational." --confidence medium --applies-to plan,implement,review,ui
```

## Categories

Global operating categories:

- communication
- autonomy
- risk
- validation
- release
- docs
- review
- workflow

Project experience categories:

- ui
- product-copy
- accessibility
- workflow

## Quality Gate

`check-user-profile.js` validates:

- schema version
- supported category, scope, source, confidence, and status values
- bounded preference, evidence, guidance, and superseded text
- positive evidence counts
- required replacement text for superseded preferences
- sensitive-content patterns
- unsafe profile files or directories

If the quality gate warns or fails, context packs include a gate note instead of raw profile text.

## Context Injection

`build-context-pack.js` writes:

```text
.forgeflow/<project-name>/context/latest/user-profile.md
```

and includes a compact **User Profile Guidance** section in each agent packet. The packet artifact manifest records whether the profile was included or reduced to metadata-only.

The guidance is advisory only. It never overrides:

- explicit current-turn instructions
- correctness
- security
- accessibility
- validation evidence
- product judgment

## What To Record

Good global examples:

- User prefers concise progress updates with exact validation status.
- User prefers autonomous safe-slice execution unless tests fail, risk is high, product judgment is needed, or network/escalation is required.
- User wants README/wiki updates when public behavior changes.

Good project examples:

- This project should use compact operational layouts instead of marketing-style pages.
- Product copy should be plainspoken and avoid tutorial text in the primary UI.
- UI changes should verify keyboard, focus, contrast, loading, error, and mobile states.

Do not record secrets, private URLs, raw settings JSON, source snippets, customer names, or one-off guesses as high-confidence preferences.
