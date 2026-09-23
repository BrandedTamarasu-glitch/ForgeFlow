# Visual acceptance

Status: evaluation cohort, version 1. Use for layout, component, typography, theme or interaction changes. Normal automatic execution awaits the controlled pilot. Reuse the current UI iteration/browser session and its evidence rather than starting another scoring workflow.

## Define the intended relationship

Read the brief and inspect the surrounding page before selecting a crop. Record which elements should align, share dimensions or retain hierarchy at each relevant breakpoint. Equal cards in a comparison row may be required; a featured card can intentionally differ. Do not turn a previous accidental mismatch into a universal equal-height rule. Do not treat the current screenshot as an approved design merely because it is the baseline.

Choose a bounded matrix from the affected behavior: a wide layout, the actual wrapping breakpoint and a narrow layout; supported themes; short and longest realistic content; loading/empty/error states when changed. Start with those relevant combinations, expand for observed failures, and list untested combinations. Do not generate every possible state or ask users to select a skill. Reuse installed browser/accessibility tools; missing tools leave explicit gaps and do not authorize dependency installation or service startup.

## Capture and inspect

Wait for the intended UI state, images and `document.fonts.ready`; verify the requested font actually loaded rather than silently accepting fallback. Observe that the changed style reached the browser; a fixed delay or successful HTTP response does not prove HMR freshness. Record source identity, served/captured identity where known, URL, browser, viewport, theme, content state and font outcome.

Capture both the component and its surrounding section or full page. Inspect both images. Check neighboring edges and spacing, text wrapping, clipped labels, overlapping content, horizontal overflow and sticky/fixed elements. Use bounding boxes and computed styles to substantiate a relationship, with a documented tolerance for rounding. Compare heights only where the intended row/layout requires it; stacking at a narrow width can change the relationship. An expected visual change is not a regression solely because pixels differ from the old screenshot.

For each relevant state, check keyboard order, visible focus, accessible names/roles, activation and understandable feedback. Inspect text/background and control contrast in each theme, reduced-motion behavior, 200% text enlargement and narrow reflow corresponding to a 400% zoom scenario where applicable. A reduced viewport is a reflow probe, not proof of actual browser zoom; label it accurately. Run the available automated accessibility scanner and retain its results, but do not equate zero automated findings with complete accessibility. Missing scanner, screen-reader or human observations remain unverified.

## Accept or iterate

Record each requirement as passed, failed or unverified with its observation and screenshot. Keep failed accessibility, overflow and required-layout checks out of cosmetic ranking: a higher palette score cannot compensate for a required failure. Intentional asymmetry passes when it matches the brief and preserves the other constraints. Fix one evidenced issue, recapture affected states and their neighbors, and stop when the scoped requirements pass or an explicit environmental gap prevents verification. Respect the existing UI iteration round/variant bounds.

Attach the matrix, measurements, screenshots, accessibility results and limitations to existing task evidence or the UI iteration report. Separate source inspection, local browser observations, served/public checks and model-benefit measurements. Do not manufacture screenshots or infer a visual pass from DOM measurements alone. Preserve captures; stop only owned browser/server sessions and restore only owned temporary variants without overwriting concurrent edits.

The repository's `npm run test:visual-capabilities` exercises synthetic paired cards in a local Chromium browser with no server. It verifies seeded failures and clean/intentional cases; it does not establish that a model independently notices those failures. The fixture README documents the exact coverage and omissions.
