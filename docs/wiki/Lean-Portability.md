# Lean Portability

Forgeflow lean guidance is generated from canonical rule text and checked across committed host surfaces.

Useful checks:

1. `/forgeflow-lean-adapter-drift` checks committed Cursor, Windsurf, Cline, Copilot, Kiro, and OpenClaw rule copies.
2. `/forgeflow-lean-host-adapters` checks plugin, extension, instruction, and skill-tier adapter files.
3. `/forgeflow-lean-host-command-parity` checks Pi, Forgeflow command wrappers, and OpenCode command files for command-capable lean surfaces.
4. `/forgeflow-lean-skills` checks generated lean skill packages.
5. `/forgeflow-skills` checks generated core Forgeflow skill packages.
6. `/forgeflow-lean-windows-smoke` checks Windows-style hook/statusline compatibility.

These checks do not install adapters, edit host settings, commit, push, call model APIs, or call the network.
