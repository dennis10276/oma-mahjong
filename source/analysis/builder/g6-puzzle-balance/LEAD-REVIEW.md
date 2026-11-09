# G6 lead review and G7 starting point

Reviewed by Codex, 2026-11-09. Incoming commit `e1a622ff` on
`wip/gemini-puzzle-balance`; base `25280329`. The original report, raw JSON and
source blobs are preserved here. Use this review and `lead-audit/` when they
conflict with the original report. The original source is archived as `.js.txt`
and is not installed in the builder API.

## What is verified

The lead rebuilt all 40 declared discovery trials with the archived constructor,
replayed every strict witness, re-proved matching strict/game clock minima,
checked picture counts and calibrated static gates, and measured both pinned
ratings at the stored clock setting. All 40 recorded D/S ratings reproduce:
family **1.10–1.215**, skilled **1.00–1.02**, zero normal-band candidates. This
is a useful negative baseline, not balanced puzzle construction.

Those 40 trials comprise **20 distinct picture-labelled boards and 10 distinct
matching structures**. Changing seeds only renames pictures. Across both layouts
and both seeds, all four `chokeDelay` values produce exactly the same physical
board. Other family recipes also share structures. These are not 40 independent
construction tests or three independently implemented mechanisms.

Twenty layout-45 rows have **two** A6 tempting lose-forks each; the other twenty
have zero. Thus the original report's universal zero-fork claim contradicts its
own JSON. Moreover, A6 scans specified tempting choices before the clock; zero
in that scan never establishes that no losing choice exists on the whole board.

The prototype's `chokeDelay` is used only for card metadata. It neither changes
pictures/geometry nor enforces a loss distance. Its intent `prompt consequence
choke: proven:true` has no corresponding proof. Unsupported target keys and a
zero wall budget are also silently accepted. The seven original tests check
build/replay/static behavior, not a causal delay effect. Passing them is not
grounds to expose these controls as real builder capabilities.

## Corrected historical comparisons

The original `diagnostics.json` is more accurate than the narrative table for
the note relief cases. The lead reproduced the raw values at spare 2:

| Control | Family D | Skilled S | Required A6 |
| --- | ---: | ---: | --- |
| One passage, no relief | 19.560 | 1.30 | Fail |
| Two passages, no relief | 19.155 | 16.50 | Fail |
| Two passages, open relief | 15.050 | 1.13 | Fail |
| Two passages, one-pair cover | 14.615 | 1.13 | Fail |
| Two passages, two-pair cover | 13.735 | 1.05 | Fail |

The report's relief D=1.45–1.65 and A6-pass claims are unsupported and contradict
the raw JSON. All five note variants have minimum **9**, clock **11** at spare
2; the report's k=7/spare=2 description is wrong. Relief lowers skilled difficulty
without solving family difficulty or the early A6 failure.

The U prelude comparisons mixed clock settings: family D=16.65 was measured at
stored clock 14 (minimum 13, spare 1); skilled S=3.48 was measured after changing
to clock 15 (spare 2). Matched results are **D16.65/S3.52 at spare 1**, and
**D13.69/S3.48 at spare 2**. `u-repair-0` loads the zero-swap baseline, identical
to `u-k5-9-lock42`; it is not an independently repaired design. The U body alone
was stored at spare 1 too: D3.125 there, D3.175 at spare 2, S2.98 at either.

G6 does not preserve full action traces or a B7 trace ledger establishing its
specific repeated-error counts. Historical B7 findings remain available in the
earlier dependency experiment; do not attribute a new B7 check to G6. The
diagnostic `longest(...,10)` result is a capped survival-depth observation,
not proof that the true maximum survival is exactly ten. A6's failure beyond
six is valid; the narrative's exact error-at-step and 36-move causal accounts
are not established by the retained attempt summaries.

## Integration and next work

Retained the incoming work as reproducible research, with a source-blob manifest
and independent rebuilt designs, raw ratings, static checks and corrected
same-clock controls in `lead-audit/`. The original JSON lacks exact designs,
source/pin/profile identities and CPU accounting; the audit adds new evidence
rather than inventing those historical receipts. Timings include cache hits.
There are zero new qualified/accepted levels and no new ACCEPT reservations.

The prototype is **not integrated as a builder mode**. Its source and original
tests can be reproduced through `load_original.js` and
`verify_original_tests.js`, without installing the misleading proof/control API.
All **257** checks pass: the 250 existing builder/loop/research tests plus G6's
seven archived checks. This does not validate the inert control. The full log is
`lead-audit/tests.txt`; the original report's 262-test total is not used as a receipt.

G7 is `../gemini-tasks/TASK-G7-builder-completion.md`. It asks Gemini to find,
fix and verify successive bottlenecks in the actual builder, with explicit
causal controls and independent plan/geometry validation. Its first priorities
come from these corrected findings, not from an assumed successful delay dial.
Short feedback, useful skilled choices and gradual family response all remain
open. No statement that a relief depth or new decoy motif will solve them is
supported yet.

Reproduce from the repository root, using new output identities when rerunning
(the audit refuses to overwrite its frozen output):

```powershell
node source/tools/builder/loop/heavy.js --label g6-audit -- node source/analysis/builder/g6-puzzle-balance/audit.js --out source/build/g6-audit-repro
```

No game, bots, thresholds, curve, main or Firebase changes are included.
