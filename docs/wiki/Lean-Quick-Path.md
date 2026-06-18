# Lean Quick Path

Use this when you want lean guidance active without reading the full command catalog.

1. Run `/forgeflow-lean-prime --prime-task "<work item>" --write-report`.
2. If it asks for mode setup, run `/forgeflow-lean-mode --profile balanced --write`.
3. Before the work item, run `/forgeflow-lean-decision --task "<work item>"` if step 1 did not already create decision evidence.
4. After implementation evidence exists, rerun `/forgeflow-lean-report --write` when you need a fresh aggregate report.
5. Check `/forgeflow-lean-status` before agent-heavy review or shipping.
6. Use `/forgeflow-lean-review` as the over-engineering-only review lane.

The lean path is advisory. It does not remove explicit requirements, shrink security, skip accessibility, bypass trust-boundary validation, weaken data-loss protection, commit, push, install hooks, or call the network.
