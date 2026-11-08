# G5 integration, 2026-11-09

Gemini's construction commit `9c2247f2` is integrated into `wip/cc-builder-loop`, together with the lead's clock-specific qualification and final-proof fixes. The default builder remains the existing path; the new constructor is explicitly selected with `--mode visibleChoice`. No main, game level, production asset or Firebase change is included.

The code review found and repaired three misleading construction claims before integration:

- A zero-cost or unrelated tempting move no longer proves an authored consequential choice. The matched authored pair needs a proved winning alternative and a positive cost of 1-2 clock moves, or an explicitly fair proved losing branch.
- A calm tail is no longer hardcoded as proven. The card measures the stored witness's tray occupancy, explicitly scoped to that witness; actual trace checks judge pacing.
- Aggregate node work is no longer reported as the invented constant 1000. It is unmeasured for this mode; individual searches have node bounds. Unsupported keep/hardWork/softWork options fail explicitly, and a deadline fails the build rather than selecting an alternate board.

The constructor now applies the shared experimental E5 profile instead of substituting thresholds of 99 or bypassing failed required static gates. Both keys must be shown at the start in key stories. An ineffective shuffle call was corrected. These corrections change the opt-in constructor's output, so the old 500-attempt ledgers remain historical v3 measurements, not a qualification of the corrected code. Construction source hashes are part of mode-specific pipeline identity, and the mode is recorded in run options.

The G5 report was regenerated from the stored summaries: baseline built 455, static passed 168, and screen passed 19; the original draft had inconsistent totals. The report now correctly distinguishes CURVE seeds 4711/18427 from fresh ACCEPT block seeds. Report-only A5/A7/B7/C3 are not described as strict gate passes. Raw ledgers and frozen receipts were not rewritten.

The ACCEPT ledger merge preserved all reservation ids and intervals and the lead's import provenance. The verified fallback board's [0,8) and [8,12) reservations remain consumed. There was no retry of the refused frozen candidates on alternate seeds.

Validation: the integrated builder/gate/knob/loop suites passed 167 tests. A real CLI pilot on the corrected mode completed the frozen first ten indices: nine builds, all nine passing static checks, one passing the family screen, and none passing the skilled band at any eligible spare. One build returned no proved visible choice. CPU was 14.078 seconds; wall was 10.906 seconds, including cache reuse. The pilot verifies the integrated execution path; ten ordered briefs do not establish a general yield estimate. The run summary is copied to `corrected-pilot.json`.

Current useful evidence remains one experimentally accepted fallback board at level 250 (S=2.33, primary D=10.105, independent D=9.485), retaining its A6 luck warning. The normal-band candidate failed the larger trace check. A complete 250-259 batch is still not available. Next work is to improve normal-band supply and the recorded luck mechanism using the corrected constructor and separate output ledgers, not to reinterpret the old candidates as a finished batch.
