# CAD/fabrication acceptance fixtures

Run `node scripts/forgeflow/test-cad-fabrication-acceptance.js`. The parameters, mesh generator and checks are newly authored synthetic examples under the repository MIT license. No project geometry, external model or physical measurements are copied. The fixture stays in the checkout; managed hosts receive the canonical procedure, not a CAD kernel.

## Declared geometry and assumptions

An open rectangular frame has an 80 × 60 mm exterior, 62 × 42 mm opening and 8 mm height. A rectangular 60 × 40 mm object is an assumed mating envelope. Coordinates start at the lower exterior corner, Z points upward and the opening passes through the entire height. All dimensions are assumptions. This is a fit-gauge example with no base or retention feature, not a controller stand or finished product.

Opening and object tolerances are each bilateral ±0.3 mm on total width/depth. Worst-case centered per-side clearance is `(opening - openingTolerance - object - objectTolerance) / 2`, giving **0.7 mm** on each axis against an example minimum of 0.5 mm. The exterior is exact in this synthetic model; the minimum-wall calculation subtracts the opening's positive tolerance. Nominal walls are 9 mm and the example minimum is 2 mm. These values are not manufacturing recommendations or printer calibration. No material, shrinkage, force, friction, load, deformation or real object shape is established.

The unrotated frame is translated to [10, 10, 0] on a synthetic 220 × 220 × 250 mm usable box, with no keep-outs, supports or brim. Plate bounds and bottom contact are tested. Arbitrary rotation, multiple instances, support footprints and actual printer profiles require project-specific checks.

## Reproducible acceptance

The generator triangulates the top, bottom, inner and outer walls into **32 triangles**. The test writes an ASCII STL, three-view SVG wireframe and manifest to an owned disposable directory, reads the actual disk bytes, and checks them against pinned parameter and generator SHA-256 identities. Preview polygons are derived from the exported STL and include its hash. Deterministic regeneration, changed parameters, stale previews and export/source mismatch are checked. Source identity is the containing Git revision plus any uncommitted diff; the manifest hashes the generator bytes and serialized parameters, not a claim of an immutable release.

Independent literal expectations are bounds [0, 0, 0] to [80, 60, 8], volume **17,568 mm³**, and cross-section loop areas **2,604 and 4,800 mm²** at Z = 1, 4 and 7 mm. The section routine intersects actual exported triangles and joins segments into closed contours. These are analytic mesh sections, not slicer output, extrusion paths or layer qualification.

Three clean parameter configurations pass, including changed geometry and exact clearance/plate boundaries. **24 seeded failures** are rejected: wrong unit declaration, worst-case clearance loss despite nominal clearance, thin walls, plate overflow, floating placement, invalid height, missing tolerance, missing face, local reversed winding, inverted solid, duplicate face, degenerate triangle, nonfinite coordinate, unexpected separate shell, empty STL, parsed nonfinite vertex, trailing STL corruption, stale parameters, stale generator, stale preview, 25.4× export scaling, broken exported geometry, open section and empty section.

Mesh checks cover finite coordinates, nondegenerate and unique faces, two opposite edge uses, connectedness and positive signed volume. They use exact coordinate keys for this deliberately simple geometry. The parser accepts only the emitted ASCII subset; it is not a general STL importer. The checker does not establish vertex-manifoldness, detect arbitrary self-intersections, validate stored normals, account for numerical welding, or qualify general CAD booleans. Section planes through vertices are explicitly unsupported. Export equality and independent literal geometry checks constrain this fixture; they are not substitutes for broader mesh tooling in real projects. The SVG is a reproducible wireframe, not a human visual inspection or accessibility qualification.

## Separate evidence states

| Evidence | Result |
|---|---|
| Synthetic digital mesh, clearance, plate and artifact checks | Pass |
| Actual slicer, printer/material profile, toolpaths and layer inspection | Pending; not run |
| Printed part, insertion, pickup, controls, retention and stability | Pending; not performed |
| Overall physical acceptance | Pending |

The result keeps slicer, physical and overall acceptance pending even when digital checks pass. The [canonical procedure](../../forgeflow-patterns/capability-cad-fabrication-acceptance.md) contains the written fit-test checklist and instructions for project-specific thresholds, observations and measurement uncertainty. No print jobs or hardware operations run. Temporary exports are removed after assertions; failures report the violated boundary and can be reproduced by rerunning the test.

Fixture success establishes implementation acceptance only. Real-project correctness and added model capability remain unverified. F5.3 should use pinned actual domain changes with independently verified findings and equal comparison access, preserving negative results. Physical observations must never be inferred from model reviews or digital success.
