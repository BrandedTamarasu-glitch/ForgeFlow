# Workflow Commands

Forgeflow can be used as a full lifecycle or as targeted commands.

## Lifecycle

```text
/discuss -> /research -> /plan -> /consult -> /implement -> /review -> /ship
```

## Common Commands

| Command | Purpose |
|---|---|
| `/discuss` | Frame the problem, user needs, constraints, and open questions. |
| `/research` | Evaluate options, prior art, codebase patterns, and risks. |
| `/plan` | Produce a phased implementation plan with validation criteria. |
| `/consult` | Produce an implementation brief across architecture, security, UX, and coordination. |
| `/implement` | Execute the current brief with coordinated agents. |
| `/review` | Review changed files with explainable routing and multi-agent synthesis. |
| `/review-auto` | Apply conservative safe fixes, then re-review. |
| `/audit` | Run a deeper systems/security/craft audit. |
| `/ship` | Prepare presentation, PR, CI checks, and release handoff. |

## Codex Skills

Codex users can invoke skills directly:

```text
$discuss
$research
$plan
$consult
$implement
$forge-review
$ship
```
