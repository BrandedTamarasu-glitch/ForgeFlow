---
name: forgeflow-capabilities
description: Select relevant ForgeFlow capabilities for a scoped task, including domain procedures, and report availability without executing them.
---

# Capability selection

Resolve `select-capabilities.js` from the checkout `scripts/forgeflow`, a host-supplied plugin root, or the installed ForgeFlow runtime for this host. Run `node <helper-dir>/select-capabilities.js --guide` and follow the shared selection procedure with phase **the actual task phase (usually implement or review)** and the current objective, criteria and affected scope. Reuse the same result across alias handoffs and pass it through existing context construction; do not reset reassessment limits. Missing runtime support is an explicit limitation, not a reason to invent selection results. Preserve current workflow read-only and isolation boundaries. Planned capabilities are not executable and selection grants no new authority.

This entry point exposes the same automatic step used inside ForgeFlow workflows. Users do not need to invoke it manually to enable money/calendar or CAD selection.
