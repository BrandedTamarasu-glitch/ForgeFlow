# Review calibration

Status: evaluation cohort, version 1. Use for changes to review guidance or an explicit review-quality experiment. Ordinary application reviews do not need a calibration trial. Normal automatic execution awaits measured benefit.

## Freeze cases and scoring

Reuse the existing debate or skill evaluation flow. Define the required behavior, supported environment and severity rubric before collecting outputs. Include executable defects and clean counterexamples with comparable surface patterns. Derive severity from the demonstrated impact and stated scope, not the presence of words such as transaction or security. Freeze source, task inputs, procedure revision, separate answer key and scoring criteria by hash. Keep historical results tied to their original rubric.

Give reviewers only code, requirements, allowed environment assumptions and response instructions. Do not include expected counts, defect labels, answer explanations or key paths. The synthesis stage also remains blind. Only the post-review scoring step receives the key. Fresh independent trials must not inherit earlier outputs, peer conclusions or the key; debate rounds intentionally share earlier round outputs and are not independent samples. Never load the entire scored plan as a reviewer prompt.

For paired comparisons, use `task-evaluation.js` skill schedules with the same model/settings/budget and counterbalanced order. Record actual model identity and resource limits when available; unknown values stay unknown. Keep every scheduled attempt, including failed or missing ones. F2.3 owns the bounded recovery/review model pilot; deterministic checks alone do not establish reviewer performance.

## Adjudicate claims after review

Map each distinct final claim to a keyed defect only when its mechanism and impact agree with the code. A matching identifier or line number is insufficient. Record the observed finding, reproducible evidence and adjudication separately from reviewer output. Deduplicate repeated descriptions of the same concern before scoring, preserving their original occurrences for analysis.

- A matched defect counts once. Compare its reported severity to the frozen severity and record overstatement and understatement separately.
- A keyed defect with no supported match is missed, including a concern raised initially but incorrectly cleared during synthesis.
- A demonstrably unsupported final claim is a false finding. Clean cases require zero such findings, not merely clearance of a hand-picked list.
- Unexpected plausible claims and incomplete context require adjudication. Do not automatically call every unkeyed concern false or silently count it as correct. Keep the result unresolved until evidence supports a disposition. If a case/key is wrong, preserve the original result, version the correction and rerun comparisons; do not edit the key to favor observed outputs.

The installed `scripts/forgeflow/score-review-calibration.js` exports `scoreReview(input)` for post-review adjudicated records. Supply unique expected `{id, severity}` entries and unique findings with `{id, severity, disposition, evidence}`; `matched` findings also need `defect_id`. Dispositions are `matched`, `false` or `unresolved`. Severity is `low`, `medium`, `high` or `critical` under the case's frozen rubric. This helper counts adjudications; it cannot verify their truth. Keep the key and adjudicated records out of reviewer contexts.

## Report both kinds of error

Report expected defects, matched defects, missed defects, false findings, over/under-severity and unresolved findings together. Retain initial-versus-final changes in the existing debate report without treating intermediate disagreements as final false findings. Silence can pass a clean case but must fail a defective case. No overall pass is allowed with a missed defect, false finding or severity error; unresolved adjudication yields no verdict. Failed/unobserved runs have null metrics and must remain in the scheduled denominator.

Tag records as `fixture`, `actual` or `unobserved`, with `run_status` of `completed`, `failed` or `unobserved`. `actual` requires genuine model output; a synthetic record testing that parser branch is still a test, not evidence of performance. Existing skill evaluation fields accept completion, missed defects and false findings; retain severity details in the accompanying scoring report, without changing legacy workflow arms or schemas.

Stop at the frozen case/repetition budget. Missing model access leaves an unobserved schedule; missing adjudication leaves unresolved findings. Preserve reports locally in existing evidence storage, remove only owned disposable artifacts, and report activation limits. Do not launch another workflow, expand live access or publish trial transcripts merely to obtain a score.
