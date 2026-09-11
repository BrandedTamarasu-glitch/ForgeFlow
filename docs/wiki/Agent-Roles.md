# Agent Roles

Forgeflow uses focused agents rather than one all-purpose assistant.

| Agent | Focus | Primary Modes |
|---|---|---|
| Builder | backend craft, data, quality | consult, implement, audit, review |
| Guardian | security, systems, reuse | consult, implement, audit, review |
| Designer | UX, accessibility, connectivity | consult, implement, review |
| Coordinator | coordination, memory, project continuity | early phases, consult, implement, review, developer presentation |
| Architect | architecture synthesis and verdict integrity | consult, implement oversight, review synthesis, debate judging |
| Product Lead | product validation, requirements, UX intent | discuss, research, plan, implement validation, final review, stakeholder presentation, debate validation |
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

### Capabilities by phase

| Phase | Responsibilities and output |
|---|---|
| Discuss, research, plan | Product Lead frames requirements, evaluates options, and writes a phased plan. Coordinator preserves decisions, constraints, and project context. Divergent research adds independent candidate approaches and a Product Lead critic. |
| Consult | Selected Builder, Guardian, Designer, and Coordinator specialists contribute within their domains. Architect resolves tradeoffs and produces the implementation brief. |
| Implement | Domain implementers execute the brief. Coordinator consolidates implementation notes; Product Lead checks acceptance criteria and runs targeted validation; Architect checks integration against the brief. |
| Review | Routing selects the specialist reviewers. Architect synthesizes their evidence into a technical verdict; Product Lead confirms or challenges it against requirements and validation when the route calls for these checks. |
| Audit | Builder examines schemas, queries, dependencies, duplication, and dead code. Guardian examines auth, validation, secrets, and system boundaries. Architect prioritizes the findings. Claude's workflow uses Coordinator to persist audit evidence; Codex makes persistence optional. |
| Ship | Coordinator prepares developer-facing presentation data and session learnings. Product Lead prepares stakeholder-facing capabilities, before/after behavior, impact, and accessibility notes. The shipping workflow assembles these into the handoff. |
| Debate | Builder, Guardian, Designer, and Coordinator test findings through openings, rebuttals, and falsifiable claims. Architect judges the debate; Product Lead compares the final result with the withheld answer key. |
| Verify a finding | Verifier returns `CONFIRMED`, `REJECTED`, or `BLOCKED` from supplied evidence. Missing evidence produces `BLOCKED`; confidence alone cannot confirm a finding. |

See [Workflow Commands](Workflow-Commands.md) for host commands and [Review Routing](Review-Routing.md) for review modes. Detailed role guidance: [Builder](../builder.md), [Guardian](../guardian.md), [Designer](../designer.md), [Coordinator](../coordinator.md), [Architect](../architect.md), [Product Lead](../product-lead.md), and the [Verifier definition](../../agents/verifier.md).

### Role selection and host configuration

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

Claude phase files use suffixes such as `builder-review`, `product-lead-implement`, and `coordinator-present`. Their Codex counterparts are `builder_reviewer`, `product_lead_validator`, and `coordinator_presenter`. Codex also has dedicated `architect_debate_judge` and `product_lead_debate_validator` roles. Check the [Claude Builder review definition](../../agents/builder-review.md) and [Codex configuration](../../.codex/config.toml) for exact identifiers; role names do not imply that every mode exists for every agent.

For the first upgrade from legacy names, follow the [source-checkout migration procedure](../role-migration-upgrade.md). Start with the new source installer so edited legacy agents can be preserved.

Saved logs and evidence keep their original bytes. The v1 verdict fields `arbiter` and `compass` and lifecycle event types remain compatible; their visible labels use the new names. Install and repair remove only verified managed old files after replacements are ready, preserve changed files, and report any old files they keep. Restart the host after updating to load the new agent roster.

All role prompts and core workflows apply Orwell’s six writing rules: use plain, short, active prose; cut filler; keep accurate technical details and required output formats.
