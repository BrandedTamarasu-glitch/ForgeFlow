# CAD and fabrication acceptance

Status: evaluation cohort, version 1. Select for physical geometry, fit, clearance, retention or fabrication changes. Logo artwork and unrelated CAD documentation do not qualify. Normal automatic execution awaits benefit qualification. Work within the project's existing CAD/export pipeline; selection does not authorize print jobs, hardware operation or spending.

## Establish dimensions and acceptance

Pin source revision and uncommitted changes, parameter files, generator/tool versions and export commands. Record units at each boundary, coordinate axes, origin, assembly transforms and intended print orientation. STL coordinates do not declare units: record the unit interpretation at export and import and compare a known dimension after import. Do not silently scale a model to fit the plate.

For each fit-critical dimension, distinguish measured, manufacturer-specified, inferred and assumed values. Record measurement method, instrument resolution, uncertainty, object variant and sample count where observed. Keep measured uncertainty separate from intended clearance and manufacturing allowance. State material, process, shrinkage assumptions, wall/feature limits and any anisotropy or loading expectations; missing calibration is unknown, not zero. Define each tolerance as total, bilateral or per-side. Propagate worst-case limits through mating features and the full insertion/removal path, including interference, cable bends, moving controls and fingers. An assumed object bounding box cannot certify an irregular real object.

Freeze expected dimensions and explicit acceptance thresholds before checking exports. Define whether retention is friction, latch, support or deliberate free clearance; a gap that permits insertion does not demonstrate retention. Avoid imposing universal printer tolerances or material strength claims. Resolve substantive missing fit policy before declaring a defect; a digital-only result may proceed with named assumptions.

## Generate and inspect current artifacts

1. Regenerate in an owned output directory from pinned inputs. Hash source, parameters and actual output bytes. Export through the real project command, retain warnings/errors and compare critical bounds, features, units and expected component count against independent measurements or analytic expectations. A successful process exit alone is insufficient.
2. Inspect the exported mesh for finite coordinates, degenerate/duplicate faces, open/nonmanifold edges, winding, connected components, self-intersections and unintended internal shells using available tools. Document each tool's coverage: watertight edge incidence and positive volume alone cannot establish absence of self-intersections or printability. Treat intentional separate parts as declared components, not automatically as errors.
3. Generate previews from that exact exported mesh, including views that reveal contacts, underside, holes and clearances. Bind the preview and any loaded-object overlay to mesh/source hashes and transforms. Compare meaningful geometry, not just filenames or a stale screenshot. Image evidence cannot prove topology or dimensions; an idealized object overlay cannot establish real fit. Reuse change propagation when source changes invalidate exports, previews, slicer projects or archives.
4. Check the placed and rotated model against printable X/Y/Z limits, keep-outs, brim/support footprint and all instances on the plate. Slice the same mesh with a named tool/version and saved printer/material/nozzle/layer/support profile. Verify imported units, nonempty layers, expected parts, first-layer contact, thin/disappearing features, bridges/overhangs, supports and removal access. Inspect representative and critical layer previews. Record slicer warnings and any repair or rescaling; recheck repaired geometry. Analytic cross-sections are not slicer toolpaths. If the slicer/profile is unavailable, leave slicing unverified.
5. Compare archive/print-package contents with validated exports. Any mesh, scale, orientation or material/profile change invalidates affected downstream evidence. Preserve reproducible commands and sanitized reports, then clean only owned temporary files.

## Written physical fit test

Before printing, write a project-specific checklist with object/part revisions, material/process settings, intended load/orientation, repetitions and pass/fail thresholds. If safe thresholds or use conditions are unknown, record them as unresolved; do not invent measured forces or certify a load rating. Inspect the actual printed part before using the intended object. Record actual observations separately from predictions:

| Check | Procedure and evidence to specify |
|---|---|
| Insertion | Approach through the intended path with the actual object; check interference, required force, seating depth, surface contact and damage. Stop if excessive force or damage occurs. |
| Pickup/removal | Use the intended grip and release motion; check finger clearance, snagging, one/two-handed operation and whether the base lifts unexpectedly. |
| Controls and cables | Exercise required controls through their travel; insert/remove connectors and check cable routing with the object seated and during pickup. |
| Retention | Test the specified orientations and bounded disturbances with suitable protection; record unintended release, slip and engagement. Do not equate insertion success or static clearance with retention. |
| Stability | Place on the intended surface with the intended load; check rocking, tipping and sliding during insertion, use and removal. Record feet/contact, center-of-mass assumptions and observed behavior. |

Record instrument/method, sample count, repeatability and uncertainty for dimensional or force measurements. Unperformed tests remain **pending**, failed tests remain failed, and unavailable equipment remains an explicit limitation. Do not turn a person’s unstructured “looks good” into measurements. Digital, slicer and physical status must remain separate; aggregate acceptance cannot pass when a required category is pending. A digital package can be complete while physical acceptance is pending.

## Evidence and qualification

Return the dimension/assumption table, input/output identities, command/tool/profile details, actual mesh checks and their coverage, current previews, plate/clearance results, slicer observations, written physical checklist and outstanding tests. Distinguish a seeded fixture defect, a verified real-project defect and an unverified concern. The checkout's `node scripts/forgeflow/test-cad-fabrication-acceptance.js` uses a synthetic rectangular frame with bounded analytic oracles; it does not qualify a slicer, printed object or model benefit. Future F5.3 benefit comparisons should review pinned real project changes with equal baseline/enhanced access and independent verification, preserving ties and regressions.
