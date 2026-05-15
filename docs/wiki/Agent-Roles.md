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
