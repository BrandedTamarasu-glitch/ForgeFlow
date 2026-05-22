# Adoption Pack

Use `/forgeflow-adoption` when a net-new user or team lead needs a concise decision aid before running or expanding Forgeflow.

The pack combines:

- fit and not-fit-yet criteria
- first-trial steps from the selected pilot path
- existing local pilot-evidence rollup counts
- a recommended next action with owner, blocker, and command
- a public-safe summary with aggregate counts, decision state, owner lane, and fixed blocker category only
- a small-team handoff checklist for the next maintainer trial
- proof-boundary reminders

## Run It

Claude Code:

```bash
/forgeflow-adoption --runtime claude-code --path new-user
```

Codex or shell:

```bash
scripts/forgeflow/render-adoption-pack.js --runtime codex --path new-user
```

Use `--path maintainer` when the first user already owns Forgeflow locally and is deciding whether to expand to another maintainer.

## Public-Safe Summary

The public-safe summary is designed for sharing outside the raw project context. It includes aggregate counts, the current adoption decision, recommended action, owner lane, review minutes, and a fixed blocker category when one is available. It does not include raw `.forgeflow/` records, source snippets, private project paths, free-form support categories, project names, or free-form notes from pilot evidence.

Keep raw evidence local unless the project explicitly approves a wider sharing level.

## Small-Team Handoff

Use the handoff section only after the pack recommends `expand-small-team`, or as a checklist for what still needs to be true before expansion.

The default expansion path is:

1. Keep the same privacy boundary and sharing level from the first trial.
2. Pick one bounded branch for one added maintainer.
3. Run the maintainer pilot path.
4. Record pilot evidence immediately after the trial.
5. Rerender the adoption pack before adding more maintainers.

If install, privacy, routing, evidence quality, or review usefulness blocks the first review, stop and fix before expanding.
