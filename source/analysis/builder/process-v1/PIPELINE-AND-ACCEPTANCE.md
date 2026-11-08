# Reproducible candidate and acceptance workflow

Implemented 2026-11-08 on `wip/cc-builder-loop`. The family curve, skilled band and explicit minimum-2 fallback come from `LEVEL-DESIGN-FACTS.md` and `loop/policy.js`. No game or Firebase writes occur in this workflow.

## Candidate checks

`run_pipeline.js` now selects the named `e5-v1` experimental gate profile by default. `--gate-profile strict-v1` selects the original strict checks. `gate_profile.js` derives E5's report-only A5/A7 and trace threshold changes from `library/gates-calibrated.json`; primitive gate defaults stay unchanged. It preserves raw A5/A7 results, reasons and measurements, rather than making them pass with thresholds of 99.

Every new candidate and pipeline summary stores the complete profile plus its fingerprint. Trace thresholds are retained in library entries. Profile identity is part of reject/resume identity. Assignment's CLI filters out candidates with missing/different profiles or another family ruler. Use separate libraries for baseline, new construction, and fallback experiments to keep yield accounting comparable.

The skilled screen now rates each statically eligible clock setting before paying for its curve, rather than borrowing spare 2's score. Only spares in the explicit skilled band reach traces. C2/C3 are checked at each surviving setting. A candidate stores `S.bySpare`; assignment and library queries take S and its trust flag from that same spare. The top-level S is a compatibility summary of one setting, not a rating to copy to every setting. Old libraries can still be inspected, but should be requalified in a separate library under the new pipeline version before being counted as current supply.

Example from the checkout, for candidates produced by the current builder:

```powershell
node source/tools/builder/loop/heavy.js --label candidates -- node source/tools/builder/loop/run_pipeline.js --n 100 --start auto --lib source/build/batch250 --gate-profile e5-v1 --max-minutes 18
node source/tools/builder/loop/assign_levels.js --from 250 --to 259 --lib source/build/batch250 --gate-profile e5-v1 --allow-curve --out source/build/batch250-plan.json
```

The first assignment is explicitly provisional (`--allow-curve`). It retains holes when supply is inadequate. These commands do not imply the current builder has enough candidates; E6 found zero under its historical setup.

## Final acceptance

```powershell
node source/tools/builder/loop/heavy.js --label accept250 -- node source/tools/builder/loop/accept_levels.js --plan source/build/batch250-plan.json --lib source/build/batch250 --out source/build/batch250-acceptance.json --gate-profile e5-v1 --max-minutes 18
```

`accept_levels.js` checks a **fixed** puzzle/spare assignment. It does not select replacements or publish levels. Each assigned level must:

1. Match the frozen content hash, eligible spare, profile and pinned family/planner versions, and the approved target for its level.
2. Pass the selected static and trace gates at the actual chosen clock budget. Unknown required proofs stay unresolved. A5/A7 remain report-only under E5, and B7's maximum target is enforced.
3. Pass C1 and the skilled/face-up sanity check C2. Skilled difficulty is remeasured at the selected spare, not automatically at spare 2. The normal band is 2.5-6.
4. Pass the existing 160-to-320-campaign fresh ACCEPT rule within exactly one try of target.
5. Pass another independent 160-campaign check, within one try. Its four ACCEPT blocks are reserved separately after the sequential check's full reservation, so they cannot reuse measurement/selection seeds.
6. Pass the existing C4 special-kind checks on those same independent seeds: remove ice together, locks with their keys together, and the clock separately. Every expected special kind must have a valid proof of its effect. The existing C4 rule requires a difficulty drop of at least `max(1, 2*SEdiff)`; results include the full ablation evidence. This preserves the established C4 semantics rather than adding a new per-tile threshold.

Both the primary ACCEPT ratings and the independent ratings must satisfy every five-level window's fixed ±0.5 tolerance. A hole or an unresolved level makes its windows incomplete; it does not count as on target. Story spacing, spare-1 spacing and big-board slots are rechecked. A later batch must supply `plan.context` with the prior four accepted receipts (or fewer immediately after 250), including primary and independent D, S, key/spare/story and `status: accepted`. Boundary windows are checked too; missing evidence keeps the batch unready.

Acceptance output is an atomic checkpoint bound to the exact plan, selected library entries, code, pins, profile and skilled minimum. Re-run the same command to continue pending slots after a time limit. Completed, refused, unresolved and interrupted levels are not automatically retried with new seeds. An interrupted reservation remains consumed. A changed plan or policy requires a different output file and fresh seed reservations; a reworked candidate is a new experiment, not a quiet retry of the old one.

The output distinguishes per-level `accepted`, `refused`, `unresolved`, `interrupted`, and `hole` results from whole-batch `readyForReview`. It includes explicit fallback levels, primary/independent window results, CPU/wall accounting, and a `measured` map consumable by assignment's `--measured` option. Acceptance CPU excludes candidate-building costs. Never count an individually accepted row in a failing batch as a finished shipped level.

If normal supply is inadequate, Dennis permits an explicit minimum of 2: use `--skilled-floor 2` for the separately recorded candidate run, `--skilled-min 2` for assignment, and `--skilled-min 2` for acceptance with a distinct checkpoint. Each S below 2.5 is flagged. No skilled averaging or hidden screening margin is available.

Targets above 16 are marked `measurementLimit` before bot work. This is an unresolved measurement requirement, not a change or plateau in Dennis's rising curve.

## Validation and remaining limit

Tests cover profile evidence retention, strict/calibrated isolation, actual-spare checks, disjoint ACCEPT reservations, same-seed ablations, independent misses, five-level and boundary-window failures, missing proofs, explicit fallback, altered inputs and checkpoints without seed retries. A real one-candidate run (brief `iceLockClock-twins-32`, seed 7, index 258) passed calibrated static checks and was refused by the current [10,13] screen as too easy, using existing meter caches; it produced no library entry. Its local log is `source/build/profile-smoke-20261108/pipeline-runs.jsonl`.

The successful acceptance cases in the regression tests use injected ratings/proofs and are not real qualified puzzles. There is still no real accepted 250+ batch: puzzle supply is G5's construction task. No additional 500-build sweep was run.

The CLI chain was also exercised against that empty smoke-test library for 250-259: assignment retained all ten holes, acceptance retained six incomplete windows, exported no accepted measurements, and returned `readyForReview: false`. It did not turn missing supply into a completed batch.
