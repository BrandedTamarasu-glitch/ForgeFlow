---
name: forgeflow-plan
description: Build a phased implementation plan with validation and scope boundaries.
---

# forgeflow-plan

Use this skill when the host supports skill discovery but not Forgeflow slash-command browsing.

In Codex, execute this skill directly. In Claude Code, run `/plan`. If slash commands are unavailable, follow the same objective manually and preserve current user instructions, local evidence, validation, security, accessibility, and repository boundaries.

Do not commit, push, install dependencies, edit host settings, call the network, or launch long-running services unless the user explicitly asks or the command workflow requires it.

## Local-only workflow boundary

- Treat every `.forgeflow/` directory, its contents, and workflow agent identities as local working context only. Never stage, commit, push, attach, upload, or sync this state, including through memory-sync commands. Use Git's local `info/exclude` for generated state; never force-add it. Ignore rules do not protect already tracked files.
- Never include local artifact paths, agent names, persona names, role labels, agent verdict attribution, or workflow signatures in PR titles, bodies, comments, commit messages, release notes, or published artifacts. Describe the change and observed validation in ordinary engineering language. Keep detailed review attribution and evidence links in local reports.
- Never insert workflow agent identities or local evidence references into application source, comments, docstrings, tests, fixtures, identifiers, UI text, or shipped documentation. Use domain-based names and explain technical reasons without agent attribution.
- Before staging or publishing, inspect the actual staged diff, outgoing commits, and public text. A local-state file or workflow attribution leak blocks the action until corrected. Do not silently delete local evidence or rewrite existing history; report already tracked or committed state for cleanup.
- These rules govern project work produced with Forgeflow. Forgeflow's own maintained agent definitions, integration code, and documentation may name the agents and state paths needed to implement the tool; generated session state is always local. Ordinary domain terms that happen to match a role name are not workflow attribution.
- Local CLI labels, orchestration messages, and local report schemas may retain identities. This boundary takes precedence over instructions to copy local reports into public output or sync session memory.
