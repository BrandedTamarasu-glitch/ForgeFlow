# Agent Roles

Forgeflow uses focused agents rather than one all-purpose assistant.

| Agent | Focus | Primary Modes |
|---|---|---|
| Smith | backend craft, data, quality | consult, implement, audit, review |
| Warden | security, systems, reuse | consult, implement, audit, review |
| Lumen | UX, accessibility, connectivity | consult, implement, review |
| Atlas | coordination, memory, project continuity | early phases, consult, implement, review |
| Arbiter | architecture synthesis and verdict integrity | consult, implement oversight, review synthesis |
| Compass | product validation, requirements, UX intent | discuss, research, plan, implement validation, final review |
| Aegis | evidence-only verification | high-risk finding verification |

## Why Separate Agents?

Separate agents make responsibilities easier to audit:

- Smith can focus on code quality without becoming the security reviewer.
- Warden can evaluate threat paths and integration risk without owning UI polish.
- Lumen can treat accessibility and user-visible behavior as first-class concerns.
- Atlas preserves project context and coordination state.
- Arbiter resolves conflicts and turns parallel findings into a coherent verdict.
- Compass checks that the work still matches the intended product outcome.
- Aegis verifies high-risk claims from visible evidence only.

## How Roles Appear In A Session

A workflow selects the roles needed for its scope. Quick tasks and routed reviews can use a smaller team; audit uses deeper Smith and Warden passes. Arbiter synthesizes specialist evidence, and Compass checks the final outcome when the workflow calls for it. The role names describe responsibilities, not a fixed model or a guarantee that every agent runs.

Claude Code loads its agent definitions; Codex uses its installed agent configuration and skills. Available models and permissions depend on the host. If a configured role cannot run, report the limitation and any fallback instead of presenting a review as completed by that unavailable agent.

[Ember in the dashboard](Dashboard.md) is the visual representation of reported workflow activity. Ember does not add an independent reviewer or establish that a check passed.
