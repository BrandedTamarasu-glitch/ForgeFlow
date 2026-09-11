# Agent Roles

Forgeflow uses focused agents rather than one all-purpose assistant.

| Agent | Focus | Primary Modes |
|---|---|---|
| Builder | backend craft, data, quality | consult, implement, audit, review |
| Guardian | security, systems, reuse | consult, implement, audit, review |
| Designer | UX, accessibility, connectivity | consult, implement, review |
| Coordinator | coordination, memory, project continuity | early phases, consult, implement, review |
| Architect | architecture synthesis and verdict integrity | consult, implement oversight, review synthesis |
| Product Lead | product validation, requirements, UX intent | discuss, research, plan, implement validation, final review |
| Verifier | evidence-only verification | high-risk finding verification |

## Why Separate Agents?

Separate agents make responsibilities easier to audit:

- Builder can focus on code quality without becoming the security reviewer.
- Guardian can evaluate threat paths and integration risk without owning UI polish.
- Designer can treat accessibility and user-visible behavior as first-class concerns.
- Coordinator preserves project context and coordination state.
- Architect resolves conflicts and turns parallel findings into a coherent verdict.
- Product Lead checks that the work still matches the intended product outcome.
- Verifier verifies high-risk claims from visible evidence only.

## How Roles Appear In A Session

A workflow selects the roles needed for its scope. Quick tasks and routed reviews can use a smaller team; audit uses deeper Builder and Guardian passes. Architect synthesizes specialist evidence, and Product Lead checks the final outcome when the workflow calls for it. The role names describe responsibilities, not a fixed model or a guarantee that every agent runs.

Claude Code loads its agent definitions; Codex uses its installed agent configuration and skills. Available models and permissions depend on the host. If a configured role cannot run, report the limitation and any fallback instead of presenting a review as completed by that unavailable agent.

[Ember in the dashboard](Dashboard.md) is the visual representation of reported workflow activity. Ember does not add an independent reviewer or establish that a check passed.

## Names and activity in logs

Forgeflow uses role names and the current activity, such as `Guardian · Security review` or `Product Lead · Acceptance check`. Activity belongs to each message. Old messages without activity show the role alone.

| Previous name | Current name | Runtime ID |
|---|---|---|
| Smith (`fc` in chat) | Builder | `builder` |
| Warden | Guardian | `guardian` |
| Lumen | Designer | `designer` |
| Atlas | Coordinator | `coordinator` |
| Arbiter | Architect | `architect` |
| Compass | Product Lead | `product_lead` |
| Aegis | Verifier | `verifier` |

Agent files use hyphens, such as `product-lead-reviewer.toml`; Codex agent IDs use underscores, such as `product_lead_reviewer`. Runtime tools accept known old aliases. The `aegis-verify` skill delegates to `verifier-verify`. Unknown custom-agent names remain unchanged.

Saved logs and evidence keep their original bytes. The v1 verdict fields `arbiter` and `compass` and lifecycle event types remain compatible; their visible labels use the new names. Install and repair remove only verified managed old files after replacements are ready, preserve changed files, and report any old files they keep. Restart the host after updating to load the new agent roster.

All role prompts and core workflows apply Orwell’s six writing rules: use plain, short, active prose; cut filler; keep accurate technical details and required output formats.
