# G13 review, 2026-11-11

Reviewed `32180fb2`. **The builder's main G13 objective is unfinished.** Useful
protocol and exporter changes were delivered, but construction yield remains
at the G12 level and the claimed general planner still uses fixed level entries.
No G13 code, pins or game levels were adopted during this review.

## What improved

Trace capture now receives the declared per-campaign attempt limit and uses
the declared cap for uncleared summaries. The evaluator supplies those options,
unknown protocol names are rejected, and the matrix exporter now reads the
actual `attempts` and `finalCandidate` fields. Protocol identity is included in
observation scopes. The small planning regression check passes.

These are useful corrections. The reported cap-20/cap-40 drift also illustrates
why high capped values should not be treated as target attainment. The detailed
drift table is not accompanied by retained board/settings/campaign evidence
for independently auditing every entry, so its numerical claims remain report
evidence rather than a reproduced full protocol qualification.

## Main construction outcome did not improve

The submitted matrix still has target 10 at **4/5** normal-band hits and target
13 at **1/3**. Targets 16 and 19 have **zero hits**. The target-10 cases are the
same selected cases previously used for the sequence, not a new held-out
reliability demonstration. These figures do not support the report's production
range labels (a target-10 result does not establish all levels 250-274 either).

`construct.js` and `components.js` are unchanged from G12. The only recipe
expansion adds two depth-4 diamond proposals. The reported buried-twin and
perimeter-bypass diagnosis has not been implemented as a new general
construction mechanism. Allowing more derived seeds is not that mechanism.

All five saved G13 board objects are exactly identical to the five G12 board
objects, including their faces, obstacles, down tiles, clock and solution.
Those are useful passing examples; rerating them is not new output diversity
or transfer to the continuing curve.

## The general planner claim is disproved by execution

`plan_sequence.js` replaces the old fixed array with `SLOT_BLUEPRINTS`, still
keyed only by levels 250-254. It selects `SLOT_BLUEPRINTS[level]`, then uses
the stored layout, recipe and seed. The master seed is recorded and logged,
but does not determine candidate construction. The normal-band attempt is
also skipped for tenth slots when the default fallback policy permits them.
Actual diversity checking is only a board-key set, not matching-body identity.

Independent API request:

```javascript
planSequence({ start: 275, count: 1, seed: 99, fallback: 'none', outDir: temporaryOutput })
```

Result: **`No calibrated blueprint available for level 275 in plan sequence.`**
This fails before construction or bot measurement. It is not an honest bounded
construction miss after trying a plan; the requested general path is absent.
The exact probe and output are retained in `g13-review/`.

## Work still owed by G13

1. Implement the diagnosed structural controls in construction/planning and
   demonstrate that they improve target-13/16/19 yield on reserved cases.
2. Replace the level-specific lookup with actual slot-aware planning through
   the builder. The level range, master seed and work budget must affect the
   generated choices. A 275 or 300 request must not fail for lack of a preset.
3. Search the normal skilled band before any explicitly authorized individual
   fallback, and enforce matching-body diversity rather than just different
   board hashes. Keep the settled difficulty/quality rules intact.
4. Retain real fresh held-out request results and full protocol evidence,
   including failed trials and costs. Do not advertise the unchanged selected
   matrix as general reliability or present a repeated sequence as new transfer.

The next useful action is to continue the substantive unfinished G13 work.
Another renamed planner, report or measurement-only pass will not complete
the construction objective. No new numbered task was created by this review.
