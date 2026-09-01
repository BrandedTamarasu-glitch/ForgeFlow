---
name: forgeflow-review
description: Run Forgeflow review with evidence-first findings and validation follow-up.
---

# forgeflow-review

Use this skill when the host supports skill discovery but not Forgeflow slash-command browsing.

In Codex, execute this skill directly; do not invoke `/review`, which is a Codex built-in. In Claude Code, run `/review`. If slash commands are unavailable, follow the same objective manually and preserve current user instructions, local evidence, validation, security, accessibility, and repository boundaries.

Do not commit, push, install dependencies, edit host settings, call the network, or launch long-running services unless the user explicitly asks or the command workflow requires it.
