# Money/calendar fixtures

Run `node scripts/forgeflow/test-money-calendar-correctness.js`. `cases.json`, `model.js` and the test are newly authored synthetic examples under the repository MIT license, with no personal ledger data or external financial dataset. Source identity is the containing Git revision and any uncommitted diff. This is a checkout-only fixture; managed hosts receive the procedure, not a replacement financial runtime.

## Explicit example policies

| Boundary | Fixture contract |
|---|---|
| Amount representation | Integer minor units, signed refunds allowed, magnitude at most 1,000,000,000 after quantization; intermediate arithmetic uses BigInt |
| Decimal input | Canonical dot-decimal strings of at most 64 characters; optional minus; no exponents, grouping, whitespace or implicit localized parsing |
| Scales | Explicit exponents 0 through 3, no assumption about any named real currency |
| Rounding | Explicit half-even or half-away from zero, applied once when parsing into minor units; positive and negative ties covered |
| Missing amount | Null means unentered, zero means entered zero; undefined/malformed values are errors. Totals expose known subtotal and missing count; complete total stays null while any amount is missing |
| Allocation/transfer | Divide into 1–100 integer shares, distribute signed remainder to earliest shares; preserve totals. Transfers require matching nonempty unit identifiers and scales; bounds apply to each resulting balance |
| Calendar | Gregorian civil-date strings, January 1900 through December 2100 inclusive. No timestamps, timezone conversion, time-of-day or holiday/business-day rules |
| Recurrence | Forward integer month offsets within the supported range, always from original anchor. Clamp to month end, skip missing days, or explicitly choose end-of-month. End-of-month schedules use each target month's last day, including offset zero |
| Preview | 1–24 periods with a 1–12 month interval; skip policy retains a row with null date rather than hiding the skipped period. Out-of-range dates reject; no preview writes |
| Store | Synthetic JSON bytes, schema 1 only. Invalid previews/saves preserve bytes and emit no writes; accepted amount save writes once. This does not simulate persistence concurrency or crash durability |
| Presentation | Decimal display tested in en-US, de-DE and ja-JP; null has the explicit English example label `Not entered`. These are not currency-symbol, translation, localized-input or browser-accessibility checks |

Fixed expectations are separate from the implementation in `cases.json`: 17 amount examples and 15 recurrence examples. The test adds edge/boundary checks, 256 deterministic generated round-trip/conservation cases using seed **1297043013** and an LCG with multiplier 1664525, increment 1013904223 and modulus 2^32. Samples use `floor(next / 2^32 * bound)` to avoid relying on cycling low bits; all four scales are explicitly checked for coverage. Generated amounts range from -1,000,000 to 1,000,000, allocation counts from 1 to 100, transfer amounts from 0 to 100,000, and scales from 0 to 3.

An independent UTC Date oracle checks all **2,412 target months** against an original January-31 anchor over the declared year range. Literal century cases check 1900, 2000 and 2100 separately. Civil-date results are compared in fresh processes under UTC, America/Los_Angeles and Pacific/Kiritimati. The model performs no timezone conversion, so these checks detect accidental dependence on process timezone; they do not qualify timestamp-based DST gap/fold behavior.

Nine deliberately incorrect alternatives exercise the acceptance assertions: storing major units as minor units, binary rounding at 1.005, wrong negative tie handling, discarded allocation remainder, recurrence drift from a clamped prior date, a year-divisible-by-four-only leap rule, automatic month rollover, null coerced to zero, and preview-time persistence. Clean half-even/half-away, clamp/skip/end-of-month policies all pass under their own declared contracts. Stored bytes and write events are checked, including unsupported schema/date/amount rejection, detached preview results and valid zero saves.

The test initially exposed an offset bound that omitted the last eleven months of 2100; the final bound covers the full declared range. Timezone subprocess checks require permission to launch Node child processes in restricted environments; do not skip those checks and call the suite complete.

These results establish fixture behavior and procedure packaging, not correctness of any real budgeting application or an improvement in agent capability. Fees, exchange conversion, tax/legal policies, non-Gregorian calendars, locale input, timestamp/DST rules, actual storage engines and UI accessibility require project-specific evidence. Future F5.3 model-benefit work should use pinned real changes and independent verification, preserving negative results.
